import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const status = req.nextUrl.searchParams.get("status");

  try {
    let sql = "SELECT * FROM broadcasts";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query args
    const args: Array<string | number | null> = [];
    const conditions: string[] = [];

    if (accountId) {
      conditions.push("account_id = ?");
      args.push(accountId);
    }
    if (status) {
      conditions.push("status = ?");
      args.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const result = await db().execute({ sql, args });
    return NextResponse.json({ broadcasts: result.rows });
  } catch (err) {
    console.error("[broadcasts/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    name: string;
    message: string;
    button_text?: string;
    button_url?: string;
    target_tag_ids?: string[];
    target_all?: boolean;
    scheduled_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.name || !body.message) {
    return NextResponse.json({ error: "account_id, name, and message are required" }, { status: 400 });
  }

  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO broadcasts
            (id, account_id, name, message, button_text, button_url,
             target_tag_ids, target_all, status, scheduled_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      args: [
        id,
        body.account_id,
        body.name,
        body.message,
        body.button_text ?? null,
        body.button_url ?? null,
        JSON.stringify(body.target_tag_ids ?? []),
        body.target_all ? 1 : 0,
        body.scheduled_at ?? null,
        now,
        now,
      ],
    });

    return NextResponse.json({ broadcast: { id } }, { status: 201 });
  } catch (err) {
    console.error("[broadcasts/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    id: string;
    name?: string;
    message?: string;
    button_text?: string | null;
    button_url?: string | null;
    target_tag_ids?: string[];
    target_all?: boolean;
    scheduled_at?: string | null;
    status?: "draft" | "scheduled" | "sending" | "sent" | "failed";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic SQL args array
    const args: Array<string | number | null> = [];

    if (body.name !== undefined) { fields.push("name = ?"); args.push(body.name); }
    if (body.message !== undefined) { fields.push("message = ?"); args.push(body.message); }
    if (body.button_text !== undefined) { fields.push("button_text = ?"); args.push(body.button_text); }
    if (body.button_url !== undefined) { fields.push("button_url = ?"); args.push(body.button_url); }
    if (body.target_tag_ids !== undefined) { fields.push("target_tag_ids = ?"); args.push(JSON.stringify(body.target_tag_ids)); }
    if (body.target_all !== undefined) { fields.push("target_all = ?"); args.push(body.target_all ? 1 : 0); }
    if (body.scheduled_at !== undefined) { fields.push("scheduled_at = ?"); args.push(body.scheduled_at); }
    if (body.status !== undefined) { fields.push("status = ?"); args.push(body.status); }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updated_at = ?");
    args.push(now);
    args.push(body.id);

    await db().execute({
      sql: `UPDATE broadcasts SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[broadcasts/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM broadcasts WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[broadcasts/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
