import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Internal endpoint — called by webhook/route.ts and n8n when a DM arrives.
// Upserts a subscriber row to keep the subscriber list in sync with DM traffic.
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    ig_user_id: string;
    username?: string;
    display_name?: string;
    source?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.ig_user_id) {
    return NextResponse.json({ error: "account_id and ig_user_id are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const existing = await db().execute({
      sql: "SELECT id FROM subscribers WHERE account_id = ? AND ig_user_id = ? LIMIT 1",
      args: [body.account_id, body.ig_user_id],
    });

    let subscriberId: string;
    let isNew = false;

    if (existing.rows.length === 0) {
      subscriberId = generateId();
      isNew = true;

      await db().execute({
        sql: `INSERT INTO subscribers
              (id, account_id, ig_user_id, username, display_name, source,
               first_interaction_at, last_interaction_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          subscriberId,
          body.account_id,
          body.ig_user_id,
          body.username ?? null,
          body.display_name ?? body.username ?? null,
          body.source ?? "dm",
          now,
          now,
          now,
          now,
        ],
      });
    } else {
      subscriberId = (existing.rows[0] as unknown as { id: string }).id;

      await db().execute({
        sql: `UPDATE subscribers
              SET username = ?, display_name = ?, last_interaction_at = ?, updated_at = ?
              WHERE id = ?`,
        args: [
          body.username ?? null,
          body.display_name ?? body.username ?? null,
          now,
          now,
          subscriberId,
        ],
      });
    }

    return NextResponse.json({ subscriber_id: subscriberId, is_new: isNew });
  } catch (err) {
    console.error("[subscribers/upsert-from-dm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
