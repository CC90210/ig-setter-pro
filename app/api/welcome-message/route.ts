import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const result = await db().execute({
      sql: "SELECT * FROM welcome_messages WHERE account_id = ? LIMIT 1",
      args: [accountId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ welcome_message: null });
    }

    return NextResponse.json({ welcome_message: result.rows[0] });
  } catch (err) {
    console.error("[welcome-message/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    message: string;
    is_active?: boolean;
    button_text?: string | null;
    button_url?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.message) {
    return NextResponse.json({ error: "account_id and message are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Check if one already exists (one per account)
    const existing = await db().execute({
      sql: "SELECT id FROM welcome_messages WHERE account_id = ? LIMIT 1",
      args: [body.account_id],
    });

    if (existing.rows.length > 0) {
      await db().execute({
        sql: `UPDATE welcome_messages
              SET message = ?, is_active = ?, button_text = ?, button_url = ?, updated_at = ?
              WHERE account_id = ?`,
        args: [
          body.message,
          body.is_active !== false ? 1 : 0,
          body.button_text ?? null,
          body.button_url ?? null,
          now,
          body.account_id,
        ],
      });
    } else {
      await db().execute({
        sql: `INSERT INTO welcome_messages (id, account_id, message, is_active, button_text, button_url, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          generateId(),
          body.account_id,
          body.message,
          body.is_active !== false ? 1 : 0,
          body.button_text ?? null,
          body.button_url ?? null,
          now,
          now,
        ],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[welcome-message/PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
