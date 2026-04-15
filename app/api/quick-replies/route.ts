import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const category = req.nextUrl.searchParams.get("category");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query args
    const args: any[] = [];
    const conditions: string[] = [];
    let sql = "SELECT * FROM quick_replies";

    if (accountId) {
      conditions.push("account_id = ?");
      args.push(accountId);
    }
    if (category) {
      conditions.push("category = ?");
      args.push(category);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY times_used DESC, label ASC";

    const result = await db().execute({ sql, args });
    return NextResponse.json({ quick_replies: result.rows });
  } catch (err) {
    console.error("[quick-replies/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    label: string;
    message: string;
    category?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.label || !body.message) {
    return NextResponse.json({ error: "account_id, label, and message are required" }, { status: 400 });
  }

  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO quick_replies (id, account_id, label, message, category, times_used, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [id, body.account_id, body.label, body.message, body.category ?? null, now],
    });

    return NextResponse.json({ quick_reply: { id } }, { status: 201 });
  } catch (err) {
    console.error("[quick-replies/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    id: string;
    label?: string;
    message?: string;
    category?: string | null;
    increment_used?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    if (body.increment_used) {
      await db().execute({
        sql: "UPDATE quick_replies SET times_used = times_used + 1 WHERE id = ?",
        args: [body.id],
      });
      return NextResponse.json({ ok: true });
    }

    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic SQL args
    const args: any[] = [];

    if (body.label !== undefined) { fields.push("label = ?"); args.push(body.label); }
    if (body.message !== undefined) { fields.push("message = ?"); args.push(body.message); }
    if (body.category !== undefined) { fields.push("category = ?"); args.push(body.category); }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    args.push(body.id);
    await db().execute({
      sql: `UPDATE quick_replies SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[quick-replies/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM quick_replies WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[quick-replies/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
