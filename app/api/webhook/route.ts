import { NextRequest, NextResponse } from "next/server";
import { db, uuid } from "@/lib/db";

const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F8C471", "#82E0AA", "#F1948A", "#AED6F1", "#D7BDE2",
];

function usernameToColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — Receives cleaned DM payload from n8n
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    account_id: string;
    ig_thread_id: string;
    ig_user_id: string;
    username: string;
    display_name: string;
    message: string;
    direction: "inbound" | "outbound";
    status: string;
    ai_status: string;
    pending_ai_draft: string | null;
    is_ai: boolean;
    ig_message_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const avatarColor = usernameToColor(body.username);
  const avatarInitial = (body.username || "?")[0].toUpperCase();

  // Check if thread exists
  const existingThread = await db().execute({
    sql: "SELECT id, message_count FROM dm_threads WHERE ig_thread_id = ? LIMIT 1",
    args: [body.ig_thread_id],
  });

  let threadId: string;
  let messageCount: number;

  if (existingThread.rows.length > 0) {
    const t = existingThread.rows[0] as unknown as { id: string; message_count: number };
    threadId = t.id;
    messageCount = t.message_count || 0;

    await db().execute({
      sql: `UPDATE dm_threads SET ig_user_id = ?, username = ?, display_name = ?, avatar_initial = ?, avatar_color = ?,
            status = ?, ai_status = ?, last_message = ?, last_timestamp = ?, pending_ai_draft = ?, updated_at = ?
            WHERE id = ?`,
      args: [
        body.ig_user_id,
        body.username,
        body.display_name || body.username,
        avatarInitial,
        avatarColor,
        body.status || "active",
        body.ai_status || "active",
        body.message,
        now,
        body.pending_ai_draft,
        now,
        threadId,
      ],
    });
  } else {
    threadId = uuid();
    messageCount = 0;

    await db().execute({
      sql: `INSERT INTO dm_threads (id, account_id, ig_thread_id, ig_user_id, username, display_name, avatar_initial, avatar_color,
            status, ai_status, last_message, last_timestamp, pending_ai_draft, message_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [
        threadId,
        body.account_id,
        body.ig_thread_id,
        body.ig_user_id,
        body.username,
        body.display_name || body.username,
        avatarInitial,
        avatarColor,
        body.status || "active",
        body.ai_status || "active",
        body.message,
        now,
        body.pending_ai_draft,
        now,
        now,
      ],
    });
  }

  // Insert message
  await db().execute({
    sql: `INSERT INTO dm_messages (id, thread_id, account_id, ig_message_id, direction, content, sent_at, is_ai, override)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    args: [
      uuid(),
      threadId,
      body.account_id,
      body.ig_message_id || null,
      body.direction,
      body.message,
      now,
      body.is_ai ? 1 : 0,
    ],
  });

  // Update message count
  await db().execute({
    sql: "UPDATE dm_threads SET message_count = ? WHERE id = ?",
    args: [messageCount + 1, threadId],
  });

  // Upsert daily stats
  const today = now.split("T")[0];
  const statsResult = await db().execute({
    sql: "SELECT * FROM daily_stats WHERE account_id = ? AND date = ? LIMIT 1",
    args: [body.account_id, today],
  });

  if (statsResult.rows.length > 0) {
    const existing = statsResult.rows[0] as unknown as Record<string, number> & { id: string };
    const updates: Record<string, number> = {};

    if (body.direction === "inbound") {
      updates.total_handled = (existing.total_handled || 0) + 1;
      updates.replies_received = (existing.replies_received || 0) + 1;
    }
    if (body.ai_status === "qualified") updates.qualified = (existing.qualified || 0) + 1;
    if (body.ai_status === "booked") updates.booked = (existing.booked || 0) + 1;
    if (body.ai_status === "closed") updates.closed = (existing.closed || 0) + 1;
    if (body.is_ai) updates.ai_drafts = (existing.ai_drafts || 0) + 1;

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
      await db().execute({
        sql: `UPDATE daily_stats SET ${setClauses} WHERE id = ?`,
        args: [...Object.values(updates), existing.id],
      });
    }
  } else {
    const newStats: Record<string, number | string> = {
      id: uuid(),
      account_id: body.account_id,
      date: today,
      total_handled: body.direction === "inbound" ? 1 : 0,
      qualified: body.ai_status === "qualified" ? 1 : 0,
      booked: body.ai_status === "booked" ? 1 : 0,
      closed: body.ai_status === "closed" ? 1 : 0,
      revenue: 0,
      replies_received: body.direction === "inbound" ? 1 : 0,
      deals_progressed: 0,
      auto_sent: 0,
      ai_drafts: body.is_ai ? 1 : 0,
    };

    await db().execute({
      sql: `INSERT INTO daily_stats (id, account_id, date, total_handled, qualified, booked, closed, revenue, replies_received, deals_progressed, auto_sent, ai_drafts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newStats.id, newStats.account_id, newStats.date,
        newStats.total_handled, newStats.qualified, newStats.booked,
        newStats.closed, newStats.revenue, newStats.replies_received,
        newStats.deals_progressed, newStats.auto_sent, newStats.ai_drafts,
      ],
    });
  }

  // Check automation rules (if inbound)
  if (body.direction === "inbound") {
    await checkAutomationRules(body.account_id, threadId, body.message);
  }

  return NextResponse.json({ ok: true, thread_id: threadId });
}

async function checkAutomationRules(accountId: string, threadId: string, message: string) {
  const rulesResult = await db().execute({
    sql: "SELECT * FROM automation_rules WHERE account_id = ? AND is_active = 1 ORDER BY priority ASC",
    args: [accountId],
  });

  if (!rulesResult.rows.length) return;

  const lowerMsg = message.toLowerCase();

  for (const ruleRow of rulesResult.rows) {
    const rule = ruleRow as unknown as {
      id: string;
      trigger_type: string;
      trigger_value: string;
      action_type: string;
      action_value: string;
      times_triggered: number;
    };

    let triggered = false;

    switch (rule.trigger_type) {
      case "keyword":
        triggered = rule.trigger_value
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .some((keyword: string) => lowerMsg.includes(keyword));
        break;
      case "first_message": {
        const countResult = await db().execute({
          sql: "SELECT COUNT(*) as cnt FROM dm_messages WHERE thread_id = ?",
          args: [threadId],
        });
        const cnt = (countResult.rows[0] as unknown as { cnt: number }).cnt;
        triggered = cnt <= 1;
        break;
      }
      case "story_reply":
        triggered = lowerMsg.includes("replied to your story");
        break;
    }

    if (triggered) {
      await db().execute({
        sql: "UPDATE automation_rules SET times_triggered = ? WHERE id = ?",
        args: [(rule.times_triggered || 0) + 1, rule.id],
      });

      switch (rule.action_type) {
        case "change_status":
          await db().execute({
            sql: "UPDATE dm_threads SET status = ? WHERE id = ?",
            args: [rule.action_value, threadId],
          });
          break;
        case "start_sequence": {
          const now = new Date().toISOString();
          const enrollResult = await db().execute({
            sql: "SELECT id FROM sequence_enrollments WHERE sequence_id = ? AND thread_id = ? LIMIT 1",
            args: [rule.action_value, threadId],
          });
          if (enrollResult.rows.length > 0) {
            await db().execute({
              sql: "UPDATE sequence_enrollments SET current_step = 1, status = 'active', next_step_at = ? WHERE sequence_id = ? AND thread_id = ?",
              args: [now, rule.action_value, threadId],
            });
          } else {
            await db().execute({
              sql: `INSERT INTO sequence_enrollments (id, sequence_id, thread_id, current_step, status, next_step_at, enrolled_at)
                    VALUES (?, ?, ?, 1, 'active', ?, ?)`,
              args: [uuid(), rule.action_value, threadId, now, now],
            });
          }
          break;
        }
      }
      // Only fire the highest-priority matching rule
      break;
    }
  }
}
