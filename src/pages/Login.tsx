import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CuraLogo } from "@/components/CuraLogo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { seedDemoData, DEMO_ACCOUNTS } from "@/lib/seedDemo";

export default function Login() {
  const { t, lang } = useLanguage();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  if (!authLoading && session) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t("errInvalid"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(lang === "es" ? "¡Bienvenido!" : "Welcome!");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    const res = await seedDemoData();
    setSeeding(false);
    if (res.ok) {
      toast.success(t("demoCreated"));
    } else {
      toast.error(res.message);
    }
  };

  const fillDemo = (which: keyof typeof DEMO_ACCOUNTS) => {
    setEmail(DEMO_ACCOUNTS[which].email);
    setPassword(DEMO_ACCOUNTS[which].password);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full gradient-soft blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full gradient-soft blur-3xl opacity-70" />

      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <CuraLogo size="lg" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          <Card className="border-border/60 p-7 shadow-elevated">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground hover:opacity-95" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("signIn")}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Demo</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Button onClick={handleSeed} variant="outline" className="w-full gap-2" disabled={seeding}>
                {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                {t("loadDemo")}
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => fillDemo("patient")} className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground transition-base hover:border-primary hover:bg-primary-soft">
                  {t("rolePatient")}
                </button>
                <button onClick={() => fillDemo("doctor")} className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground transition-base hover:border-primary hover:bg-primary-soft">
                  {t("roleDoctor")}
                </button>
                <button onClick={() => fillDemo("driver")} className="rounded-md border border-border bg-background px-2 py-2 text-xs font-medium text-foreground transition-base hover:border-primary hover:bg-primary-soft">
                  {t("roleDriver")}
                </button>
              </div>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            HIPAA-conscious design · Built for rural Arizona communities
          </p>
        </div>
      </div>
    </div>
  );
}
