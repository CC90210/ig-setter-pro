import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";

// Row shape returned from the triggers query
interface CommentTriggerRow {
  id: string;
  keywords: string;
  match_type: string;
  require_follow: number;
  dm_message: string;
  dm_button_text: string | null;
  dm_button_url: string | null;
  follow_gate_message: string;
}

// POST — Called by Python daemon after Meta comment webhook fires
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    account_id: string;
    ig_media_id: string;
    ig_comment_id: string;
    ig_user_id: string;
    username?: string;
    comment_text: string;
    is_following?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.ig_comment_id || !body.ig_user_id || !body.comment_text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Dedup: same comment processed twice?
    const dup = await db().execute({
      sql: "SELECT id FROM comment_events WHERE ig_comment_id = ? LIMIT 1",
      args: [body.ig_comment_id],
    });
    if (dup.rows.length > 0) {
      return NextResponse.json({ ok: true, action: "duplicate" });
    }

    // Find active triggers for this post — post-specific triggers take priority over global ones.
    // ORDER BY ig_media_id IS NULL ASC: non-null (post-specific) rows sort before null (global) rows.
    const triggersResult = await db().execute({
      sql: `SELECT * FROM comment_triggers
            WHERE account_id = ? AND is_active = 1
              AND (ig_media_id = ? OR ig_media_id IS NULL)
            ORDER BY ig_media_id IS NULL ASC`,
      args: [body.account_id, body.ig_media_id],
    });

    const lowerComment = body.comment_text.toLowerCase().trim();
    let matchedTrigger: CommentTriggerRow | null = null;

    for (const row of triggersResult.rows) {
      const trigger = row as unknown as CommentTriggerRow;
      const keywords = trigger.keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);

      let matched = false;
      if (trigger.match_type === "any_comment") {
        matched = true;
      } else if (trigger.match_type === "exact") {
        matched = keywords.includes(lowerComment);
      } else {
        // contains
        matched = keywords.some((k) => lowerComment.includes(k));
      }

      if (matched) {
        matchedTrigger = trigger;
        break;
      }
    }

    if (!matchedTrigger) {
      return NextResponse.json({ ok: true, action: "no_match" });
    }

    // Follow gate check.
    // is_following defaults to true when the intake layer does not supply it (optimistic path),
    // so callers that skip the follow-check step still get DMs sent.
    const requiresFollow = !!matchedTrigger.require_follow;
    const isFollowing = body.is_following !== false;
    const actionTaken: "dm_sent" | "follow_gated" =
      requiresFollow && !isFollowing ? "follow_gated" : "dm_sent";

    const dmPayload =
      actionTaken === "follow_gated"
        ? { message: matchedTrigger.follow_gate_message, button_text: null, button_url: null }
        : {
            message: matchedTrigger.dm_message,
            button_text: matchedTrigger.dm_button_text,
            button_url: matchedTrigger.dm_button_url,
          };

    // Record event
    await db().execute({
      sql: `INSERT INTO comment_events (id, trigger_id, account_id, ig_comment_id, ig_user_id, username, comment_text, ig_media_id, action_taken)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        generateId(), matchedTrigger.id, body.account_id, body.ig_comment_id,
        body.ig_user_id, body.username || null, body.comment_text,
        body.ig_media_id, actionTaken,
      ],
    });

    // Increment trigger counters atomically
    const counterCol = actionTaken === "dm_sent" ? "times_sent" : "times_follow_gated";
    await db().execute({
      sql: `UPDATE comment_triggers
            SET times_triggered = times_triggered + 1,
                ${counterCol} = ${counterCol} + 1
            WHERE id = ?`,
      args: [matchedTrigger.id],
    });

    return NextResponse.json({
      ok: true,
      action: actionTaken,
      ig_user_id: body.ig_user_id,
      dm: dmPayload,
    });
  } catch (err) {
    console.error("[comment-webhook]", err);
    // Return 200 so the intake layer does not retry on transient errors
    return NextResponse.json({ ok: false, error: "internal" }, { status: 200 });
  }
}
