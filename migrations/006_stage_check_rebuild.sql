-- Migration 006: Rebuild dm_threads to drop the stage CHECK constraint
-- (the original constraint didn't include 'book_call' which was added in the
-- doctrine update). Application layer enforces the enum via TypeScript Stage type.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Rename existing table
ALTER TABLE dm_threads RENAME TO dm_threads_old_006;

-- Recreate without the stage CHECK; application enforces valid values
CREATE TABLE dm_threads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_thread_id TEXT NOT NULL UNIQUE,
  ig_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_initial TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#888888',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'qualified', 'booked', 'closed')),
  ai_status TEXT NOT NULL DEFAULT 'active' CHECK (ai_status IN ('active', 'qualified', 'booked', 'closed')),
  last_message TEXT DEFAULT '',
  last_timestamp TEXT DEFAULT (datetime('now')),
  pending_ai_draft TEXT,
  conversation_summary TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  stage TEXT NOT NULL DEFAULT 'cold',
  objection TEXT,
  is_friend INTEGER NOT NULL DEFAULT 0,
  region TEXT,
  in_icp INTEGER NOT NULL DEFAULT 1,
  signal_score INTEGER NOT NULL DEFAULT 0,
  bot_check_count INTEGER NOT NULL DEFAULT 0,
  last_inbound_at TEXT,
  last_outbound_at TEXT,
  last_stage_change_at TEXT,
  booking_offered_at TEXT,
  booking_email TEXT,
  booked_for TEXT,
  calendar_event_id TEXT,
  teaser_sent_at TEXT,
  call_completed_at TEXT,
  repo_delivered_at TEXT
);

-- Copy data
INSERT INTO dm_threads SELECT * FROM dm_threads_old_006;

-- Drop old
DROP TABLE dm_threads_old_006;

-- Rebuild indexes
CREATE INDEX IF NOT EXISTS idx_dm_threads_account ON dm_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_dm_threads_status ON dm_threads(status);
CREATE INDEX IF NOT EXISTS idx_dm_threads_updated ON dm_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_threads_stage ON dm_threads(stage);
CREATE INDEX IF NOT EXISTS idx_dm_threads_account_stage ON dm_threads(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_dm_threads_last_inbound ON dm_threads(last_inbound_at);
CREATE INDEX IF NOT EXISTS idx_dm_threads_booked_for ON dm_threads(booked_for);
CREATE INDEX IF NOT EXISTS idx_dm_threads_friend ON dm_threads(is_friend) WHERE is_friend = 1;

COMMIT;

PRAGMA foreign_keys = ON;
