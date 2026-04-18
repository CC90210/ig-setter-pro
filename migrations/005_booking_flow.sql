-- Migration 005: Booking Flow
-- Tracks prospects who've been offered the booking link and those who've booked,
-- links Google Calendar events back to DM threads, logs teaser + delivery emails.

-- Update stage constraint to include 'book_call'
-- (SQLite doesn't support ALTER CONSTRAINT; idempotent via ADD COLUMN approach below)

-- Add booking columns to dm_threads
ALTER TABLE dm_threads ADD COLUMN booking_offered_at TEXT;
ALTER TABLE dm_threads ADD COLUMN booking_email TEXT;          -- captured via cron from calendar event
ALTER TABLE dm_threads ADD COLUMN booked_for TEXT;             -- ISO timestamp of the scheduled call
ALTER TABLE dm_threads ADD COLUMN calendar_event_id TEXT;
ALTER TABLE dm_threads ADD COLUMN teaser_sent_at TEXT;
ALTER TABLE dm_threads ADD COLUMN call_completed_at TEXT;
ALTER TABLE dm_threads ADD COLUMN repo_delivered_at TEXT;

-- Calendar events seen (dedup across cron runs)
CREATE TABLE IF NOT EXISTS calendar_events_seen (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  google_event_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT REFERENCES dm_threads(id) ON DELETE SET NULL,
  attendee_email TEXT,
  summary TEXT,
  start_time TEXT,
  end_time TEXT,
  first_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cal_events_thread ON calendar_events_seen(thread_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_start ON calendar_events_seen(start_time);

-- Email log (teaser + post-call delivery)
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  thread_id TEXT REFERENCES dm_threads(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('teaser', 'repo_delivery', 'reminder_24h', 'reminder_1h', 'reminder_30m')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  provider_message_id TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_log_thread ON email_log(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);

CREATE INDEX IF NOT EXISTS idx_dm_threads_booked_for ON dm_threads(booked_for);
