import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: { broadcast_id: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.broadcast_id) {
    return NextResponse.json({ error: "broadcast_id is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Fetch the broadcast
    const broadcastResult = await db().execute({
      sql: "SELECT * FROM broadcasts WHERE id = ? LIMIT 1",
      args: [body.broadcast_id],
    });

    if (broadcastResult.rows.length === 0) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const broadcast = broadcastResult.rows[0] as unknown as {
      id: string;
      account_id: string;
      status: string;
      target_all: number;
      target_tag_ids: string;
    };

    if (broadcast.status === "sending" || broadcast.status === "sent") {
      return NextResponse.json({ error: "Broadcast already sent or in progress" }, { status: 409 });
    }

    // Resolve target subscribers
    let subscriberIds: string[] = [];

    if (broadcast.target_all) {
      const allResult = await db().execute({
        sql: "SELECT id FROM subscribers WHERE account_id = ? AND opted_in = 1",
        args: [broadcast.account_id],
      });
      subscriberIds = allResult.rows.map((r) => (r as unknown as { id: string }).id);
    } else {
      const tagIds: string[] = JSON.parse(broadcast.target_tag_ids || "[]");

      if (tagIds.length > 0) {
        // Build parameterized placeholders for the IN clause
        const placeholders = tagIds.map(() => "?").join(", ");
        const tagResult = await db().execute({
          sql: `SELECT DISTINCT s.id FROM subscribers s
                INNER JOIN subscriber_tags st ON st.subscriber_id = s.id
                WHERE st.tag_id IN (${placeholders}) AND s.opted_in = 1 AND s.account_id = ?`,
          args: [...tagIds, broadcast.account_id],
        });
        subscriberIds = tagResult.rows.map((r) => (r as unknown as { id: string }).id);
      }
    }

    const totalRecipients = subscriberIds.length;

    // Mark broadcast as sending
    await db().execute({
      sql: "UPDATE broadcasts SET status = 'sending', total_recipients = ?, updated_at = ? WHERE id = ?",
      args: [totalRecipients, now, body.broadcast_id],
    });

    // Create pending delivery rows for n8n to process
    for (const subscriberId of subscriberIds) {
      try {
        await db().execute({
          sql: `INSERT OR IGNORE INTO broadcast_deliveries (id, broadcast_id, subscriber_id, status)
                VALUES (?, ?, ?, 'pending')`,
          args: [generateId(), body.broadcast_id, subscriberId],
        });
      } catch (insertErr) {
        console.error("[broadcasts/send] delivery insert error", insertErr);
      }
    }

    // Fetch full recipient details for n8n dispatch
    const recipientsResult = await db().execute({
      sql: `SELECT s.id, s.ig_user_id, s.username, s.display_name
            FROM subscribers s
            INNER JOIN broadcast_deliveries bd ON bd.subscriber_id = s.id
            WHERE bd.broadcast_id = ? AND bd.status = 'pending'`,
      args: [body.broadcast_id],
    });

    return NextResponse.json({
      ok: true,
      broadcast_id: body.broadcast_id,
      total_recipients: totalRecipients,
      recipients: recipientsResult.rows,
    });
  } catch (err) {
    console.error("[broadcasts/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
