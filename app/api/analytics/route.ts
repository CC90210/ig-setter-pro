import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d";

function getPeriodDays(period: Period): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
  }
}

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const periodParam = req.nextUrl.searchParams.get("period") ?? "30d";
  const period: Period = ["7d", "30d", "90d"].includes(periodParam)
    ? (periodParam as Period)
    : "30d";

  const days = getPeriodDays(period);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const accountArgs: (string | number | null)[] = accountId ? [accountId] : [];
    const accountFilter = accountId ? "WHERE account_id = ?" : "";
    const accountFilterAnd = accountId ? "AND account_id = ?" : "";

    // Subscribers aggregate
    const subscriberTotal = await db().execute({
      sql: `SELECT COUNT(*) as total, SUM(opted_in) as opted_in FROM subscribers ${accountFilter}`,
      args: accountArgs,
    });

    const subscriberNew = await db().execute({
      sql: `SELECT COUNT(*) as new_count FROM subscribers WHERE created_at >= ? ${accountFilterAnd}`,
      args: accountId ? [cutoff, accountId] : [cutoff],
    });

    // Message engagement from daily_stats
    const engagementResult = await db().execute({
      sql: `SELECT
              SUM(total_handled + replies_received) as total_messages,
              SUM(replies_received) as inbound,
              SUM(total_handled) as outbound,
              SUM(ai_drafts) as ai_drafts
            FROM daily_stats
            WHERE date >= ? ${accountFilterAnd}`,
      args: accountId ? [cutoff.split("T")[0], accountId] : [cutoff.split("T")[0]],
    });

    // Conversion funnel from daily_stats
    const funnelResult = await db().execute({
      sql: `SELECT
              SUM(total_handled + replies_received) as reached,
              SUM(replies_received) as engaged,
              SUM(qualified) as qualified,
              SUM(booked) as booked,
              SUM(closed) as closed,
              SUM(revenue) as revenue
            FROM daily_stats
            WHERE date >= ? ${accountFilterAnd}`,
      args: accountId ? [cutoff.split("T")[0], accountId] : [cutoff.split("T")[0]],
    });

    // Top automation triggers
    const topTriggersResult = await db().execute({
      sql: `SELECT id, name, times_triggered as times_triggered, 0 as times_sent
            FROM automation_rules
            WHERE times_triggered > 0 ${accountFilterAnd}
            ORDER BY times_triggered DESC
            LIMIT 5`,
      args: accountArgs,
    });

    // Top tags by subscriber count
    const topTagsResult = await db().execute({
      sql: `SELECT t.id, t.name, COUNT(st.subscriber_id) as subscriber_count
            FROM tags t
            LEFT JOIN subscriber_tags st ON st.tag_id = t.id
            ${accountId ? "WHERE t.account_id = ?" : ""}
            GROUP BY t.id
            ORDER BY subscriber_count DESC
            LIMIT 5`,
      args: accountArgs,
    });

    const subRow = subscriberTotal.rows[0] as unknown as { total: number; opted_in: number };
    const newRow = subscriberNew.rows[0] as unknown as { new_count: number };
    const engRow = engagementResult.rows[0] as unknown as {
      total_messages: number; inbound: number; outbound: number; ai_drafts: number;
    };
    const funnelRow = funnelResult.rows[0] as unknown as {
      reached: number; engaged: number; qualified: number;
      booked: number; closed: number; revenue: number;
    };

    return NextResponse.json({
      period,
      subscribers: {
        total: subRow?.total ?? 0,
        new_this_period: newRow?.new_count ?? 0,
        opted_in: subRow?.opted_in ?? 0,
      },
      engagement: {
        total_messages: engRow?.total_messages ?? 0,
        inbound: engRow?.inbound ?? 0,
        outbound: engRow?.outbound ?? 0,
        ai_drafts: engRow?.ai_drafts ?? 0,
      },
      conversion_funnel: {
        reached: funnelRow?.reached ?? 0,
        engaged: funnelRow?.engaged ?? 0,
        qualified: funnelRow?.qualified ?? 0,
        booked: funnelRow?.booked ?? 0,
        closed: funnelRow?.closed ?? 0,
        revenue: funnelRow?.revenue ?? 0,
      },
      top_triggers: topTriggersResult.rows,
      top_tags: topTagsResult.rows,
    });
  } catch (err) {
    console.error("[analytics/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
