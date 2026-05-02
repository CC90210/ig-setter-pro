-- Migration 007: Python Playwright outbound queue
-- Dashboard/manual sends are queued here. The Python daemon claims rows,
-- sends through the logged-in Playwright browser, then marks sent/failed.

CREATE TABLE IF NOT EXISTS python_outbound_queue (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  ig_thread_id TEXT NOT NULL,
  ig_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  is_ai INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  claimed_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_python_outbound_queue_status ON python_outbound_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_python_outbound_queue_account ON python_outbound_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_python_outbound_queue_thread ON python_outbound_queue(thread_id);
