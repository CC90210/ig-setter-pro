import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list triggers for an account
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  try {
    let result;
    if (accountId) {
      result = await db().execute({
        sql: "SELECT * FROM comment_triggers WHERE account_id = ? ORDER BY created_at DESC",
        args: [accountId],
      });
    } else {
      result = await db().execute("SELECT * FROM comment_triggers ORDER BY created_at DESC");
    }
    return NextResponse.json({ triggers: result.rows });
  } catch (err) {
    console.error("[comment-triggers GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create trigger
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    name: string;
    ig_media_id?: string;
    keywords: string;
    match_type?: string;
    require_follow?: boolean;
    dm_message: string;
    dm_button_text?: string;
    dm_button_url?: string;
    follow_gate_message?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.name || !body.keywords || !body.dm_message) {
    return NextResponse.json(
      { error: "account_id, name, keywords, and dm_message required" },
      { status: 400 }
    );
  }

  const matchType = body.match_type || "contains";
  if (!["exact", "contains", "any_comment"].includes(matchType)) {
    return NextResponse.json({ error: "Invalid match_type" }, { status: 400 });
  }

  try {
    const id = generateId();
    await db().execute({
      sql: `INSERT INTO comment_triggers (id, account_id, name, ig_media_id, keywords, match_type, require_follow, dm_message, dm_button_text, dm_button_url, follow_gate_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, body.account_id, body.name, body.ig_media_id || null,
        body.keywords, matchType, body.require_follow === false ? 0 : 1,
        body.dm_message, body.dm_button_text || null, body.dm_button_url || null,
        body.follow_gate_message || "Follow me first, then comment again to unlock!",
      ],
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[comment-triggers POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update trigger
export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = [
    "name", "keywords", "match_type", "require_follow", "dm_message",
    "dm_button_text", "dm_button_url", "follow_gate_message", "is_active", "ig_media_id",
  ];
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`);
      const val = body[key];
      if (typeof val === "boolean") {
        args.push(val ? 1 : 0);
      } else if (typeof val === "string" || typeof val === "number" || val === null) {
        args.push(val);
      } else {
        args.push(String(val));
      }
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  args.push(body.id as string);
  try {
    await db().execute({
      sql: `UPDATE comment_triggers SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
      args,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-triggers PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove trigger
export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM comment_triggers WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-triggers DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
