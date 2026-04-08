import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — Called by n8n cron to refresh expiring tokens
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Find accounts with tokens expiring in the next 7 days
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, ig_username, ig_access_token, token_expires_at")
    .eq("is_active", true)
    .lt("token_expires_at", sevenDaysFromNow);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ account: string; success: boolean; error?: string }> = [];

  for (const account of accounts || []) {
    try {
      // Exchange for long-lived token via Facebook Graph API
      const res = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${account.ig_access_token}`
      );

      if (!res.ok) {
        const errText = await res.text();
        results.push({ account: account.ig_username, success: false, error: errText });
        continue;
      }

      const data = await res.json();
      const newToken = data.access_token;
      const expiresIn = data.expires_in || 5184000; // Default 60 days

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await supabase
        .from("accounts")
        .update({
          ig_access_token: newToken,
          token_expires_at: expiresAt,
          token_refreshed_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      results.push({ account: account.ig_username, success: true });
    } catch (err) {
      results.push({ account: account.ig_username, success: false, error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    refreshed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
