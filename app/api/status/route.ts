import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks = {
    turso: false,
    n8n: false,
    anthropic: false,
    instagram: false,
  };

  // Check Turso
  try {
    await db().execute("SELECT id FROM accounts LIMIT 1");
    checks.turso = true;
  } catch {
    checks.turso = false;
  }

  // Check n8n (env configured)
  checks.n8n = !!(process.env.N8N_OVERRIDE_WEBHOOK_URL && process.env.N8N_BASE_URL);

  // Check Anthropic (env configured)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

  // Check Instagram
  checks.instagram = !!process.env.IG_ACCESS_TOKEN || checks.turso;

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks });
}
