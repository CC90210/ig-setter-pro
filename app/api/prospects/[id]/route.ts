/**
 * PATCH /api/prospects/[id]    — update a prospect (change status, re-schedule, etc.)
 * DELETE /api/prospects/[id]   — remove from queue
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_STATUSES = ["queued", "sending", "sent", "replied", "skipped", "failed", "blocked"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Partial<{
    status: string;
    priority: number;
    scheduled_for: string | null;
    personalization: string | null;
    reason: string | null;
  }>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.push("status = ?");
    args.push(body.status);
  }
  if (body.priority !== undefined) {
    updates.push("priority = ?");
    args.push(Math.max(0, Math.min(100, body.priority)));
  }
  if (body.scheduled_for !== undefined) {
    updates.push("scheduled_for = ?");
    args.push(body.scheduled_for);
  }
  if (body.personalization !== undefined) {
    updates.push("personalization = ?");
    args.push(body.personalization);
  }
  if (body.reason !== undefined) {
    updates.push("reason = ?");
    args.push(body.reason);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = ?");
  args.push(new Date().toISOString());
  args.push(params.id);

  await db().execute({
    sql: `UPDATE prospect_queue SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await db().execute({
    sql: "DELETE FROM prospect_queue WHERE id = ?",
    args: [params.id],
  });
  return NextResponse.json({ ok: true });
}
