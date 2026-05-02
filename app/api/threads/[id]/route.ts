/**
 * PATCH /api/threads/[id]
 *
 * Update a single thread's flags. Used by the conversation header buttons
 * (Friend mode, Archive, Mark closed, Re-open). Auth via x-api-secret.
 *
 * Allowed fields:
 *   is_friend  : boolean → drop NEPQ, switch to friendVoiceBlock
 *   status     : "active" | "qualified" | "booked" | "closed"
 *   stage      : doctrine pipeline stage (manual override)
 *   ai_status  : same set as status (controls "AI Running" badge)
 *
 * When status flips to "closed" the daemon's _check_dms_on_page skips
 * the thread on every poll thereafter — no replies fire even if new
 * inbound messages arrive.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["active", "qualified", "booked", "closed"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "thread id required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sets: string[] = ["updated_at = ?"];
  const args: (string | number | null)[] = [new Date().toISOString()];

  if (typeof body.is_friend === "boolean") {
    sets.push("is_friend = ?");
    args.push(body.is_friend ? 1 : 0);
  }
  if (typeof body.status === "string" && VALID_STATUS.has(body.status)) {
    sets.push("status = ?");
    args.push(body.status);
  }
  if (typeof body.ai_status === "string" && VALID_STATUS.has(body.ai_status)) {
    sets.push("ai_status = ?");
    args.push(body.ai_status);
  }
  if (typeof body.stage === "string" && body.stage.length < 32) {
    sets.push("stage = ?");
    args.push(body.stage);
  }

  if (sets.length === 1) {
    return NextResponse.json(
      { error: "no valid fields to update" },
      { status: 400 }
    );
  }

  args.push(id);

  try {
    await db().execute({
      sql: `UPDATE dm_threads SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[threads/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "thread id required" }, { status: 400 });
  }

  try {
    await db().execute({
      sql: "DELETE FROM dm_messages WHERE thread_id = ?",
      args: [id],
    });
    await db().execute({
      sql: "DELETE FROM python_outbound_queue WHERE thread_id = ?",
      args: [id],
    });
    await db().execute({
      sql: "DELETE FROM dm_threads WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[threads/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
