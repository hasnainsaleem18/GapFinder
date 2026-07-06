import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SupabaseStatus = "ok" | "schema_missing" | "not_configured" | "unreachable";

export async function GET() {
  let supabase: SupabaseStatus = "not_configured";

  if (isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("sessions").select("id").limit(1);

      if (!error) {
        supabase = "ok";
      } else if (error.code === "PGRST205" || error.code === "42P01") {
        // both mean "table not found" — we reached supabase fine, the
        // migration just hasn't been run yet. worth distinguishing from a
        // dead connection or the status page sends you chasing the wrong thing
        supabase = "schema_missing";
      } else {
        supabase = "unreachable";
      }
    } catch {
      supabase = "unreachable";
    }
  }

  return NextResponse.json({ nextjs: "ok", supabase });
}
