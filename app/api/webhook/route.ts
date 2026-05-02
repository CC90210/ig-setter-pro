import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { runDoctrine } from "@/lib/doctrine";

export const maxDuration = 30;

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

  const expectedToken = (process.env.WEBHOOK_VERIFY_TOKEN || "").trim();
  if (mode === "subscribe" && (token || "").trim() === expectedToken) {
    // Validate challenge is a reasonable string (Meta sends numeric strings)
    if (!challenge || challenge.length > 256) {
      return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
    }
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — Receives cleaned DM payload from Python daemon
export async function POST(req: NextRequest) {
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (secret !== expected) {
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

  // Input validation
  // Infer account_id from ig_thread_id if not supplied
  if (!body.account_id && body.ig_thread_id) {
    const pageId = body.ig_thread_id.split('_')[0];
    try {
      const acct = await db().execute({
        sql: "SELECT id FROM accounts WHERE ig_page_id = ? LIMIT 1",
        args: [pageId],
      });
      if (acct.rows.length > 0) {
        body.account_id = (acct.rows[0] as unknown as { id: string }).id;
      }
    } catch (e) {
      console.error("[webhook] account_id inference error:", e);
    }
  }

  if (!body.account_id || !body.ig_thread_id || !body.ig_user_id || !body.username || !body.message || !body.direction) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["inbound", "outbound"].includes(body.direction)) {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const validStatuses = ["active", "qualified", "booked", "closed"];
  if (body.status && !validStatuses.includes(body.status)) body.status = "active";
  if (body.ai_status && !validStatuses.includes(body.ai_status)) body.ai_status = "active";

  try {
    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const avatarColor = usernameToColor(body.username);
    const avatarInitial = (body.username || "?")[0].toUpperCase();

    // Dedup: check if this message was already processed (Meta sends at-least-once)
    if (body.ig_message_id) {
      const dup = await db().execute({
        sql: "SELECT id FROM dm_messages WHERE ig_message_id = ? LIMIT 1",
        args: [body.ig_message_id],
      });
      if (dup.rows.length > 0) {
        return NextResponse.json({ ok: true, deduplicated: true });
      }
    }

    // Check if thread exists (to detect status transitions)
    const existingThread = await db().execute({
      sql: "SELECT id, ai_status FROM dm_threads WHERE ig_thread_id = ? LIMIT 1",
      args: [body.ig_thread_id],
    });

    let threadId: string;
    let previousAiStatus: string | null = null;

    if (existingThread.rows.length > 0) {
      const existing = existingThread.rows[0] as unknown as { id: string; ai_status: string };
      threadId = existing.id;
      previousAiStatus = existing.ai_status;

      // Update existing thread (atomic message_count increment)
      await db().execute({
        sql: `UPDATE dm_threads SET
          ig_user_id = ?, username = ?, display_name = ?,
          avatar_initial = ?, avatar_color = ?,
          ai_status = ?, last_message = ?, last_timestamp = ?,
          pending_ai_draft = ?, message_count = message_count + 1, updated_at = ?
          WHERE id = ?`,
        args: [
          body.ig_user_id, body.username, body.display_name || body.username,
          avatarInitial, avatarColor,
          body.ai_status || "active", body.message, now,
          body.pending_ai_draft, now, threadId,
        ],
      });
    } else {
      // Insert new thread
      threadId = generateId();
      await db().execute({
        sql: `INSERT INTO dm_threads (id, account_id, ig_thread_id, ig_user_id, username, display_name,
          avatar_initial, avatar_color, status, ai_status, last_message, last_timestamp,
          pending_ai_draft, message_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [
          threadId, body.account_id, body.ig_thread_id, body.ig_user_id,
          body.username, body.display_name || body.username,
          avatarInitial, avatarColor,
          body.status || "active", body.ai_status || "active",
          body.message, now, body.pending_ai_draft, now, now,
        ],
      });
    }

    // Insert message
    await db().execute({
      sql: `INSERT INTO dm_messages (id, thread_id, account_id, ig_message_id, direction, content, sent_at, is_ai, override)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      args: [
        generateId(), threadId, body.account_id,
        body.ig_message_id || null, body.direction, body.message, now,
        body.is_ai ? 1 : 0,
      ],
    });

    // Atomic daily stats upsert (INSERT ... ON CONFLICT ... DO UPDATE)
    // Stats only increment on status TRANSITIONS, not every message
    const isInbound = body.direction === "inbound" ? 1 : 0;
    const statusChanged = body.ai_status && body.ai_status !== previousAiStatus;
    const qualifiedInc = statusChanged && body.ai_status === "qualified" ? 1 : 0;
    const bookedInc = statusChanged && body.ai_status === "booked" ? 1 : 0;
    const closedInc = statusChanged && body.ai_status === "closed" ? 1 : 0;
    const autoSentInc = body.direction === "outbound" && body.is_ai ? 1 : 0;
    const aiDraftInc = body.pending_ai_draft ? 1 : 0;

    await db().execute({
      sql: `INSERT INTO daily_stats (id, account_id, date, total_handled, qualified, booked, closed, revenue, replies_received, deals_progressed, auto_sent, ai_drafts)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
        ON CONFLICT(account_id, date) DO UPDATE SET
          total_handled = total_handled + excluded.total_handled,
          qualified = qualified + excluded.qualified,
          booked = booked + excluded.booked,
          closed = closed + excluded.closed,
          replies_received = replies_received + excluded.replies_received,
          auto_sent = auto_sent + excluded.auto_sent,
          ai_drafts = ai_drafts + excluded.ai_drafts`,
      args: [
        generateId(), body.account_id, today,
        isInbound, qualifiedInc, bookedInc, closedInc, isInbound, autoSentInc, aiDraftInc,
      ],
    });

    // Upsert subscriber (keep ManyChat-style subscriber list in sync)
    try {
      const existingSub = await db().execute({
        sql: "SELECT id FROM subscribers WHERE account_id = ? AND ig_user_id = ? LIMIT 1",
        args: [body.account_id, body.ig_user_id],
      });
      if (existingSub.rows.length === 0) {
        await db().execute({
          sql: `INSERT INTO subscribers (id, account_id, ig_user_id, username, display_name,
                source, first_interaction_at, last_interaction_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'dm', ?, ?, ?, ?)`,
          args: [
            generateId(), body.account_id, body.ig_user_id,
            body.username, body.display_name || body.username,
            now, now, now, now,
          ],
        });
      } else {
        await db().execute({
          sql: "UPDATE subscribers SET username = ?, display_name = ?, last_interaction_at = ?, updated_at = ? WHERE account_id = ? AND ig_user_id = ?",
          args: [body.username, body.display_name || body.username, now, now, body.account_id, body.ig_user_id],
        });
      }
    } catch (e) {
      console.error("[webhook] subscriber upsert", e);
    }

    // Check automation rules (wrapped in try/catch — must not crash the handler)
    if (body.direction === "inbound") {
      try {
        await checkAutomationRules(body.account_id, threadId, body.message);
      } catch (e) {
        console.error("[webhook] Automation rules error:", e);
      }
    }

    // Return account auto-send preference to the Python daemon.
    let autoSendEnabled = false;
    try {
      const acctResult = await db().execute({
        sql: "SELECT auto_send_enabled FROM accounts WHERE id = ? LIMIT 1",
        args: [body.account_id],
      });
      if (acctResult.rows.length > 0) {
        autoSendEnabled = !!(acctResult.rows[0] as unknown as { auto_send_enabled: number }).auto_send_enabled;
      }
    } catch {}

    // Run doctrine if:
    //  - inbound message
    //  - Python did not send a pre-generated draft (pending_ai_draft is null)
    //  - the ANTHROPIC_API_KEY is configured
    // This lets the dashboard generate an operator draft from raw Python intake.
    let doctrineResult: {
      draft: string;
      stage: string;
      previous_stage: string;
      stage_changed: boolean;
      objection: string | null;
      signal_score: number;
      bot_check: boolean;
    } | null = null;
    if (
      body.direction === "inbound" &&
      !body.pending_ai_draft &&
      process.env.ANTHROPIC_API_KEY
    ) {
      try {
        const r = await runDoctrine({
          accountId: body.account_id,
          threadId,
          inbound: body.message,
        });
        doctrineResult = {
          draft: r.draft,
          stage: r.nextStage,
          previous_stage: r.previousStage,
          stage_changed: r.stageChanged,
          objection: r.objection,
          signal_score: r.signalScore,
          bot_check: r.botCheck,
        };
        // Persist the generated draft to the thread
        if (r.draft) {
          await db().execute({
            sql: `UPDATE dm_threads SET pending_ai_draft = ?, updated_at = ? WHERE id = ?`,
            args: [r.draft, new Date().toISOString(), threadId],
          });
          await db().execute({
            sql: `UPDATE daily_stats SET ai_drafts = ai_drafts + 1 WHERE account_id = ? AND date = ?`,
            args: [body.account_id, today],
          });
        }
      } catch (e) {
        console.error("[webhook] doctrine run failed (non-fatal):", e);
      }
    }

    return NextResponse.json({
      ok: true,
      thread_id: threadId,
      auto_send_enabled: autoSendEnabled,
      doctrine: doctrineResult,
    });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    // Return 200 so Meta doesn't disable the webhook subscription
    return NextResponse.json({ ok: false, error: "internal" }, { status: 200 });
  }
}

async function checkAutomationRules(accountId: string, threadId: string, message: string) {
  const rulesResult = await db().execute({
    sql: "SELECT * FROM automation_rules WHERE account_id = ? AND is_active = 1 ORDER BY priority ASC",
    args: [accountId],
  });

  if (rulesResult.rows.length === 0) return;

  const lowerMsg = message.toLowerCase();
  const now = new Date().toISOString();

  for (const row of rulesResult.rows) {
    const rule = row as unknown as {
      id: string; trigger_type: string; trigger_value: string;
      action_type: string; action_value: string; times_triggered: number;
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
        triggered = cnt === 1;
        break;
      }
      case "story_reply":
        triggered = lowerMsg.includes("replied to your story");
        break;
    }

    if (triggered) {
      await db().execute({
        sql: "UPDATE automation_rules SET times_triggered = times_triggered + 1, updated_at = ? WHERE id = ?",
        args: [now, rule.id],
      });

      switch (rule.action_type) {
        case "change_status":
          await db().execute({
            sql: "UPDATE dm_threads SET status = ?, updated_at = ? WHERE id = ?",
            args: [rule.action_value, now, threadId],
          });
          break;
        case "start_sequence": {
          // Only re-enroll if previous enrollment is completed or cancelled
          const enrollResult = await db().execute({
            sql: "SELECT id, status FROM sequence_enrollments WHERE sequence_id = ? AND thread_id = ? LIMIT 1",
            args: [rule.action_value, threadId],
          });
          if (enrollResult.rows.length > 0) {
            const enrollment = enrollResult.rows[0] as unknown as { status: string };
            if (enrollment.status === "completed" || enrollment.status === "cancelled") {
              await db().execute({
                sql: "UPDATE sequence_enrollments SET current_step = 1, status = 'active', next_step_at = ?, completed_at = NULL WHERE sequence_id = ? AND thread_id = ?",
                args: [now, rule.action_value, threadId],
              });
            }
          } else {
            await db().execute({
              sql: "INSERT INTO sequence_enrollments (id, sequence_id, thread_id, current_step, status, next_step_at, enrolled_at) VALUES (?, ?, ?, 1, 'active', ?, ?)",
              args: [generateId(), rule.action_value, threadId, now, now],
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
