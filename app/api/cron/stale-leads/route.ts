/**
 * GET /api/cron/stale-leads
 *
 * Marks threads as `dead` that have had no inbound activity in N days
 * (configurable per account via icp_configs.stale_days, default 14).
 *
 * Runs via Vercel Cron (see vercel.json).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${(process.env.CRON_SECRET || "").trim()}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    const header = (req.headers.get("x-cron-secret") || "").trim();
    if (!process.env.CRON_SECRET || header !== (process.env.CRON_SECRET || "").trim()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Load all account stale-day configs (default 14 if not set)
  const accounts = await db().execute(
    "SELECT id, COALESCE((SELECT stale_days FROM icp_configs WHERE account_id = accounts.id LIMIT 1), 14) AS stale_days FROM accounts WHERE is_active = 1"
  );

  let totalMarked = 0;
  const perAccount: Array<{ account_id: string; marked: number }> = [];

  for (const row of accounts.rows) {
    const a = row as unknown as { id: string; stale_days: number };
    const cutoff = new Date(now.getTime() - a.stale_days * 86_400_000).toISOString();

    // Identify stale threads: have replies (last_inbound_at set) but no inbound in N days
    // AND not already terminal
    const staleRes = await db().execute({
      sql: `SELECT id, stage FROM dm_threads
            WHERE account_id = ?
              AND stage NOT IN ('closed_won','closed_lost','dead','booked')
              AND last_inbound_at IS NOT NULL
              AND last_inbound_at < ?`,
      args: [a.id, cutoff],
    });

    for (const t of staleRes.rows) {
      const thread = t as unknown as { id: string; stage: string };
      await db().execute({
        sql: `UPDATE dm_threads SET stage = 'dead', last_stage_change_at = ?, updated_at = ? WHERE id = ?`,
        args: [nowIso, nowIso, thread.id],
      });
      await db().execute({
        sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
              VALUES (?, ?, ?, ?, 'dead', 'cron', ?, ?)`,
        args: [generateId(), thread.id, a.id, thread.stage, `stale >${a.stale_days}d`, nowIso],
      });
      totalMarked++;
    }

    if (staleRes.rows.length > 0) {
      perAccount.push({ account_id: a.id, marked: staleRes.rows.length });
    }
  }

  return NextResponse.json({
    ok: true,
    total_marked: totalMarked,
    per_account: perAccount,
    cutoff_applied: "per-account stale_days from icp_configs (default 14)",
  });
}
