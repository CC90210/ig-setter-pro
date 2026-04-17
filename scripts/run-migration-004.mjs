#!/usr/bin/env node
/**
 * Run migration 004 against Turso using the @libsql/client HTTP driver.
 * Each statement is idempotent via IF NOT EXISTS / column existence guards.
 *
 * Usage: node scripts/run-migration-004.mjs
 * (reads TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from .env.local)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client/http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Parse .env.local manually (avoid dotenv dep)
const envPath = resolve(repoRoot, ".env.local");
const envRaw = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return idx === -1 ? [l, ""] : [l.slice(0, idx), l.slice(idx + 1)];
    })
);

const rawUrl = (env.TURSO_DATABASE_URL || "").trim();
const authToken = (env.TURSO_AUTH_TOKEN || "").trim();
if (!rawUrl) throw new Error("TURSO_DATABASE_URL missing");
const url = rawUrl.replace(/^libsql:\/\//, "https://");
const db = createClient({ url, authToken });

async function columnExists(table, column) {
  const res = await db.execute(`PRAGMA table_info(${table})`);
  return res.rows.some((r) => r.name === column);
}

async function tableExists(table) {
  const res = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return res.rows.length > 0;
}

async function addColumn(table, column, def) {
  if (await columnExists(table, column)) {
    console.log(`  skip  ${table}.${column} (exists)`);
    return;
  }
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  console.log(`  +     ${table}.${column}`);
}

async function run() {
  console.log(`Running migration 004 against ${url}`);

  // ── dm_threads columns ────────────────────────────────────────────
  console.log("\n[1/4] dm_threads doctrine columns");
  await addColumn("dm_threads", "stage",
    "TEXT NOT NULL DEFAULT 'cold' CHECK (stage IN ('cold','opener','qualify','pain','solution','objection','booked','closed_won','closed_lost','dead'))");
  await addColumn("dm_threads", "objection", "TEXT");
  await addColumn("dm_threads", "is_friend", "INTEGER NOT NULL DEFAULT 0");
  await addColumn("dm_threads", "region", "TEXT");
  await addColumn("dm_threads", "in_icp", "INTEGER NOT NULL DEFAULT 1");
  await addColumn("dm_threads", "signal_score", "INTEGER NOT NULL DEFAULT 0");
  await addColumn("dm_threads", "bot_check_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumn("dm_threads", "last_inbound_at", "TEXT");
  await addColumn("dm_threads", "last_outbound_at", "TEXT");
  await addColumn("dm_threads", "last_stage_change_at", "TEXT");

  // ── tables ────────────────────────────────────────────────────────
  console.log("\n[2/4] new tables");

  if (!(await tableExists("stage_transitions"))) {
    await db.execute(`CREATE TABLE stage_transitions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      reason TEXT,
      triggered_by TEXT DEFAULT 'ai' CHECK (triggered_by IN ('ai','human','rule','cron')),
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX idx_stage_transitions_thread ON stage_transitions(thread_id)`);
    await db.execute(`CREATE INDEX idx_stage_transitions_account_date ON stage_transitions(account_id, created_at DESC)`);
    console.log("  +     stage_transitions");
  } else console.log("  skip  stage_transitions");

  if (!(await tableExists("objection_history"))) {
    await db.execute(`CREATE TABLE objection_history (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      objection_type TEXT NOT NULL,
      inbound_message TEXT NOT NULL,
      rebuttal_sent TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX idx_objection_history_thread ON objection_history(thread_id)`);
    await db.execute(`CREATE INDEX idx_objection_history_type ON objection_history(objection_type)`);
    console.log("  +     objection_history");
  } else console.log("  skip  objection_history");

  if (!(await tableExists("prospect_queue"))) {
    await db.execute(`CREATE TABLE prospect_queue (
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
    await db.execute(`CREATE INDEX idx_prospect_queue_account_status ON prospect_queue(account_id, status)`);
    await db.execute(`CREATE INDEX idx_prospect_queue_priority ON prospect_queue(priority DESC, scheduled_for ASC)`);
    console.log("  +     prospect_queue");
  } else console.log("  skip  prospect_queue");

  if (!(await tableExists("icp_configs"))) {
    await db.execute(`CREATE TABLE icp_configs (
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
    await db.execute(`CREATE INDEX idx_icp_configs_account ON icp_configs(account_id)`);
    console.log("  +     icp_configs");
  } else console.log("  skip  icp_configs");

  // ── indexes ───────────────────────────────────────────────────────
  console.log("\n[3/4] indexes on dm_threads doctrine columns");
  const idxs = [
    ["idx_dm_threads_stage", "dm_threads(stage)"],
    ["idx_dm_threads_account_stage", "dm_threads(account_id, stage)"],
    ["idx_dm_threads_last_inbound", "dm_threads(last_inbound_at)"],
  ];
  for (const [name, def] of idxs) {
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS ${name} ON ${def}`);
      console.log(`  +     ${name}`);
    } catch (e) {
      console.log(`  err   ${name}: ${e.message}`);
    }
  }

  // ── backfills ─────────────────────────────────────────────────────
  console.log("\n[4/4] backfills");
  const r1 = await db.execute(`
    UPDATE dm_threads SET stage = CASE
      WHEN status = 'qualified' AND stage = 'cold' THEN 'qualify'
      WHEN status = 'booked'    AND stage = 'cold' THEN 'booked'
      WHEN status = 'closed'    AND stage = 'cold' THEN 'closed_won'
      ELSE stage
    END
  `);
  console.log(`  backfill status→stage: ${r1.rowsAffected} rows`);

  const r2 = await db.execute(`
    UPDATE dm_threads SET stage = 'opener'
    WHERE stage = 'cold'
      AND EXISTS (SELECT 1 FROM dm_messages m WHERE m.thread_id = dm_threads.id AND m.direction = 'inbound')
  `);
  console.log(`  backfill cold→opener (have inbound): ${r2.rowsAffected} rows`);

  const r3 = await db.execute(`
    UPDATE dm_threads SET last_inbound_at = (
      SELECT MAX(sent_at) FROM dm_messages WHERE thread_id = dm_threads.id AND direction = 'inbound'
    ) WHERE last_inbound_at IS NULL
  `);
  console.log(`  backfill last_inbound_at: ${r3.rowsAffected} rows`);

  const r4 = await db.execute(`
    UPDATE dm_threads SET last_outbound_at = (
      SELECT MAX(sent_at) FROM dm_messages WHERE thread_id = dm_threads.id AND direction = 'outbound'
    ) WHERE last_outbound_at IS NULL
  `);
  console.log(`  backfill last_outbound_at: ${r4.rowsAffected} rows`);

  // ── verify ────────────────────────────────────────────────────────
  console.log("\nVerification:");
  const info = await db.execute(`PRAGMA table_info(dm_threads)`);
  const doctrineCols = info.rows.filter((r) =>
    ["stage", "objection", "is_friend", "in_icp", "signal_score", "bot_check_count"].includes(r.name)
  );
  console.log(`  dm_threads doctrine columns present: ${doctrineCols.length}/6`);

  const ct = await db.execute(`SELECT stage, COUNT(*) as n FROM dm_threads GROUP BY stage ORDER BY n DESC`);
  for (const row of ct.rows) console.log(`  stage=${row.stage}: ${row.n}`);

  console.log("\nMigration 004 complete.");
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
