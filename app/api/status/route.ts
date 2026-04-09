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
  let tursoError = "";
  try {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL not set (env empty)");
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!token) throw new Error("TURSO_AUTH_TOKEN not set (env empty)");
    await db().execute("SELECT 1");
    checks.turso = true;
  } catch (e) {
    checks.turso = false;
    const rawUrl = process.env.TURSO_DATABASE_URL || "MISSING";
    tursoError = `${e instanceof Error ? e.message : String(e)} | url_len=${rawUrl.length} | url=${rawUrl.substring(0, 50)} | token_len=${(process.env.TURSO_AUTH_TOKEN || "").length}`;
  }

  // Check n8n (env configured)
  checks.n8n = !!(process.env.N8N_OVERRIDE_WEBHOOK_URL && process.env.N8N_BASE_URL);

  // Check Anthropic (env configured)
  checks.anthropic = !!process.env.ANTHROPIC_API_KEY;

  // Check Instagram (IG tokens stored in accounts table — just need Turso working)
  checks.instagram = !!process.env.IG_ACCESS_TOKEN || checks.turso;

  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks, ...(tursoError ? { tursoError } : {}) });
}
