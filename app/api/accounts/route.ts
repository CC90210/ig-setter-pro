import { NextRequest, NextResponse } from "next/server";
import { db, uuid } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const result = await db().execute(
      "SELECT id, ig_username, ig_page_id, auto_send_enabled, display_name, is_active, token_expires_at, created_at, updated_at FROM accounts ORDER BY created_at ASC"
    );
    return NextResponse.json({ accounts: result.rows });
  } catch (err) {
    console.error("[accounts/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    ig_username: string;
    ig_page_id: string;
    ig_access_token: string;
    display_name: string;
    auto_send_enabled?: boolean;
    system_prompt?: string;
    token_expires_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.ig_username || !body.ig_page_id || !body.ig_access_token) {
    return NextResponse.json(
      { error: "ig_username, ig_page_id, and ig_access_token are required" },
      { status: 400 }
    );
  }

  const id = uuid();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO accounts (id, ig_username, ig_page_id, ig_access_token, display_name, auto_send_enabled, system_prompt, token_expires_at, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        id,
        body.ig_username,
        body.ig_page_id,
        body.ig_access_token,
        body.display_name || body.ig_username,
        body.auto_send_enabled ? 1 : 0,
        body.system_prompt || null,
        body.token_expires_at || null,
        now,
        now,
      ],
    });
    return NextResponse.json({ account: { id, ig_username: body.ig_username } }, { status: 201 });
  } catch (err) {
    console.error("[accounts/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    id: string;
    auto_send_enabled?: boolean;
    system_prompt?: string;
    display_name?: string;
    is_active?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const setClauses: string[] = ["updated_at = ?"];
  const args: (string | number | null)[] = [new Date().toISOString()];

  if (body.auto_send_enabled !== undefined) {
    setClauses.push("auto_send_enabled = ?");
    args.push(body.auto_send_enabled ? 1 : 0);
  }
  if (body.system_prompt !== undefined) {
    setClauses.push("system_prompt = ?");
    args.push(body.system_prompt);
  }
  if (body.display_name !== undefined) {
    setClauses.push("display_name = ?");
    args.push(body.display_name);
  }
  if (body.is_active !== undefined) {
    setClauses.push("is_active = ?");
    args.push(body.is_active ? 1 : 0);
  }

  args.push(body.id);

  try {
    await db().execute({
      sql: `UPDATE accounts SET ${setClauses.join(", ")} WHERE id = ?`,
      args,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[accounts/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
