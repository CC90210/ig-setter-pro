-- Migration 004: Setter Doctrine
-- Adds 6-stage NEPQ pipeline, objection tracking, friend/warm mode,
-- geo/ICP filter, stale lead metadata, bot-check state, proactive outreach queue.

-- ─── Extend dm_threads with doctrine columns ────────────────────────────────

ALTER TABLE dm_threads ADD COLUMN stage TEXT NOT NULL DEFAULT 'cold'
  CHECK (stage IN ('cold', 'opener', 'qualify', 'pain', 'solution', 'objection', 'booked', 'closed_won', 'closed_lost', 'dead'));

ALTER TABLE dm_threads ADD COLUMN objection TEXT;
  -- nullable — one of: price, timing, trust, spouse, not_now, competitor,
  -- happy_current, no_budget, need_info, too_busy, tried_before, bot_check, other

ALTER TABLE dm_threads ADD COLUMN is_friend INTEGER NOT NULL DEFAULT 0;
  -- 1 = friend/warm lead, swap to casual register (no pitch, no NEPQ)

ALTER TABLE dm_threads ADD COLUMN region TEXT;
  -- ISO-ish region tag inferred from conversation (e.g., "ON-CA", "US-TX", "OOA" for out-of-area)

ALTER TABLE dm_threads ADD COLUMN in_icp INTEGER NOT NULL DEFAULT 1;
  -- 0 = out of ICP (auto-archived from further outreach)

ALTER TABLE dm_threads ADD COLUMN signal_score INTEGER NOT NULL DEFAULT 0;
  -- rolling 0-100 buy signal score (updated on each inbound)

ALTER TABLE dm_threads ADD COLUMN bot_check_count INTEGER NOT NULL DEFAULT 0;
  -- how many times prospect has asked "are you a bot?" / AI detection triggers

ALTER TABLE dm_threads ADD COLUMN last_inbound_at TEXT;
ALTER TABLE dm_threads ADD COLUMN last_outbound_at TEXT;
ALTER TABLE dm_threads ADD COLUMN last_stage_change_at TEXT;

-- ─── Stage transition audit ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stage_transitions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT,
  triggered_by TEXT DEFAULT 'ai' CHECK (triggered_by IN ('ai', 'human', 'rule', 'cron')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stage_transitions_thread ON stage_transitions(thread_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_account_date ON stage_transitions(account_id, created_at DESC);

-- ─── Objection audit ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS objection_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  objection_type TEXT NOT NULL,
  inbound_message TEXT NOT NULL,
  rebuttal_sent TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_objection_history_thread ON objection_history(thread_id);
CREATE INDEX IF NOT EXISTS idx_objection_history_type ON objection_history(objection_type);

-- ─── Proactive outreach queue ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prospect_queue (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Target info
  ig_username TEXT NOT NULL,
  ig_user_id TEXT,          -- optional — looked up at send time
  display_name TEXT,
  profile_url TEXT,
  bio_snippet TEXT,
  follower_count INTEGER,
  niche TEXT,
  region TEXT,
  source TEXT,              -- 'manual', 'scrape', 'import', 'comment', 'story_view'

  -- Targeting intelligence
  reason TEXT,              -- why they're a prospect (e.g., "HVAC in ON, 5k+ followers")
  personalization TEXT,     -- custom hook to weave into the opener

  -- State
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'replied', 'skipped', 'failed', 'blocked')),
  priority INTEGER NOT NULL DEFAULT 50,   -- 0-100, higher = sooner
  scheduled_for TEXT,                     -- ISO timestamp, null = send on next cron tick
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  -- Linkage once contacted
  thread_id TEXT REFERENCES dm_threads(id) ON DELETE SET NULL,

  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT,
  replied_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(account_id, ig_username)
);

CREATE INDEX IF NOT EXISTS idx_prospect_queue_account_status ON prospect_queue(account_id, status);
CREATE INDEX IF NOT EXISTS idx_prospect_queue_scheduled ON prospect_queue(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_prospect_queue_priority ON prospect_queue(priority DESC, scheduled_for ASC);

-- ─── ICP configuration per account ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS icp_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,

  -- Geo filter
  allowed_regions TEXT DEFAULT '[]',    -- JSON array of region tags e.g. ["ON-CA","US-*"]
  blocked_regions TEXT DEFAULT '[]',

  -- Niche / industry keywords
  target_niches TEXT DEFAULT '[]',      -- JSON array e.g. ["hvac","wellness","real_estate"]
  excluded_niches TEXT DEFAULT '[]',

  -- Follower thresholds
  min_followers INTEGER DEFAULT 0,
  max_followers INTEGER,

  -- Auto-archive OOA prospects
  auto_archive_oop INTEGER NOT NULL DEFAULT 1,

  -- Stale lead threshold (days without reply → auto-mark dead)
  stale_days INTEGER NOT NULL DEFAULT 14,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_icp_configs_account ON icp_configs(account_id);

-- ─── Migrate existing threads: set stage from status ────────────────────────

UPDATE dm_threads SET stage = 'qualify'  WHERE status = 'qualified' AND stage = 'cold';
UPDATE dm_threads SET stage = 'booked'    WHERE status = 'booked'    AND stage = 'cold';
UPDATE dm_threads SET stage = 'closed_won' WHERE status = 'closed'   AND stage = 'cold';

-- Existing active threads with inbound history → bump to opener
UPDATE dm_threads SET stage = 'opener'
  WHERE stage = 'cold'
    AND EXISTS (SELECT 1 FROM dm_messages m WHERE m.thread_id = dm_threads.id AND m.direction = 'inbound');

-- Backfill last_inbound_at / last_outbound_at from messages
UPDATE dm_threads SET last_inbound_at = (
  SELECT MAX(sent_at) FROM dm_messages
  WHERE thread_id = dm_threads.id AND direction = 'inbound'
);
UPDATE dm_threads SET last_outbound_at = (
  SELECT MAX(sent_at) FROM dm_messages
  WHERE thread_id = dm_threads.id AND direction = 'outbound'
);

-- ─── Indexes for stage-based queries ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dm_threads_stage ON dm_threads(stage);
CREATE INDEX IF NOT EXISTS idx_dm_threads_account_stage ON dm_threads(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_dm_threads_last_inbound ON dm_threads(last_inbound_at);
CREATE INDEX IF NOT EXISTS idx_dm_threads_friend ON dm_threads(is_friend) WHERE is_friend = 1;
