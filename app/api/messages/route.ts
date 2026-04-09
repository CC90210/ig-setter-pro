import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("thread_id");
  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }
  try {
    const result = await db().execute({
      sql: "SELECT * FROM dm_messages WHERE thread_id = ? ORDER BY sent_at ASC",
      args: [threadId],
    });
    return NextResponse.json({ messages: result.rows });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
