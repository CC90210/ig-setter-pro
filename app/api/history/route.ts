import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = req.nextUrl.searchParams.get("thread_id");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  try {
    // Resolve by ig_thread_id (what n8n sends) or internal id
    const threadResult = await db().execute({
      sql: "SELECT id FROM dm_threads WHERE ig_thread_id = ? OR id = ? LIMIT 1",
      args: [threadId, threadId],
    });

    if (threadResult.rows.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    const dbThreadId = (threadResult.rows[0] as unknown as { id: string }).id;

    const result = await db().execute({
      sql: "SELECT direction, content, sent_at, is_ai FROM dm_messages WHERE thread_id = ? ORDER BY sent_at DESC LIMIT ?",
      args: [dbThreadId, limit],
    });

    return NextResponse.json({
      messages: (result.rows as unknown[]).reverse(),
    });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
