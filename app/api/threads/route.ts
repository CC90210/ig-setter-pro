import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  try {
    if (accountId) {
      const result = await db().execute({
        sql: "SELECT * FROM dm_threads WHERE account_id = ? ORDER BY updated_at DESC",
        args: [accountId],
      });
      return NextResponse.json({ threads: result.rows });
    }
    const result = await db().execute(
      "SELECT * FROM dm_threads ORDER BY updated_at DESC"
    );
    return NextResponse.json({ threads: result.rows });
  } catch {
    return NextResponse.json({ threads: [] });
  }
}
