import { NextRequest, NextResponse } from "next/server";
import { db, uuid } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");

  try {
    let result;
    if (accountId) {
      result = await db().execute({
        sql: "SELECT * FROM automation_rules WHERE account_id = ? ORDER BY priority ASC",
        args: [accountId],
      });
    } else {
      result = await db().execute("SELECT * FROM automation_rules ORDER BY priority ASC");
    }
    return NextResponse.json({ rules: result.rows });
  } catch (err) {
    console.error("[automations/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    name: string;
    trigger_type: string;
    trigger_value: string;
    action_type: string;
    action_value: string;
    priority?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = uuid();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO automation_rules (id, account_id, name, trigger_type, trigger_value, action_type, action_value, priority, is_active, times_triggered, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      args: [
        id,
        body.account_id,
        body.name,
        body.trigger_type,
        body.trigger_value,
        body.action_type,
        body.action_value,
        body.priority ?? 0,
        now,
        now,
      ],
    });
    return NextResponse.json({ rule: { id } }, { status: 201 });
  } catch (err) {
    console.error("[automations/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM automation_rules WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[automations/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
