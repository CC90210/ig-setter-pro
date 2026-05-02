import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function requirePythonDaemon(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = requirePythonDaemon(req);
  if (authError) return authError;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 5), 20);
  const accountId = req.nextUrl.searchParams.get("account_id");
  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const where = [
    "(status = 'pending' OR (status = 'sending' AND (claimed_at IS NULL OR claimed_at < ?)))",
    "attempts < 5",
  ];
  const args: Array<string | number> = [staleCutoff];
  if (accountId) {
    where.push("account_id = ?");
    args.push(accountId);
  }

  const pending = await db().execute({
    sql: `SELECT id, account_id, thread_id, ig_thread_id, ig_user_id, username,
                 message, status, is_ai, attempts
          FROM python_outbound_queue
          WHERE ${where.join(" AND ")}
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [...args, limit],
  });

  const commands = [];
  for (const row of pending.rows as unknown as Array<{ id: string }>) {
    const claimed = await db().execute({
      sql: `UPDATE python_outbound_queue
            SET status = 'sending', attempts = attempts + 1,
                claimed_at = ?, updated_at = ?
            WHERE id = ?
              AND attempts < 5
              AND (status = 'pending' OR (status = 'sending' AND (claimed_at IS NULL OR claimed_at < ?)))`,
      args: [now, now, row.id, staleCutoff],
    });
    if (claimed.rowsAffected > 0) commands.push(row);
  }

  return NextResponse.json({ ok: true, commands });
}

export async function POST(req: NextRequest) {
  const authError = requirePythonDaemon(req);
  if (authError) return authError;

  let body: { id: string; status: "sent" | "failed"; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !["sent", "failed"].includes(body.status)) {
    return NextResponse.json({ error: "id and valid status are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db().execute({
    sql: `UPDATE python_outbound_queue
          SET status = ?, last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END,
              updated_at = ?
          WHERE id = ?`,
    args: [
      body.status,
      body.status === "failed" ? (body.error || "Python daemon send failed").slice(0, 500) : null,
      body.status,
      now,
      now,
      body.id,
    ],
  });

  return NextResponse.json({ ok: true });
}
