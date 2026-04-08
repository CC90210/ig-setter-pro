import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    turso: false,
    n8n: false,
    anthropic: false,
    instagram: false,
  };

  // Check Turso
  try {
    await db().execute("SELECT 1");
    checks.turso = true;
  } catch (e) {
    checks.turso = false;
    console.error("Turso check failed:", e instanceof Error ? e.message : e);
  }

  // Check n8n (env configured)
  checks.n8n = !!(process.env.N8N_OVERRIDE_WEBHOOK_URL && process.env.N8N_BASE_URL);

  // Check Anthropic (env configured)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

  // Check Instagram (IG tokens stored in accounts table — just need Turso working)
  checks.instagram = !!process.env.IG_ACCESS_TOKEN || checks.turso;

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks });
}
