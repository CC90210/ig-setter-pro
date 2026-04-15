import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  const subscriberId = req.nextUrl.searchParams.get("subscriber_id");
  const sourceTriggerIdParam = req.nextUrl.searchParams.get("source_trigger_id");
  const dateFrom = req.nextUrl.searchParams.get("date_from");
  const dateTo = req.nextUrl.searchParams.get("date_to");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic query args
    const args: any[] = [];
    const conditions: string[] = [];
    let sql = "SELECT * FROM conversions";

    if (accountId) {
      conditions.push("account_id = ?");
      args.push(accountId);
    }
    if (subscriberId) {
      conditions.push("subscriber_id = ?");
      args.push(subscriberId);
    }
    if (sourceTriggerIdParam) {
      conditions.push("source_trigger_id = ?");
      args.push(sourceTriggerIdParam);
    }
    if (dateFrom) {
      conditions.push("created_at >= ?");
      args.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("created_at <= ?");
      args.push(dateTo);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const result = await db().execute({ sql, args });
    return NextResponse.json({ conversions: result.rows });
  } catch (err) {
    console.error("[conversions/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    event_type: string;
    subscriber_id?: string;
    thread_id?: string;
    source_trigger_id?: string;
    source_type?: string;
    value?: number;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.event_type) {
    return NextResponse.json({ error: "account_id and event_type are required" }, { status: 400 });
  }

  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO conversions
            (id, account_id, subscriber_id, thread_id, source_trigger_id, source_type,
             event_type, value, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.account_id,
        body.subscriber_id ?? null,
        body.thread_id ?? null,
        body.source_trigger_id ?? null,
        body.source_type ?? null,
        body.event_type,
        body.value ?? 0,
        body.notes ?? null,
        now,
      ],
    });

    // Update subscriber lifetime_value if provided
    if (body.subscriber_id && body.value && body.value > 0) {
      try {
        await db().execute({
          sql: "UPDATE subscribers SET lifetime_value = lifetime_value + ?, updated_at = ? WHERE id = ?",
          args: [body.value, now, body.subscriber_id],
        });
      } catch (lvErr) {
        console.error("[conversions] lifetime_value update error", lvErr);
      }
    }

    return NextResponse.json({ conversion: { id } }, { status: 201 });
  } catch (err) {
    console.error("[conversions/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
