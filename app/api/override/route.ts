import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { thread_id: string; message: string; is_ai?: boolean };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { thread_id, message } = body;

  if (!thread_id || !message?.trim()) {
    return NextResponse.json({ error: "thread_id and message are required" }, { status: 400 });
  }

  // Fetch thread with account info
  const threadResult = await db().execute({
    sql: "SELECT ig_thread_id, ig_user_id, username, account_id FROM dm_threads WHERE id = ? LIMIT 1",
    args: [thread_id],
  });

  if (!threadResult.rows.length) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const thread = threadResult.rows[0] as unknown as {
    ig_thread_id: string;
    ig_user_id: string;
    username: string;
    account_id: string;
  };

  const now = new Date().toISOString();
  const queueId = generateId();

  // Queue the send for the Python Playwright daemon. The daemon records the
  // outbound message through /api/webhook only after Instagram confirms send.
  await db().execute({
    sql: `INSERT INTO python_outbound_queue
          (id, account_id, thread_id, ig_thread_id, ig_user_id, username, message,
           status, is_ai, attempts, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
    args: [
      queueId,
      thread.account_id,
      thread_id,
      thread.ig_thread_id,
      thread.ig_user_id,
      thread.username,
      message.trim(),
      body.is_ai ? 1 : 0,
      now,
      now,
    ],
  });

  if (body.is_ai) {
    await db().execute({
      sql: "UPDATE dm_threads SET pending_ai_draft = NULL, updated_at = ? WHERE id = ?",
      args: [now, thread_id],
    });
  }

  return NextResponse.json({ ok: true, queued: true, queue_id: queueId });
}
