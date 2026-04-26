import { supabase } from "@/integrations/supabase/client";

export const DEMO_ACCOUNTS = {
  patient: { email: "maria.patient@curaai.demo", password: "DemoPass123!", name: "Maria Garcia", lang: "es" as const },
  doctor: { email: "chen.doctor@curaai.demo", password: "DemoPass123!", name: "Dr. Sarah Chen", lang: "en" as const },
  driver: { email: "carlos.driver@curaai.demo", password: "DemoPass123!", name: "Carlos Mendez", lang: "en" as const },
};

/**
 * Seed demo accounts and related data. Idempotent — won't duplicate if already seeded.
 * Returns when done. Uses signUp which works with email auto-confirm enabled.
 */
export async function seedDemoData(): Promise<{ ok: boolean; message: string }> {
  try {
    // Check if already seeded
    const { data: existingDoctor } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", DEMO_ACCOUNTS.doctor.email)
      .maybeSingle();

    let doctorId = existingDoctor?.id ?? null;
    let patientId: string | null = null;
    let driverId: string | null = null;

    // Create doctor first (so we can assign patient to them)
    if (!doctorId) {
      const { data, error } = await supabase.auth.signUp({
        email: DEMO_ACCOUNTS.doctor.email,
        password: DEMO_ACCOUNTS.doctor.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: DEMO_ACCOUNTS.doctor.name,
            role: "doctor",
            preferred_language: DEMO_ACCOUNTS.doctor.lang,
          },
        },
      });
      if (error && !error.message.includes("already")) throw error;
      doctorId = data.user?.id ?? null;
      // Sign out immediately so we don't pollute session
      await supabase.auth.signOut();
    }

    // Create patient
    const { data: existingPatient } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", DEMO_ACCOUNTS.patient.email)
      .maybeSingle();
    patientId = existingPatient?.id ?? null;

    if (!patientId) {
      const { data, error } = await supabase.auth.signUp({
        email: DEMO_ACCOUNTS.patient.email,
        password: DEMO_ACCOUNTS.patient.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: DEMO_ACCOUNTS.patient.name,
            role: "patient",
            preferred_language: DEMO_ACCOUNTS.patient.lang,
          },
        },
      });
      if (error && !error.message.includes("already")) throw error;
      patientId = data.user?.id ?? null;
      await supabase.auth.signOut();
    }

    // Create driver
    const { data: existingDriver } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", DEMO_ACCOUNTS.driver.email)
      .maybeSingle();
    driverId = existingDriver?.id ?? null;

    if (!driverId) {
      const { data, error } = await supabase.auth.signUp({
        email: DEMO_ACCOUNTS.driver.email,
        password: DEMO_ACCOUNTS.driver.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: DEMO_ACCOUNTS.driver.name,
            role: "volunteer_driver",
            preferred_language: DEMO_ACCOUNTS.driver.lang,
          },
        },
      });
      if (error && !error.message.includes("already")) throw error;
      driverId = data.user?.id ?? null;
      await supabase.auth.signOut();
    }

    // Set DOB on profiles (need a session for RLS - skip if not possible; we'll do via signing in as each)
    // Sign in as patient to seed their data
    if (patientId && doctorId) {
      await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNTS.patient.email,
        password: DEMO_ACCOUNTS.patient.password,
      });

      // Update profile with DOB
      await supabase.from("profiles").update({
        date_of_birth: "1966-04-12",
        phone: "+1-520-555-0142",
      }).eq("id", patientId);

      // Insert patient record
      const { data: existingPatRow } = await supabase.from("patients").select("id").eq("id", patientId).maybeSingle();
      if (!existingPatRow) {
        await supabase.from("patients").insert({
          id: patientId,
          conditions: ["Type 2 Diabetes", "Hypertension"],
          medications: [
            { name: "Metformin", dosage: "500mg", frequency: "twice daily" },
            { name: "Lisinopril", dosage: "10mg", frequency: "once daily" },
          ],
          allergies: ["Penicillin"],
          assigned_doctor_id: doctorId,
          emergency_contact: "Jose Garcia (son) +1-520-555-0188",
          address: "1247 W Camino Verde, Sells, AZ 85634",
        });
      }

      // Health timeline events (only insert if none exist)
      const { count } = await supabase.from("health_timeline").select("*", { count: "exact", head: true }).eq("patient_id", patientId);
      if (!count) {
        const now = Date.now();
        const days = (n: number) => new Date(now - n * 86400000).toISOString();
        await supabase.from("health_timeline").insert([
          {
            patient_id: patientId,
            event_type: "sms_checkin",
            content: { en: "Morning check-in: feeling well, took medications.", es: "Chequeo matutino: me siento bien, tomé los medicamentos." },
            created_at: days(0),
          },
          {
            patient_id: patientId,
            event_type: "ai_advice",
            content: {
              en: "Reported dizziness and headache (severity 6/10). Advised rest and hydration. BP correlation suggested.",
              es: "Reportó mareo y dolor de cabeza (severidad 6/10). Se aconsejó descanso e hidratación. Posible correlación con presión arterial.",
              flagged: "true",
              symptoms: "Dizziness, headache 6/10",
            },
            created_at: days(5),
          },
          {
            patient_id: patientId,
            event_type: "doctor_note",
            content: { en: "Reviewed labs. HbA1c 7.2 — stable. Continue Metformin.", es: "Revisé los análisis. HbA1c 7.2 — estable. Continuar Metformina." },
            created_at: days(8),
          },
          {
            patient_id: patientId,
            event_type: "appointment",
            content: { en: "Telehealth follow-up scheduled.", es: "Cita de seguimiento por telesalud agendada." },
            created_at: days(10),
          },
          {
            patient_id: patientId,
            event_type: "medication",
            content: { en: "Metformin refilled — 90 day supply.", es: "Metformina resurtida — suministro de 90 días." },
            created_at: days(14),
          },
          {
            patient_id: patientId,
            event_type: "sms_checkin",
            content: { en: "Evening check-in: glucose 142 mg/dL after dinner.", es: "Chequeo nocturno: glucosa 142 mg/dL después de cenar." },
            created_at: days(15),
          },
        ]);
      }

      await supabase.auth.signOut();
    }

    // Sign in as doctor to seed appointments
    if (doctorId && patientId) {
      await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNTS.doctor.email,
        password: DEMO_ACCOUNTS.doctor.password,
      });

      const { count: apptCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId);

      if (!apptCount) {
        const now = Date.now();
        const future = (d: number) => new Date(now + d * 86400000).toISOString();
        await supabase.from("appointments").insert([
          {
            patient_id: patientId,
            doctor_id: doctorId,
            scheduled_at: future(2),
            appointment_type: "telehealth",
            status: "confirmed",
            ai_brief:
              "Maria Garcia, 58F, T2 Diabetes + HTN. Recent flag: dizziness/headache 5d ago, possibly BP-related. Review BP log, confirm Lisinopril adherence, consider 24h ambulatory BP monitor. Last HbA1c 7.2 (stable).",
          },
          {
            patient_id: patientId,
            doctor_id: doctorId,
            scheduled_at: future(14),
            appointment_type: "in_person",
            status: "scheduled",
            ai_brief: "Quarterly diabetes review. Order: HbA1c, lipid panel, microalbumin. Discuss foot exam.",
          },
        ]);
      }

      await supabase.auth.signOut();
    }

    // Sign in as driver to seed credits + complete a ride history
    if (driverId) {
      await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNTS.driver.email,
        password: DEMO_ACCOUNTS.driver.password,
      });

      const { data: existingCredits } = await supabase
        .from("volunteer_credits")
        .select("driver_id")
        .eq("driver_id", driverId)
        .maybeSingle();
      if (!existingCredits) {
        await supabase.from("volunteer_credits").insert({
          driver_id: driverId,
          credits: 105,
          total_rides_completed: 7,
        });
      }

      await supabase.auth.signOut();
    }

    // Patient creates an open ride request
    if (patientId) {
      await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNTS.patient.email,
        password: DEMO_ACCOUNTS.patient.password,
      });
      const { count: rideCount } = await supabase
        .from("ride_requests")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId);
      if (!rideCount) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        await supabase.from("ride_requests").insert({
          patient_id: patientId,
          pickup_address: "1247 W Camino Verde, Sells, AZ 85634",
          destination: "Banner University Medical Center, Tucson, AZ",
          requested_date: tomorrow,
          status: "open",
        });
      }
      await supabase.auth.signOut();
    }

    return { ok: true, message: "Demo accounts ready." };
  } catch (e) {
    console.error("seed error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, message: msg };
  }
}
