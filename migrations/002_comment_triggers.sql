-- ig-setter-pro: Comment-to-DM Automation (ManyChat parity)
-- Run via: turso db shell <db-name> < migrations/002_comment_triggers.sql

-- ─── Comment Triggers ─────────────────────────────────────────────────────────
-- Auto-DM when a keyword comment matches on a post.

CREATE TABLE IF NOT EXISTS comment_triggers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ig_media_id TEXT,
  keywords TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'any_comment')),
  require_follow INTEGER DEFAULT 1,
  dm_message TEXT NOT NULL,
  dm_button_text TEXT,
  dm_button_url TEXT,
  follow_gate_message TEXT DEFAULT 'Follow me first, then comment again to unlock!',
  is_active INTEGER DEFAULT 1,
  times_triggered INTEGER DEFAULT 0,
  times_sent INTEGER DEFAULT 0,
  times_follow_gated INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Comment Events ───────────────────────────────────────────────────────────
-- Track which commenters got DMs — dedup + analytics.

CREATE TABLE IF NOT EXISTS comment_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  trigger_id TEXT NOT NULL REFERENCES comment_triggers(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_comment_id TEXT NOT NULL UNIQUE,
  ig_user_id TEXT NOT NULL,
  username TEXT,
  comment_text TEXT,
  ig_media_id TEXT,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('dm_sent', 'follow_gated', 'duplicate', 'error')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_comment_triggers_account ON comment_triggers(account_id);
CREATE INDEX IF NOT EXISTS idx_comment_triggers_media ON comment_triggers(ig_media_id, is_active);
CREATE INDEX IF NOT EXISTS idx_comment_events_trigger ON comment_events(trigger_id);
CREATE INDEX IF NOT EXISTS idx_comment_events_user ON comment_events(ig_user_id);
