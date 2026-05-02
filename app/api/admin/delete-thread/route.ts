/**
 * POST /api/admin/delete-thread
 *
 * Delete one or more dm_threads + their related rows by username
 * (case-insensitive). Use to remove fake/spam/test threads from PULSE.
 *
 * Body: { usernames: string[] }
 * Auth: x-webhook-secret header.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { usernames?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const usernames = (body.usernames || [])
    .map((u) => (u || "").trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  if (usernames.length === 0) {
    return NextResponse.json(
      { error: "usernames array required" },
      { status: 400 }
    );
  }

  const deleted: Record<string, { thread_id: string; messages_deleted: number }[]> = {};

  for (const uname of usernames) {
    try {
      const threadsRes = await db().execute({
        sql: "SELECT id FROM dm_threads WHERE LOWER(username) = ?",
        args: [uname],
      });

      const rows: { thread_id: string; messages_deleted: number }[] = [];
      for (const row of threadsRes.rows as unknown as Array<{ id: string }>) {
        const msgRes = await db().execute({
          sql: "SELECT COUNT(*) AS n FROM dm_messages WHERE thread_id = ?",
          args: [row.id],
        });
        const msgCount = Number(
          (msgRes.rows[0] as unknown as { n: number }).n ?? 0
        );

        // ON DELETE CASCADE in the schema removes dm_messages, but be explicit
        // for readability and so this still works if a future migration drops
        // the cascade.
        await db().execute({
          sql: "DELETE FROM dm_messages WHERE thread_id = ?",
          args: [row.id],
        });
        await db().execute({
          sql: "DELETE FROM python_outbound_queue WHERE thread_id = ?",
          args: [row.id],
        });
        await db().execute({
          sql: "DELETE FROM dm_threads WHERE id = ?",
          args: [row.id],
        });

        rows.push({ thread_id: row.id, messages_deleted: msgCount });
      }
      deleted[uname] = rows;
    } catch (err) {
      deleted[uname] = [
        { thread_id: "error", messages_deleted: 0 },
      ];
      console.error(`[admin/delete-thread] ${uname}:`, err);
    }
  }

  return NextResponse.json({ ok: true, deleted });
}
