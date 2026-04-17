/**
 * GET /api/doctrine/stats?account_id=X&days=30
 *
 * Returns pipeline analytics:
 *  - current stage distribution
 *  - stage transitions (last N days)
 *  - objection breakdown
 *  - signal score distribution
 *  - prospect queue state
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get("days") || 30)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const accountFilter = accountId ? "AND account_id = ?" : "";
  const args: (string | number)[] = accountId ? [accountId] : [];

  // Current stage distribution
  const stageDist = await db().execute({
    sql: `SELECT stage, COUNT(*) as count FROM dm_threads
          WHERE 1=1 ${accountFilter}
          GROUP BY stage ORDER BY count DESC`,
    args,
  });

  // Stage transitions over time window
  const transArgs = accountId ? [since, accountId] : [since];
  const transitions = await db().execute({
    sql: `SELECT from_stage, to_stage, triggered_by, COUNT(*) as count
          FROM stage_transitions
          WHERE created_at >= ? ${accountFilter}
          GROUP BY from_stage, to_stage, triggered_by
          ORDER BY count DESC`,
    args: transArgs,
  });

  // Objection breakdown
  const objArgs = accountId ? [since, accountId] : [since];
  const objections = await db().execute({
    sql: `SELECT objection_type, COUNT(*) as count
          FROM objection_history
          WHERE created_at >= ? ${accountFilter}
          GROUP BY objection_type
          ORDER BY count DESC`,
    args: objArgs,
  });

  // Signal score buckets
  const sigArgs = accountId ? [accountId] : [];
  const signalDist = await db().execute({
    sql: `SELECT
            CASE
              WHEN signal_score >= 80 THEN 'hot'
              WHEN signal_score >= 50 THEN 'warm'
              WHEN signal_score >= 20 THEN 'cool'
              ELSE 'cold'
            END as band,
            COUNT(*) as count
          FROM dm_threads
          WHERE stage NOT IN ('dead','closed_won','closed_lost') ${accountFilter}
          GROUP BY band`,
    args: sigArgs,
  });

  // Prospect queue state
  const queueArgs = accountId ? [accountId] : [];
  const queueStats = await db().execute({
    sql: `SELECT status, COUNT(*) as count
          FROM prospect_queue
          WHERE 1=1 ${accountFilter}
          GROUP BY status`,
    args: queueArgs,
  });

  // Conversion funnel: count of each stage transitioned TO
  const funnelArgs = accountId ? [since, accountId] : [since];
  const funnelRes = await db().execute({
    sql: `SELECT to_stage, COUNT(DISTINCT thread_id) as threads
          FROM stage_transitions
          WHERE created_at >= ? ${accountFilter}
          GROUP BY to_stage`,
    args: funnelArgs,
  });

  return NextResponse.json({
    window_days: days,
    stage_distribution: stageDist.rows,
    transitions: transitions.rows,
    objections: objections.rows,
    signal_distribution: signalDist.rows,
    prospect_queue: queueStats.rows,
    funnel: funnelRes.rows,
  });
}
