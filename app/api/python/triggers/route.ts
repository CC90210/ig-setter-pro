import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Python daemon fetches active comment triggers to know which posts to poll.
export async function GET(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("account_id");

  const where = ["is_active = 1", "ig_media_id IS NOT NULL"];
  const args: string[] = [];
  if (accountId) {
    where.push("account_id = ?");
    args.push(accountId);
  }

  const result = await db().execute({
    sql: `SELECT id, account_id, ig_media_id, keywords, match_type, require_follow,
                 dm_message, dm_button_url
          FROM comment_triggers
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC`,
    args,
  });

  return NextResponse.json({ ok: true, triggers: result.rows });
}
