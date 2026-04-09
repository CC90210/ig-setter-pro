import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const today = new Date().toISOString().split("T")[0];
  try {
    if (accountId) {
      const result = await db().execute({
        sql: "SELECT * FROM daily_stats WHERE date = ? AND account_id = ? LIMIT 1",
        args: [today, accountId],
      });
      return NextResponse.json({ stats: result.rows[0] ?? null });
    }
    const result = await db().execute({
      sql: "SELECT * FROM daily_stats WHERE date = ? LIMIT 1",
      args: [today],
    });
    return NextResponse.json({ stats: result.rows[0] ?? null });
  } catch {
    return NextResponse.json({ stats: null });
  }
}
