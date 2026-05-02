/**
 * POST /api/admin/wipe-test-data
 *
 * Wipes all conversational/test data from PULSE while preserving:
 *   - accounts            (your IG account rows)
 *   - icp_configs         (Doctrine config)
 *   - comment_triggers    (registered Comment→DM triggers)
 *   - automation_rules    (rule definitions)
 *   - sequences           (sequence definitions)
 *   - tags / quick_replies (taxonomy & templates)
 *
 * Auth: header `x-webhook-secret` must match WEBHOOK_SECRET.
 * Idempotent — safe to call when tables are empty.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const TABLES_TO_WIPE = [
  "comment_events",          // event log only — keeps trigger configs
  "python_outbound_queue",
  "dm_messages",
  "stage_transitions",
  "objection_history",
  "conversions",
  "sequence_enrollments",
  "subscribers",
  "prospect_queue",
  "prospects",
  "dm_threads",
  "daily_stats",
] as const;

export async function POST(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number | string> = {};

  // foreign_keys=ON would chain-cascade some of these; we wipe each
  // explicitly so the response shows per-table counts.
  for (const table of TABLES_TO_WIPE) {
    try {
      const before = await db().execute(`SELECT COUNT(*) AS n FROM ${table}`);
      const beforeCount = Number(
        (before.rows[0] as unknown as { n: number }).n ?? 0
      );
      if (beforeCount > 0) {
        await db().execute(`DELETE FROM ${table}`);
      }
      results[table] = beforeCount;
    } catch (err) {
      results[table] = `error: ${(err as Error).message}`;
    }
  }

  return NextResponse.json({
    ok: true,
    wiped: results,
    preserved: [
      "accounts",
      "icp_configs",
      "comment_triggers",
      "automation_rules",
      "sequences",
      "tags",
      "quick_replies",
    ],
  });
}
