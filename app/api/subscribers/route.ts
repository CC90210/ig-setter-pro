import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const tagId = req.nextUrl.searchParams.get("tag_id");

  try {
    let result;

    if (tagId) {
      result = await db().execute({
        sql: `SELECT s.* FROM subscribers s
              INNER JOIN subscriber_tags st ON st.subscriber_id = s.id
              WHERE st.tag_id = ?
              ORDER BY s.last_interaction_at DESC`,
        args: [tagId],
      });
    } else if (accountId) {
      result = await db().execute({
        sql: "SELECT * FROM subscribers WHERE account_id = ? ORDER BY last_interaction_at DESC",
        args: [accountId],
      });
    } else {
      result = await db().execute(
        "SELECT * FROM subscribers ORDER BY last_interaction_at DESC"
      );
    }

    return NextResponse.json({ subscribers: result.rows });
  } catch (err) {
    console.error("[subscribers/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    ig_user_id: string;
    username?: string;
    display_name?: string;
    profile_pic_url?: string;
    source?: string;
    is_follower?: boolean;
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
    // Check if subscriber already exists (upsert semantics)
    const existing = await db().execute({
      sql: "SELECT id FROM subscribers WHERE account_id = ? AND ig_user_id = ? LIMIT 1",
      args: [body.account_id, body.ig_user_id],
    });

    if (existing.rows.length > 0) {
      const existingId = (existing.rows[0] as unknown as { id: string }).id;
      await db().execute({
        sql: `UPDATE subscribers SET
              username = ?, display_name = ?, profile_pic_url = ?,
              last_interaction_at = ?, updated_at = ?
              WHERE id = ?`,
        args: [
          body.username ?? null,
          body.display_name ?? body.username ?? null,
          body.profile_pic_url ?? null,
          now,
          now,
          existingId,
        ],
      });
      return NextResponse.json({ subscriber: { id: existingId }, upserted: true });
    }

    const id = generateId();
    await db().execute({
      sql: `INSERT INTO subscribers
            (id, account_id, ig_user_id, username, display_name, profile_pic_url,
             is_follower, opted_in, source, first_interaction_at, last_interaction_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.account_id,
        body.ig_user_id,
        body.username ?? null,
        body.display_name ?? body.username ?? null,
        body.profile_pic_url ?? null,
        body.is_follower ? 1 : 0,
        body.source ?? null,
        now,
        now,
        now,
        now,
      ],
    });

    return NextResponse.json({ subscriber: { id } }, { status: 201 });
  } catch (err) {
    console.error("[subscribers/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    id: string;
    custom_fields?: Record<string, unknown>;
    opted_in?: boolean;
    is_follower?: boolean;
    lifetime_value?: number;
    username?: string;
    display_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic SQL args array needs mixed types
    const args: Array<string | number | null> = [];

    if (body.custom_fields !== undefined) {
      fields.push("custom_fields = ?");
      args.push(JSON.stringify(body.custom_fields));
    }
    if (body.opted_in !== undefined) {
      fields.push("opted_in = ?");
      args.push(body.opted_in ? 1 : 0);
    }
    if (body.is_follower !== undefined) {
      fields.push("is_follower = ?");
      args.push(body.is_follower ? 1 : 0);
    }
    if (body.lifetime_value !== undefined) {
      fields.push("lifetime_value = ?");
      args.push(body.lifetime_value);
    }
    if (body.username !== undefined) {
      fields.push("username = ?");
      args.push(body.username);
    }
    if (body.display_name !== undefined) {
      fields.push("display_name = ?");
      args.push(body.display_name);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updated_at = ?");
    args.push(now);
    args.push(body.id);

    await db().execute({
      sql: `UPDATE subscribers SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribers/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM subscribers WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribers/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
