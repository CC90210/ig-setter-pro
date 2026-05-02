import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AccountRow {
  ig_access_token: string;
  ig_page_id: string;
}

// GET — Proxy a follow-status check to the Meta Graph API.
// Called by the Python intake before invoking /api/comment-webhook when require_follow is set.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = req.nextUrl.searchParams.get("account_id");
  const igUserId = req.nextUrl.searchParams.get("ig_user_id");

  if (!accountId || !igUserId) {
    return NextResponse.json(
      { error: "account_id and ig_user_id required" },
      { status: 400 }
    );
  }

  try {
    const acctResult = await db().execute({
      sql: "SELECT ig_access_token, ig_page_id FROM accounts WHERE id = ? LIMIT 1",
      args: [accountId],
    });

    if (acctResult.rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const acct = acctResult.rows[0] as unknown as AccountRow;

    // Meta Graph API: retrieve the is_follower field for the given IG user relative
    // to the authenticated business account. This field is only available when the
    // access token belongs to the IG business account that the user may follow.
    const graphUrl =
      `https://graph.facebook.com/v19.0/${igUserId}` +
      `?fields=is_follower&access_token=${acct.ig_access_token}`;

    const res = await fetch(graphUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Fail open: if Graph API returns an error we cannot determine follow status,
      // so we report false and let the caller decide whether to gate or not.
      return NextResponse.json({ is_following: false, error: "Graph API error" });
    }

    const data = (await res.json()) as { is_follower?: boolean };
    return NextResponse.json({ is_following: !!data.is_follower });
  } catch (err) {
    console.error("[follow-check]", err);
    // Fail open on timeout/network errors rather than hard-blocking the DM flow
    return NextResponse.json({ is_following: false });
  }
}
