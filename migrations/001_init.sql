-- ig-setter-pro: Enhanced IG DM Automation Dashboard
-- SQLite/Turso compatible schema
-- Run via: turso db shell <db-name> < migrations/001_init.sql

-- ─── Accounts (multi-account support) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ig_username TEXT NOT NULL,
  ig_page_id TEXT NOT NULL UNIQUE,
  ig_access_token TEXT NOT NULL,
  token_expires_at TEXT,
  token_refreshed_at TEXT,
  auto_send_enabled INTEGER DEFAULT 0,
  system_prompt TEXT,
  display_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── DM Threads ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_threads (
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
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── DM Messages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  is_ai INTEGER DEFAULT 0,
  override INTEGER DEFAULT 0
);

-- ─── Daily Stats (per account) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT (date('now')),
  total_handled INTEGER DEFAULT 0,
  qualified INTEGER DEFAULT 0,
  booked INTEGER DEFAULT 0,
  closed INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  deals_progressed INTEGER DEFAULT 0,
  auto_sent INTEGER DEFAULT 0,
  ai_drafts INTEGER DEFAULT 0,
  UNIQUE(account_id, date)
);

-- ─── Automation Rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'story_reply', 'first_message', 'status_change')),
  trigger_value TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL CHECK (action_type IN ('send_message', 'change_status', 'start_sequence', 'notify')),
  action_value TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  times_triggered INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Sequences (multi-step DM flows — ManyChat replacement) ──────────────────

CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  condition TEXT,
  UNIQUE(sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  next_step_at TEXT,
  enrolled_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE(sequence_id, thread_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dm_threads_account ON dm_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_dm_threads_status ON dm_threads(status);
CREATE INDEX IF NOT EXISTS idx_dm_threads_updated ON dm_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sent ON dm_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_dm_messages_account ON dm_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_account_date ON daily_stats(account_id, date);
CREATE INDEX IF NOT EXISTS idx_automation_rules_account ON automation_rules(account_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_sequences_account ON sequences(account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next ON sequence_enrollments(next_step_at);
