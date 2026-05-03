/**
 * /api/python/heartbeat
 *
 * POST: daemon pings every poll cycle. We persist to a single-row table
 *       so the dashboard can show "Daemon online" / "Last seen Xm ago".
 * GET:  dashboard reads the latest heartbeat to render status.
 *
 * Auth: POST requires x-webhook-secret. GET is public (read-only status).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await db().execute(`
    CREATE TABLE IF NOT EXISTS daemon_heartbeats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      account_id TEXT,
      last_seen_at TEXT NOT NULL,
      pid INTEGER,
      poll_count INTEGER DEFAULT 0,
      browser_channel TEXT,
      version TEXT,
      hostname TEXT,
      meta TEXT
    )
  `);
}

export async function POST(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    account_id?: string;
    pid?: number;
    poll_count?: number;
    browser_channel?: string;
    version?: string;
    hostname?: string;
    meta?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  await ensureTable();
  const now = new Date().toISOString();

  await db().execute({
    sql: `INSERT INTO daemon_heartbeats
            (id, account_id, last_seen_at, pid, poll_count, browser_channel, version, hostname, meta)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            account_id      = excluded.account_id,
            last_seen_at    = excluded.last_seen_at,
            pid             = excluded.pid,
            poll_count      = excluded.poll_count,
            browser_channel = excluded.browser_channel,
            version         = excluded.version,
            hostname        = excluded.hostname,
            meta            = excluded.meta`,
    args: [
      body.account_id ?? null,
      now,
      body.pid ?? null,
      body.poll_count ?? null,
      body.browser_channel ?? null,
      body.version ?? null,
      body.hostname ?? null,
      body.meta ? JSON.stringify(body.meta) : null,
    ],
  });

  return NextResponse.json({ ok: true, recorded_at: now });
}

export async function GET() {
  try {
    await ensureTable();
    const result = await db().execute(
      "SELECT * FROM daemon_heartbeats WHERE id = 1 LIMIT 1"
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ heartbeat: null });
    }
    const row = result.rows[0] as unknown as {
      last_seen_at: string;
      pid: number | null;
      poll_count: number | null;
      browser_channel: string | null;
      version: string | null;
      hostname: string | null;
    };
    const lastSeen = new Date(row.last_seen_at).getTime();
    const ageSec = Math.floor((Date.now() - lastSeen) / 1000);
    // Threshold: daemon polls every 60-120s, so >5min stale = offline
    const status = ageSec < 300 ? "online" : ageSec < 900 ? "degraded" : "offline";
    return NextResponse.json({
      heartbeat: {
        ...row,
        age_seconds: ageSec,
        status,
      },
    });
  } catch (err) {
    return NextResponse.json({ heartbeat: null, error: String(err).slice(0, 200) });
  }
}
