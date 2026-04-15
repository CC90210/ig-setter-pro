import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");

  try {
    let result;

    if (accountId) {
      result = await db().execute({
        sql: `SELECT t.*, COUNT(st.subscriber_id) as subscriber_count
              FROM tags t
              LEFT JOIN subscriber_tags st ON st.tag_id = t.id
              WHERE t.account_id = ?
              GROUP BY t.id
              ORDER BY t.name ASC`,
        args: [accountId],
      });
    } else {
      result = await db().execute(
        `SELECT t.*, COUNT(st.subscriber_id) as subscriber_count
         FROM tags t
         LEFT JOIN subscriber_tags st ON st.tag_id = t.id
         GROUP BY t.id
         ORDER BY t.name ASC`
      );
    }

    return NextResponse.json({ tags: result.rows });
  } catch (err) {
    console.error("[tags/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    name: string;
    color?: string;
    description?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.name) {
    return NextResponse.json({ error: "account_id and name are required" }, { status: 400 });
  }

  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO tags (id, account_id, name, color, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.account_id,
        body.name.trim(),
        body.color ?? "#00FFAB",
        body.description ?? null,
        now,
      ],
    });

    return NextResponse.json({ tag: { id } }, { status: 201 });
  } catch (err) {
    // SQLite unique constraint violation
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "Tag name already exists for this account" }, { status: 409 });
    }
    console.error("[tags/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM tags WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tags/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
