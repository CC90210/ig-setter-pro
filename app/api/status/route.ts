import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    turso: false,
    python: false,
    anthropic: false,
    instagram: false,
  };

  // Check Turso
  try {
    await db().execute("SELECT 1");
    checks.turso = true;
  } catch {
    checks.turso = false;
  }

  // Check Python Playwright bridge (shared webhook secret configured)
  checks.python = !!process.env.WEBHOOK_SECRET;

  // Check Anthropic (env configured)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

  // Check Instagram (IG tokens stored in accounts table — just need Turso working)
  checks.instagram = !!process.env.IG_ACCESS_TOKEN || checks.turso;

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks });
}
