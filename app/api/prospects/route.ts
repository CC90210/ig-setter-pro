/**
 * GET /api/prospects      — list prospects in queue
 * POST /api/prospects     — add prospect(s) to queue
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId, type Prospect } from "@/lib/db";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 500);

  const whereParts: string[] = [];
  const args: (string | number)[] = [];
  if (accountId) {
    whereParts.push("account_id = ?");
    args.push(accountId);
  }
  if (status) {
    whereParts.push("status = ?");
    args.push(status);
  }
  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const res = await db().execute({
    sql: `SELECT * FROM prospect_queue ${where} ORDER BY priority DESC, scheduled_for ASC, created_at ASC LIMIT ?`,
    args: [...args, limit],
  });

  return NextResponse.json({
    prospects: res.rows as unknown as Prospect[],
    count: res.rows.length,
  });
}

export async function POST(req: NextRequest) {
  let body: {
    account_id: string;
    prospects: Array<{
      ig_username: string;
      display_name?: string;
      profile_url?: string;
      bio_snippet?: string;
      follower_count?: number;
      niche?: string;
      region?: string;
      source?: string;
      reason?: string;
      personalization?: string;
      priority?: number;
      scheduled_for?: string;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !Array.isArray(body.prospects) || body.prospects.length === 0) {
    return NextResponse.json({ error: "account_id and prospects[] required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const p of body.prospects) {
    if (!p.ig_username) continue;
    const username = p.ig_username.replace(/^@/, "").trim().toLowerCase();
    if (!username) continue;

    try {
      const id = generateId();
      await db().execute({
        sql: `INSERT INTO prospect_queue (
          id, account_id, ig_username, display_name, profile_url, bio_snippet,
          follower_count, niche, region, source, reason, personalization,
          priority, scheduled_for, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, body.account_id, username,
          p.display_name ?? null, p.profile_url ?? null, p.bio_snippet ?? null,
          p.follower_count ?? null, p.niche ?? null, p.region ?? null,
          p.source ?? "manual", p.reason ?? null, p.personalization ?? null,
          Math.max(0, Math.min(100, p.priority ?? 50)),
          p.scheduled_for ?? null,
          now, now,
        ],
      });
      inserted.push(id);
    } catch (e) {
      // Probably UNIQUE violation — already queued
      skipped.push(username);
      console.log("[prospects] skipped duplicate:", username, e);
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted.length,
    skipped: skipped.length,
    skippedUsernames: skipped,
  });
}
