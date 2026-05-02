/**
 * GET /api/cron/send-outreach
 *
 * Pops the highest-priority queued prospect per account, generates a cold
 * opener via the doctrine (stage=cold), and returns the draft.
 *
 * Note: actual IG send is performed by the Python Playwright daemon (this endpoint returns the draft
 * for Python to route through the logged-in browser).
 *
 * Schedule in vercel.json. Idempotent per-prospect (status moves queued → sending).
 *
 * Query params:
 *   ?limit=5         — max prospects to process per run (default 3)
 *   ?account_id=X    — restrict to one account
 *
 * Auth: CRON_SECRET in Authorization header (Vercel Cron signs with this).
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId, type Prospect } from "@/lib/db";
import { respond } from "@/lib/claude/respond";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron auth: expects "Authorization: Bearer <CRON_SECRET>"
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${(process.env.CRON_SECRET || "").trim()}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    // Also accept x-cron-secret header for manual testing
    const header = (req.headers.get("x-cron-secret") || "").trim();
    if (!process.env.CRON_SECRET || header !== (process.env.CRON_SECRET || "").trim()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 3), 20);
  const accountFilter = req.nextUrl.searchParams.get("account_id");

  const now = new Date().toISOString();

  // Select prospects ready to send
  const whereParts = [
    "status = 'queued'",
    "(scheduled_for IS NULL OR scheduled_for <= ?)",
  ];
  const args: (string | number)[] = [now];
  if (accountFilter) {
    whereParts.push("account_id = ?");
    args.push(accountFilter);
  }

  const res = await db().execute({
    sql: `SELECT * FROM prospect_queue
          WHERE ${whereParts.join(" AND ")}
          ORDER BY priority DESC, scheduled_for ASC, created_at ASC
          LIMIT ?`,
    args: [...args, limit],
  });

  const prospects = res.rows as unknown as Prospect[];
  const processed: Array<{
    prospect_id: string;
    ig_username: string;
    account_id: string;
    draft: string | null;
    error: string | null;
  }> = [];

  for (const p of prospects) {
    // Atomically mark sending (avoid double-send if two cron runs overlap)
    const claim = await db().execute({
      sql: `UPDATE prospect_queue SET status = 'sending', attempts = attempts + 1, updated_at = ?
            WHERE id = ? AND status = 'queued'`,
      args: [now, p.id],
    });
    if (claim.rowsAffected === 0) continue;

    // Load account for context
    const acctRes = await db().execute({
      sql: "SELECT system_prompt, display_name FROM accounts WHERE id = ? LIMIT 1",
      args: [p.account_id],
    });
    const acct = acctRes.rows[0] as unknown as { system_prompt: string | null; display_name: string } | undefined;

    try {
      const out = await respond({
        stage: "cold",
        inbound: "",
        recentMessages: [],
        isFriend: false,
        objection: null,
        botCheck: false,
        accountSystemPrompt: acct?.system_prompt ?? null,
        accountDisplayName: acct?.display_name ?? null,
        prospectContext: {
          niche: p.niche ?? undefined,
          location: p.region ?? undefined,
          hook: p.personalization ?? p.reason ?? undefined,
          bio: p.bio_snippet ?? undefined,
        },
      });

      // Stays 'sending' — Python daemon must PATCH to 'sent' after Meta Graph API succeeds.
      // Draft is persisted in last_error column temporarily? No — store in a separate field.
      // For now the draft is returned in the response body for the Python sender.
      await db().execute({
        sql: `UPDATE prospect_queue SET personalization = ?, updated_at = ? WHERE id = ?`,
        args: [out.reply, now, p.id],
      });

      // Record cron-triggered outreach in audit
      await db().execute({
        sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
              VALUES (?, NULL, ?, NULL, 'cold', 'cron', ?, ?)`,
        args: [generateId(), p.account_id, `proactive_outreach:${p.ig_username}`, now],
      });

      processed.push({
        prospect_id: p.id,
        ig_username: p.ig_username,
        account_id: p.account_id,
        draft: out.reply,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[cron/send-outreach]", p.ig_username, msg);
      await db().execute({
        sql: `UPDATE prospect_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`,
        args: [msg.slice(0, 500), now, p.id],
      });
      processed.push({
        prospect_id: p.id,
        ig_username: p.ig_username,
        account_id: p.account_id,
        draft: null,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    prospects: processed,
  });
}
