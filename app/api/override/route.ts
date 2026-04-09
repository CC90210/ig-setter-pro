import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: { thread_id: string; message: string };

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

  const n8nWebhookUrl = process.env.N8N_OVERRIDE_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    return NextResponse.json({ error: "N8N_OVERRIDE_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let n8nRes: Response;
  try {
    n8nRes = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ig_thread_id: thread.ig_thread_id,
        ig_user_id: thread.ig_user_id,
        account_id: thread.account_id,
        message: message.trim(),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "n8n request timed out" : "Failed to reach n8n" },
      { status: 502 }
    );
  }
  clearTimeout(timeoutId);

  if (!n8nRes.ok) {
    return NextResponse.json({ error: "Failed to send via n8n" }, { status: 502 });
  }

  const now = new Date().toISOString();

  // Record outbound message
  await db().execute({
    sql: `INSERT INTO dm_messages (id, thread_id, account_id, ig_message_id, direction, content, sent_at, is_ai, override)
          VALUES (?, ?, ?, NULL, 'outbound', ?, ?, 0, 1)`,
    args: [generateId(), thread_id, thread.account_id, message.trim(), now],
  });

  // Increment message count
  await db().execute({
    sql: "UPDATE dm_threads SET message_count = message_count + 1 WHERE id = ?",
    args: [thread_id],
  });

  // Clear pending draft and update thread
  await db().execute({
    sql: "UPDATE dm_threads SET pending_ai_draft = NULL, last_message = ?, last_timestamp = ?, updated_at = ? WHERE id = ?",
    args: [message.trim(), now, now, thread_id],
  });

  return NextResponse.json({ ok: true });
}
