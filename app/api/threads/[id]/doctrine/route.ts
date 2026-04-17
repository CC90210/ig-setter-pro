/**
 * PATCH /api/threads/[id]/doctrine
 *
 * Manually update a thread's doctrine state:
 *  - stage (override AI's pick)
 *  - is_friend (toggle friend mode)
 *  - in_icp (mark out-of-ICP to stop automation)
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { STAGES } from "@/lib/doctrine/pipeline";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Partial<{
    stage: string;
    is_friend: boolean;
    in_icp: boolean;
    region: string | null;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Load current state for audit
  const current = await db().execute({
    sql: "SELECT id, account_id, stage FROM dm_threads WHERE id = ? LIMIT 1",
    args: [params.id],
  });
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  const thread = current.rows[0] as unknown as { id: string; account_id: string; stage: string };

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage as (typeof STAGES)[number])) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    updates.push("stage = ?", "last_stage_change_at = ?");
    args.push(body.stage, new Date().toISOString());
  }
  if (body.is_friend !== undefined) {
    updates.push("is_friend = ?");
    args.push(body.is_friend ? 1 : 0);
  }
  if (body.in_icp !== undefined) {
    updates.push("in_icp = ?");
    args.push(body.in_icp ? 1 : 0);
  }
  if (body.region !== undefined) {
    updates.push("region = ?");
    args.push(body.region);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const now = new Date().toISOString();
  updates.push("updated_at = ?");
  args.push(now);
  args.push(params.id);

  await db().execute({
    sql: `UPDATE dm_threads SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  // Audit stage change
  if (body.stage !== undefined && body.stage !== thread.stage) {
    await db().execute({
      sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, 'human', 'manual_override', ?)`,
      args: [generateId(), params.id, thread.account_id, thread.stage, body.stage, now],
    });
  }

  return NextResponse.json({ ok: true });
}
