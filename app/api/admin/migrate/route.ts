/**
 * POST /api/admin/migrate
 *
 * Idempotently applies migration 004 (Setter Doctrine).
 * Protected by x-admin-secret header (CRON_SECRET value).
 *
 * Safe to call repeatedly — each statement uses IF NOT EXISTS / is_column_missing guards.
 * Run ONCE after deploying the doctrine build.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function columnExists(table: string, column: string): Promise<boolean> {
  const res = await db().execute(`PRAGMA table_info(${table})`);
  return (res.rows as unknown as Array<{ name: string }>).some((r) => r.name === column);
}

async function tableExists(table: string): Promise<boolean> {
  const res = await db().execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return res.rows.length > 0;
}

async function addColumnIfMissing(table: string, column: string, sqlDef: string): Promise<string> {
  if (await columnExists(table, column)) return `skip: ${table}.${column}`;
  await db().execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDef}`);
  return `added: ${table}.${column}`;
}

export async function POST(req: NextRequest) {
  const secret = (req.headers.get("x-admin-secret") || "").trim();
  const expected = (process.env.CRON_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // ── Columns on dm_threads ─────────────────────────────────────────
    results.push(await addColumnIfMissing("dm_threads", "stage",
      "TEXT NOT NULL DEFAULT 'cold' CHECK (stage IN ('cold','opener','qualify','pain','solution','objection','booked','closed_won','closed_lost','dead'))"));
    results.push(await addColumnIfMissing("dm_threads", "objection", "TEXT"));
    results.push(await addColumnIfMissing("dm_threads", "is_friend", "INTEGER NOT NULL DEFAULT 0"));
    results.push(await addColumnIfMissing("dm_threads", "region", "TEXT"));
    results.push(await addColumnIfMissing("dm_threads", "in_icp", "INTEGER NOT NULL DEFAULT 1"));
    results.push(await addColumnIfMissing("dm_threads", "signal_score", "INTEGER NOT NULL DEFAULT 0"));
    results.push(await addColumnIfMissing("dm_threads", "bot_check_count", "INTEGER NOT NULL DEFAULT 0"));
    results.push(await addColumnIfMissing("dm_threads", "last_inbound_at", "TEXT"));
    results.push(await addColumnIfMissing("dm_threads", "last_outbound_at", "TEXT"));
    results.push(await addColumnIfMissing("dm_threads", "last_stage_change_at", "TEXT"));

    // ── New tables ────────────────────────────────────────────────────
    if (!(await tableExists("stage_transitions"))) {
      await db().execute(`CREATE TABLE stage_transitions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        from_stage TEXT,
        to_stage TEXT NOT NULL,
        reason TEXT,
        triggered_by TEXT DEFAULT 'ai' CHECK (triggered_by IN ('ai','human','rule','cron')),
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      await db().execute(`CREATE INDEX idx_stage_transitions_thread ON stage_transitions(thread_id)`);
      await db().execute(`CREATE INDEX idx_stage_transitions_account_date ON stage_transitions(account_id, created_at DESC)`);
      results.push("created: stage_transitions");
    } else {
      results.push("skip: stage_transitions");
    }

    if (!(await tableExists("objection_history"))) {
      await db().execute(`CREATE TABLE objection_history (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        objection_type TEXT NOT NULL,
        inbound_message TEXT NOT NULL,
        rebuttal_sent TEXT,
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      await db().execute(`CREATE INDEX idx_objection_history_thread ON objection_history(thread_id)`);
      await db().execute(`CREATE INDEX idx_objection_history_type ON objection_history(objection_type)`);
      results.push("created: objection_history");
    } else {
      results.push("skip: objection_history");
    }

    if (!(await tableExists("prospect_queue"))) {
      await db().execute(`CREATE TABLE prospect_queue (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        ig_username TEXT NOT NULL,
        ig_user_id TEXT,
        display_name TEXT,
        profile_url TEXT,
        bio_snippet TEXT,
        follower_count INTEGER,
        niche TEXT,
        region TEXT,
        source TEXT,
        reason TEXT,
        personalization TEXT,
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','replied','skipped','failed','blocked')),
        priority INTEGER NOT NULL DEFAULT 50,
        scheduled_for TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        thread_id TEXT REFERENCES dm_threads(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT,
        replied_at TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(account_id, ig_username)
      )`);
      await db().execute(`CREATE INDEX idx_prospect_queue_account_status ON prospect_queue(account_id, status)`);
      await db().execute(`CREATE INDEX idx_prospect_queue_priority ON prospect_queue(priority DESC, scheduled_for ASC)`);
      results.push("created: prospect_queue");
    } else {
      results.push("skip: prospect_queue");
    }

    if (!(await tableExists("icp_configs"))) {
      await db().execute(`CREATE TABLE icp_configs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
        allowed_regions TEXT DEFAULT '[]',
        blocked_regions TEXT DEFAULT '[]',
        target_niches TEXT DEFAULT '[]',
        excluded_niches TEXT DEFAULT '[]',
        min_followers INTEGER DEFAULT 0,
        max_followers INTEGER,
        auto_archive_oop INTEGER NOT NULL DEFAULT 1,
        stale_days INTEGER NOT NULL DEFAULT 14,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`);
      await db().execute(`CREATE INDEX idx_icp_configs_account ON icp_configs(account_id)`);
      results.push("created: icp_configs");
    } else {
      results.push("skip: icp_configs");
    }

    // ── Indexes on dm_threads new columns (idempotent) ────────────────
    const indexes = [
      ["idx_dm_threads_stage", "dm_threads(stage)"],
      ["idx_dm_threads_account_stage", "dm_threads(account_id, stage)"],
      ["idx_dm_threads_last_inbound", "dm_threads(last_inbound_at)"],
    ];
    for (const [name, def] of indexes) {
      try {
        await db().execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${def}`);
        results.push(`index ok: ${name}`);
      } catch (e) {
        results.push(`index err: ${name} — ${(e as Error).message}`);
      }
    }

    // ── Backfill: set stage from status for existing threads ──────────
    const backfillStage = await db().execute(`
      UPDATE dm_threads SET stage = CASE
        WHEN status = 'qualified' AND stage = 'cold' THEN 'qualify'
        WHEN status = 'booked'    AND stage = 'cold' THEN 'booked'
        WHEN status = 'closed'    AND stage = 'cold' THEN 'closed_won'
        ELSE stage
      END
    `);
    results.push(`backfill status→stage: ${backfillStage.rowsAffected} rows`);

    const bumpOpener = await db().execute(`
      UPDATE dm_threads SET stage = 'opener'
      WHERE stage = 'cold'
        AND EXISTS (SELECT 1 FROM dm_messages m WHERE m.thread_id = dm_threads.id AND m.direction = 'inbound')
    `);
    results.push(`backfill cold→opener (have inbound): ${bumpOpener.rowsAffected} rows`);

    const backfillInbound = await db().execute(`
      UPDATE dm_threads SET last_inbound_at = (
        SELECT MAX(sent_at) FROM dm_messages WHERE thread_id = dm_threads.id AND direction = 'inbound'
      ) WHERE last_inbound_at IS NULL
    `);
    results.push(`backfill last_inbound_at: ${backfillInbound.rowsAffected} rows`);

    const backfillOutbound = await db().execute(`
      UPDATE dm_threads SET last_outbound_at = (
        SELECT MAX(sent_at) FROM dm_messages WHERE thread_id = dm_threads.id AND direction = 'outbound'
      ) WHERE last_outbound_at IS NULL
    `);
    results.push(`backfill last_outbound_at: ${backfillOutbound.rowsAffected} rows`);

    return NextResponse.json({
      ok: true,
      migration: "004_setter_doctrine",
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      error: msg,
      results,
    }, { status: 500 });
  }
}
