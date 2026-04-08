import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const checks = {
    supabase: false,
    n8n: false,
    anthropic: false,
    instagram: false,
  };

  // Check Supabase
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.from("accounts").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  // Check n8n (env configured)
  checks.n8n = !!(process.env.N8N_OVERRIDE_WEBHOOK_URL && process.env.N8N_BASE_URL);

  // Check Anthropic (env configured)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

  // Check Instagram (at least env vars or accounts in DB)
  checks.instagram = !!process.env.IG_ACCESS_TOKEN || checks.supabase;

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks });
}
