import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST — Called by Python daemon cron to refresh expiring tokens
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) {
    return NextResponse.json(
      { error: "FB_APP_ID and FB_APP_SECRET are not configured" },
      { status: 501 }
    );
  }

  // Find accounts with tokens expiring after now but within the next 7 days
  const now = new Date().toISOString();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const accountsResult = await db().execute({
    sql: "SELECT id, ig_username, ig_access_token, token_expires_at FROM accounts WHERE is_active = 1 AND token_expires_at > ? AND token_expires_at < ?",
    args: [now, sevenDaysFromNow],
  });

  const accounts = accountsResult.rows as unknown as Array<{
    id: string;
    ig_username: string;
    ig_access_token: string;
    token_expires_at: string;
  }>;

  const results: Array<{ account: string; success: boolean; error?: string }> = [];

  for (const account of accounts) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${account.ig_access_token}`
      );

      if (!res.ok) {
        results.push({ account: account.ig_username, success: false, error: "Token refresh failed" });
        continue;
      }

      const data = await res.json();
      const newToken = data.access_token as string;
      const expiresIn = (data.expires_in as number) || 5184000; // Default 60 days
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const updatedAt = new Date().toISOString();

      await db().execute({
        sql: "UPDATE accounts SET ig_access_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?",
        args: [newToken, expiresAt, updatedAt, account.id],
      });

      results.push({ account: account.ig_username, success: true });
    } catch (err) {
      console.error("[token-refresh]", err);
      results.push({ account: account.ig_username, success: false, error: "Token refresh failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    refreshed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
