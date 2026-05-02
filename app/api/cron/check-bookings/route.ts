/**
 * GET /api/cron/check-bookings
 *
 * Polls Google Calendar for newly-booked appointments via the booked-slot
 * calendar. When a new event appears whose attendee email matches a thread
 * currently in `book_call` stage (or explicitly asked for the link), we:
 *   1. Transition the thread from `book_call` → `booked`
 *   2. Record the booking (booked_for, calendar_event_id, booking_email)
 *   3. Fire the teaser email via GWS CLI (PULSE lead-magnet teaser)
 *   4. Log the email send in email_log
 *
 * Scheduled via vercel.json (once daily on Hobby — 30min cadence on Pro).
 * Also callable manually with ?force=1 for testing.
 *
 * Env required:
 *   - CRON_SECRET
 *   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   - BOOKING_LINK (for reference in emails)
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getGoogleAccessToken(): Promise<string> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
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
  if (!res.ok) throw new Error(`Google token refresh ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

interface GCalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email?: string; responseStatus?: string; organizer?: boolean; self?: boolean }>;
  organizer?: { email?: string; self?: boolean };
  status?: string;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${(process.env.CRON_SECRET || "").trim()}`;
  if (!process.env.CRON_SECRET || (auth !== expected && (req.headers.get("x-cron-secret") || "").trim() !== process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    // Pull events from the primary calendar over the next 60 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 60 * 86_400_000).toISOString();
    const calUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    calUrl.searchParams.set("timeMin", timeMin);
    calUrl.searchParams.set("timeMax", timeMax);
    calUrl.searchParams.set("singleEvents", "true");
    calUrl.searchParams.set("orderBy", "startTime");
    calUrl.searchParams.set("maxResults", "50");

    const calRes = await fetch(calUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!calRes.ok) {
      const body = await calRes.text().catch(() => "");
      return NextResponse.json({ error: "Google Calendar API failed", status: calRes.status, body: body.slice(0, 300) }, { status: 500 });
    }
    const calJson = (await calRes.json()) as { items: GCalEvent[] };
    const events = calJson.items || [];

    const matched: Array<{ event_id: string; thread_id: string; email: string; start: string }> = [];
    const skipped: string[] = [];

    for (const ev of events) {
      if (!ev.id || ev.status === "cancelled") continue;
      const startIso = ev.start?.dateTime || ev.start?.date;
      if (!startIso) continue;

      // Dedup: have we seen this event?
      const seen = await db().execute({
        sql: "SELECT id FROM calendar_events_seen WHERE google_event_id = ? LIMIT 1",
        args: [ev.id],
      });
      if (seen.rows.length > 0) {
        skipped.push(ev.id);
        continue;
      }

      // Attendee filter: non-self, non-organizer = the prospect
      const attendees = (ev.attendees || []).filter(
        (a) => a.email && !a.self && !a.organizer && a.responseStatus !== "declined"
      );
      if (attendees.length === 0) continue;
      const prospectEmail = attendees[0].email!.toLowerCase();

      // Try to match a thread currently in book_call stage and awaiting booking
      const threadRes = await db().execute({
        sql: `SELECT id, account_id FROM dm_threads
              WHERE (booking_email = ? OR stage = 'book_call')
                AND (booked_for IS NULL)
              ORDER BY updated_at DESC
              LIMIT 1`,
        args: [prospectEmail],
      });

      const now = new Date().toISOString();
      const thread = threadRes.rows[0] as unknown as { id: string; account_id: string } | undefined;

      // Always record the event (even if no thread match — helpful for audit)
      const firstAccount = thread?.account_id || await firstAccountId();
      await db().execute({
        sql: `INSERT INTO calendar_events_seen (id, google_event_id, account_id, thread_id, attendee_email, summary, start_time, end_time, first_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          generateId(), ev.id, firstAccount, thread?.id || null,
          prospectEmail, ev.summary || "", startIso,
          ev.end?.dateTime || ev.end?.date || null, now,
        ],
      });

      if (!thread) continue;

      // Transition the thread: book_call → booked
      await db().execute({
        sql: `UPDATE dm_threads
              SET stage = 'booked',
                  booking_email = ?,
                  booked_for = ?,
                  calendar_event_id = ?,
                  last_stage_change_at = ?,
                  updated_at = ?
              WHERE id = ?`,
        args: [prospectEmail, startIso, ev.id, now, now, thread.id],
      });

      await db().execute({
        sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
              VALUES (?, ?, ?, 'book_call', 'booked', 'cron', 'calendar_event_detected', ?)`,
        args: [generateId(), thread.id, thread.account_id, now],
      });

      // Fire teaser email
      try {
        const teaserResult = await sendTeaserEmail(prospectEmail, startIso);
        await db().execute({
          sql: `UPDATE dm_threads SET teaser_sent_at = ? WHERE id = ?`,
          args: [now, thread.id],
        });
        await db().execute({
          sql: `INSERT INTO email_log (id, thread_id, account_id, email_type, recipient_email, subject, sent_at, provider_message_id)
                VALUES (?, ?, ?, 'teaser', ?, ?, ?, ?)`,
          args: [generateId(), thread.id, thread.account_id, prospectEmail, teaserResult.subject, now, teaserResult.messageId || null],
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await db().execute({
          sql: `INSERT INTO email_log (id, thread_id, account_id, email_type, recipient_email, subject, sent_at, error)
                VALUES (?, ?, ?, 'teaser', ?, ?, ?, ?)`,
          args: [generateId(), thread.id, thread.account_id, prospectEmail, "PULSE pre-call teaser", now, errMsg.slice(0, 400)],
        });
      }

      matched.push({ event_id: ev.id, thread_id: thread.id, email: prospectEmail, start: startIso });
    }

    return NextResponse.json({
      ok: true,
      scanned: events.length,
      new_bookings: matched.length,
      skipped_seen: skipped.length,
      matched,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function firstAccountId(): Promise<string> {
  const r = await db().execute("SELECT id FROM accounts WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1");
  return (r.rows[0] as unknown as { id: string })?.id || "";
}

/**
 * Sends the pre-call teaser via Gmail REST API (OAuth).
 * Email body is sourced from Maven's lead-magnet teaser template;
 * we hold the body in-line here because the Vercel function doesn't have
 * filesystem access to the Marketing-Agent repo at runtime.
 */
async function sendTeaserEmail(to: string, callStartIso: string): Promise<{ subject: string; messageId?: string }> {
  const token = await getGoogleAccessToken();
  const callDate = new Date(callStartIso).toLocaleString("en-US", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const subject = "locked in — quick read before we hop on";
  const body = [
    `hey —`,
    ``,
    `locked in for ${callDate}. google meet link is on the calendar invite.`,
    ``,
    `before we hop on, skim this so we can spend the 30 on YOUR setup, not the basics:`,
    `https://github.com/CC90210/ig-setter-pro/blob/main/README.md`,
    ``,
    `it's PULSE — the instagram DM system i built to replace manychat. you're getting the full repo right after our call.`,
    ``,
    `what to expect on the call:`,
    `- i show you the live dashboard, doctrine layer, and Python daemon pipeline running on my account`,
    `- you tell me your situation — DM volume, what you've tried, what's broken`,
    `- we figure out whether you install it yourself or oasis sets it up for you`,
    `- repo link hits your inbox within 30 min of us hanging up`,
    ``,
    `see you then,`,
    `conaugh`,
    `oasisai.work`,
  ].join("\n");

  const raw = buildMime(to, process.env.SENDER_EMAIL || "conaugh@oasisai.work", subject, body);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { id: string };
  return { subject, messageId: json.id };
}

function buildMime(to: string, from: string, subject: string, body: string): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
  ].join("\r\n");
  // Base64url encode
  const b64 = Buffer.from(lines, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
