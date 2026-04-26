import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateAge, timeAgo } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Users, Calendar, Flag, ExternalLink, Loader2, Bot, Stethoscope, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PatientWithProfile {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  conditions: string[];
  medications: { name: string; dosage: string; frequency: string }[];
  allergies: string[];
}

interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  appointment_type: string;
  status: string;
  ai_brief: string | null;
  patient_name?: string;
}

interface FlaggedEvent {
  id: string;
  patient_id: string;
  content: Record<string, string>;
  created_at: string;
  patient_name?: string;
}

const MOCK_SUMMARY =
  "Maria Garcia, 58F. Conditions: T2 Diabetes, Hypertension. Current medications: Metformin 500mg twice daily, Lisinopril 10mg once daily. Recent activity: Reported dizziness and headache (severity 6/10) 5 days ago, resolved within 24 hours. Medication adherence confirmed. Flagged concern: recurring headache pattern correlating with BP fluctuation. Recommend checking BP at next appointment.";

export default function DoctorDashboard() {
  const { profile, user } = useAuth();
  const { t, lang } = useLanguage();

  const [patients, setPatients] = useState<PatientWithProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [flagged, setFlagged] = useState<FlaggedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Patient summary panel
  const [activePatient, setActivePatient] = useState<PatientWithProfile | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [activeEvents, setActiveEvents] = useState<any[]>([]);

  // AI brief modal
  const [briefAppt, setBriefAppt] = useState<Appointment | null>(null);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);

    // Patients assigned to me
    const { data: pats } = await supabase
      .from("patients")
      .select("id, conditions, medications, allergies")
      .eq("assigned_doctor_id", user.id);

    const ids = (pats ?? []).map((p) => p.id);

    // Profile info
    let profMap = new Map<string, { full_name: string; date_of_birth: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, date_of_birth")
        .in("id", ids);
      profs?.forEach((p) => profMap.set(p.id, { full_name: p.full_name, date_of_birth: p.date_of_birth }));
    }

    const merged: PatientWithProfile[] = (pats ?? []).map((p) => ({
      id: p.id,
      full_name: profMap.get(p.id)?.full_name ?? "Unknown",
      date_of_birth: profMap.get(p.id)?.date_of_birth ?? null,
      conditions: p.conditions ?? [],
      medications: (p.medications as any) ?? [],
      allergies: p.allergies ?? [],
    }));
    setPatients(merged);

    // Appointments
    const { data: appts } = await supabase
      .from("appointments")
      .select("*")
      .eq("doctor_id", user.id)
      .neq("status", "completed")
      .order("scheduled_at", { ascending: true });
    const apptsWithNames = (appts ?? []).map((a) => ({
      ...a,
      patient_name: profMap.get(a.patient_id)?.full_name ?? "",
    }));
    setAppointments(apptsWithNames as Appointment[]);

    // Flagged events (last 7 days)
    if (ids.length) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: events } = await supabase
        .from("health_timeline")
        .select("*")
        .in("patient_id", ids)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
      const flaggedOnly = (events ?? []).filter((e) => (e.content as any)?.flagged === "true");
      setFlagged(
        flaggedOnly.map((e) => ({
          id: e.id,
          patient_id: e.patient_id,
          content: e.content as any,
          created_at: e.created_at,
          patient_name: profMap.get(e.patient_id)?.full_name ?? "",
        }))
      );
    } else {
      setFlagged([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openSummary = async (p: PatientWithProfile) => {
    setActivePatient(p);
    setSummaryLoading(true);
    setSummaryText(null);
    setActiveEvents([]);
    const { data } = await supabase
      .from("health_timeline")
      .select("*")
      .eq("patient_id", p.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setActiveEvents(data ?? []);
    // simulate AI summary
    await new Promise((r) => setTimeout(r, 1500));
    setSummaryText(MOCK_SUMMARY);
    setSummaryLoading(false);
  };

  const updateApptStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "es" ? "Estado actualizado" : "Status updated");
      loadAll();
    }
  };

  const flagCountFor = (patientId: string) =>
    flagged.filter((f) => f.patient_id === patientId).length;

  const dotColor = (n: number) =>
    n === 0 ? "bg-success" : n === 1 ? "bg-warning" : "bg-destructive";

  const today = new Date().toISOString().slice(0, 10);
  const apptsToday = appointments.filter((a) => a.scheduled_at.slice(0, 10) === today).length;

  const docName = profile?.full_name?.replace(/^Dr\.?\s*/i, "") ?? "";

  return (
    <AppShell title={t("doctorDashboard")}>
      {/* Header */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("welcomeDr")} {docName}</h2>
        <p className="text-sm text-muted-foreground">{t("clinicSubtitle")}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard icon={<Users className="h-4 w-4" />} label={t("totalPatients")} value={loading ? null : patients.length} />
          <StatCard icon={<Calendar className="h-4 w-4" />} label={t("appointmentsToday")} value={loading ? null : apptsToday} />
          <StatCard icon={<Flag className="h-4 w-4" />} label={t("flaggedEvents")} value={loading ? null : flagged.length} accent />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient roster */}
        <section>
          <h3 className="mb-3 text-lg font-semibold">{t("yourPatients")}</h3>
          {loading ? (
            <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
          ) : patients.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground shadow-card">No patients assigned.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {patients.map((p) => {
                const flags = flagCountFor(p.id);
                const age = calculateAge(p.date_of_birth);
                return (
                  <Card key={p.id} className="p-4 shadow-card transition-base hover:shadow-elevated">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", dotColor(flags))} />
                        <h4 className="font-semibold">{p.full_name}</h4>
                        {age && <span className="text-xs text-muted-foreground">{age} {t("age")}</span>}
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-1">
                      {p.conditions.map((c) => (
                        <Badge key={c} className="bg-primary-soft text-primary border-0 text-xs font-medium hover:bg-primary-soft">{c}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openSummary(p)}>
                        {t("viewSummary")}
                      </Button>
                      <Button size="sm" className="flex-1 gradient-primary text-primary-foreground" onClick={() => toast.info("Open scheduler")}>
                        {t("scheduleAppt")}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Appointments + Flagged */}
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-lg font-semibold">{t("upcomingAppointments")}</h3>
            <Card className="shadow-card">
              {loading ? (
                <div className="p-4"><Skeleton className="h-12 w-full" /></div>
              ) : appointments.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">{t("noAppointments")}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {appointments.map((a) => (
                    <li key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{a.patient_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {new Date(a.scheduled_at).toLocaleString(lang === "es" ? "es-MX" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">{a.appointment_type === "telehealth" ? t("telehealth") : t("inPerson")}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Select value={a.status} onValueChange={(v) => updateApptStatus(a.id, v)}>
                            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">{t("status_scheduled")}</SelectItem>
                              <SelectItem value="confirmed">{t("status_confirmed")}</SelectItem>
                              <SelectItem value="completed">{t("status_completed")}</SelectItem>
                              <SelectItem value="cancelled">{t("status_cancelled")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setBriefAppt(a)}>
                            <Bot className="h-3 w-3" />
                            {t("viewAiBrief")}
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-border bg-muted/30 px-4 py-2.5">
                <a href="#" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3 w-3" />
                  {t("bannerIntegration")}
                </a>
              </div>
            </Card>
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold">{t("flaggedActivity")}</h3>
            <Card className="shadow-card">
              {loading ? (
                <div className="p-4"><Skeleton className="h-10 w-full" /></div>
              ) : flagged.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">{t("noFlagged")}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {flagged.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                        <Flag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{f.patient_name}</p>
                          <span className="text-xs text-muted-foreground">{timeAgo(f.created_at, lang)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {f.content[lang] || f.content.en || f.content.symptoms}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                        const p = patients.find((pp) => pp.id === f.patient_id);
                        if (p) openSummary(p);
                      }}>
                        {t("review")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>

      {/* Patient Summary Sheet */}
      <Sheet open={!!activePatient} onOpenChange={(o) => !o && setActivePatient(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              {activePatient?.full_name}
            </SheetTitle>
          </SheetHeader>
          {activePatient && (
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("conditions")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {activePatient.conditions.map((c) => (
                    <Badge key={c} className="bg-primary-soft text-primary border-0">{c}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("medications")}</p>
                <ul className="space-y-1.5 text-sm">
                  {activePatient.medications.map((m, i) => (
                    <li key={i} className="rounded-md bg-muted/50 px-3 py-2">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground"> · {m.dosage} · {m.frequency}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("allergies")}</p>
                <p className="text-sm">{activePatient.allergies.join(", ") || "—"}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("recentActivity")}</p>
                <div className="space-y-2">
                  {activeEvents.map((e) => (
                    <div key={e.id} className="rounded-md border border-border p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase text-muted-foreground">{t(`evt_${e.event_type}` as any)}</span>
                        <span className="text-muted-foreground">{timeAgo(e.created_at, lang)}</span>
                      </div>
                      <p className="mt-1 text-foreground">{e.content[lang] || e.content.en}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl gradient-soft border border-accent/20 p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">AI Summary</p>
                </div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating summary...
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{summaryText}</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* AI Brief Dialog */}
      <Dialog open={!!briefAppt} onOpenChange={(o) => !o && setBriefAppt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-accent" />
              {t("aiBrief")} — {briefAppt?.patient_name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed">{briefAppt?.ai_brief || "No AI brief available."}</p>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatCard({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number | null; accent?: boolean }) {
  return (
    <Card className={cn("p-4 shadow-card", accent && "border-warning/30 bg-warning/5")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", accent ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary")}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value === null ? <Skeleton className="h-7 w-10" /> : value}</p>
    </Card>
  );
}
