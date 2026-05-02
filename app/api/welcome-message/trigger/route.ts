import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Called by the Python daemon when a NEW subscriber's first DM arrives.
// Returns the active welcome message for the account, or 404 if none/inactive.
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: { account_id: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const result = await db().execute({
      sql: "SELECT * FROM welcome_messages WHERE account_id = ? AND is_active = 1 LIMIT 1",
      args: [body.account_id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No active welcome message" }, { status: 404 });
    }

    const welcomeMsg = result.rows[0] as unknown as { id: string };

    // Increment times_sent counter (non-blocking)
    db()
      .execute({
        sql: "UPDATE welcome_messages SET times_sent = times_sent + 1 WHERE id = ?",
        args: [welcomeMsg.id],
      })
      .catch((err) => console.error("[welcome-message/trigger] times_sent error", err));

    return NextResponse.json({ welcome_message: result.rows[0] });
  } catch (err) {
    console.error("[welcome-message/trigger]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
