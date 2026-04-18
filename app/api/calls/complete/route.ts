/**
 * POST /api/calls/complete
 *
 * Triggered manually from the dashboard (OverridePanel → "Mark call completed")
 * after CC finishes a 30-min call. Fires the repo-delivery email with the full
 * PULSE starter repo link, logs the send, flips the thread to closed_won.
 *
 * Body: { thread_id: string, outcome?: "won" | "lost", notes?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function getGoogleAccessToken(): Promise<string> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env vars");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token refresh ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function POST(req: NextRequest) {
  // Accept either the webhook-secret header (n8n / external callers) OR a same-origin
  // request from the dashboard UI. Dashboard pages are already behind whatever auth
  // wraps the app; exposing this to any same-origin caller is acceptable for the
  // single-operator dashboard design (CC is the only human using it).
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  const origin = req.headers.get("origin") || "";
  const host = req.headers.get("host") || "";
  const isSameOrigin = origin.includes(host) || origin === "";

  const authorized = (expected && secret === expected) || isSameOrigin;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { thread_id: string; outcome?: "won" | "lost"; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.thread_id) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  const threadRes = await db().execute({
    sql: `SELECT id, account_id, booking_email, username, display_name, stage, repo_delivered_at
          FROM dm_threads WHERE id = ? LIMIT 1`,
    args: [body.thread_id],
  });
  if (threadRes.rows.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  const t = threadRes.rows[0] as unknown as {
    id: string; account_id: string;
    booking_email: string | null;
    username: string; display_name: string;
    stage: string;
    repo_delivered_at: string | null;
  };

  if (!t.booking_email) {
    return NextResponse.json({ error: "No booking email on file — did they book via calendar?" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const nextStage = body.outcome === "lost" ? "closed_lost" : "closed_won";
  const alreadyDelivered = !!t.repo_delivered_at;

  // Flip stage + mark completed
  await db().execute({
    sql: `UPDATE dm_threads
          SET stage = ?,
              call_completed_at = ?,
              last_stage_change_at = ?,
              updated_at = ?
          WHERE id = ?`,
    args: [nextStage, now, now, now, body.thread_id],
  });
  await db().execute({
    sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
          VALUES (?, ?, ?, ?, ?, 'human', ?, ?)`,
    args: [generateId(), body.thread_id, t.account_id, t.stage, nextStage, body.notes || "call_completed", now],
  });

  // Send repo delivery email (only on WON — losers get nothing)
  let emailResult: { sent: boolean; error?: string; messageId?: string } = { sent: false };
  if (nextStage === "closed_won" && !alreadyDelivered) {
    try {
      emailResult = await sendRepoDeliveryEmail(t.booking_email, t.display_name || t.username);
      await db().execute({
        sql: `UPDATE dm_threads SET repo_delivered_at = ? WHERE id = ?`,
        args: [now, body.thread_id],
      });
      await db().execute({
        sql: `INSERT INTO email_log (id, thread_id, account_id, email_type, recipient_email, subject, sent_at, provider_message_id)
              VALUES (?, ?, ?, 'repo_delivery', ?, ?, ?, ?)`,
        args: [
          generateId(), body.thread_id, t.account_id,
          t.booking_email, "the full pulse repo — as promised",
          now, emailResult.messageId || null,
        ],
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      emailResult = { sent: false, error: errMsg };
      await db().execute({
        sql: `INSERT INTO email_log (id, thread_id, account_id, email_type, recipient_email, subject, sent_at, error)
              VALUES (?, ?, ?, 'repo_delivery', ?, ?, ?, ?)`,
        args: [
          generateId(), body.thread_id, t.account_id,
          t.booking_email, "the full pulse repo — as promised",
          now, errMsg.slice(0, 400),
        ],
      });
    }
  }

  return NextResponse.json({
    ok: true,
    thread_id: body.thread_id,
    new_stage: nextStage,
    email: emailResult,
  });
}

async function sendRepoDeliveryEmail(to: string, firstName: string): Promise<{ sent: boolean; messageId?: string }> {
  const token = await getGoogleAccessToken();
  const subject = "the full pulse repo — as promised";
  const body = [
    `${firstName.split(" ")[0]},`,
    ``,
    `as promised, here's the full repo:`,
    ``,
    `https://github.com/CC90210/ig-setter-pro`,
    ``,
    `start with SETUP.md — it's a sequential walkthrough (turso → n8n → meta app → vercel). 30 min if you have the accounts already, 60 if you're signing up fresh.`,
    ``,
    `three options from here, pick one and reply:`,
    ``,
    `1. you install it yourself this week — i'll answer questions via DM`,
    `2. you take your time, hit me when you're ready`,
    `3. oasis installs + maintains it for you (retainer)`,
    ``,
    `no pressure. you've got the repo. use it.`,
    ``,
    `conaugh`,
    `oasisai.work`,
    `book another call: https://calendar.app.google/tpfvJYBGircnGu8G8`,
  ].join("\n");

  const sender = process.env.SENDER_EMAIL || "conaugh@oasisai.work";
  const mime = [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ].join("\r\n");
  const raw = Buffer.from(mime, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { id: string };
  return { sent: true, messageId: json.id };
}
