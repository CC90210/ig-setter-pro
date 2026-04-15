-- Migration 003: Full ManyChat Feature Schema
-- Subscribers, Tags, Broadcasts, Welcome Messages, Quick Replies, Conversions, Growth Tools

-- Subscribers (IG users who've interacted — like ManyChat's subscriber list)
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  profile_pic_url TEXT,
  is_follower INTEGER DEFAULT 0,
  opted_in INTEGER DEFAULT 1,
  first_interaction_at TEXT DEFAULT (datetime('now')),
  last_interaction_at TEXT DEFAULT (datetime('now')),
  source TEXT,
  custom_fields TEXT DEFAULT '{}',
  lifetime_value REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, ig_user_id)
);

-- Tags for segmentation
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#00FFAB',
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(account_id, name)
);

-- Many-to-many subscriber tags
CREATE TABLE IF NOT EXISTS subscriber_tags (
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (subscriber_id, tag_id)
);

-- Broadcasts (bulk send to subscriber segments)
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  button_text TEXT,
  button_url TEXT,
  target_tag_ids TEXT DEFAULT '[]',
  target_all INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Broadcast delivery tracking
CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
  sent_at TEXT,
  clicked_at TEXT,
  error TEXT,
  UNIQUE(broadcast_id, subscriber_id)
);

-- Welcome message (auto-DM on first interaction)
CREATE TABLE IF NOT EXISTS welcome_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  is_active INTEGER DEFAULT 1,
  message TEXT NOT NULL,
  button_text TEXT,
  button_url TEXT,
  times_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Quick replies / saved message templates
CREATE TABLE IF NOT EXISTS quick_replies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT,
  times_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversion tracking (when a subscriber converts — buys, books, etc.)
CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscriber_id TEXT REFERENCES subscribers(id) ON DELETE SET NULL,
  thread_id TEXT REFERENCES dm_threads(id) ON DELETE SET NULL,
  source_trigger_id TEXT,
  source_type TEXT,
  event_type TEXT NOT NULL,
  value REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Growth tools (QR codes, referral links, keyword opt-in)
CREATE TABLE IF NOT EXISTS growth_tools (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('ref_url', 'qr_code', 'opt_in_keyword', 'landing_page')),
  slug TEXT NOT NULL UNIQUE,
  auto_dm_message TEXT,
  auto_tag_ids TEXT DEFAULT '[]',
  total_hits INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_account ON subscribers(account_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_iguser ON subscribers(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_tags_tag ON subscriber_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_account ON broadcasts(account_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_broadcast ON broadcast_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_quick_replies_account ON quick_replies(account_id);
CREATE INDEX IF NOT EXISTS idx_conversions_account ON conversions(account_id);
CREATE INDEX IF NOT EXISTS idx_conversions_subscriber ON conversions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_growth_tools_slug ON growth_tools(slug);
