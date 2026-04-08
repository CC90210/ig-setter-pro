-- ig-setter-pro: Enhanced IG DM Automation Dashboard
-- Multi-account, AI-powered classification, automation rules, sequences

-- ─── Accounts (multi-account support) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_username TEXT NOT NULL,
  ig_page_id TEXT NOT NULL UNIQUE,
  ig_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  token_refreshed_at TIMESTAMPTZ,
  auto_send_enabled BOOLEAN DEFAULT FALSE,
  system_prompt TEXT,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DM Threads ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_thread_id TEXT NOT NULL UNIQUE,
  ig_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  avatar_initial TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#888888',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'qualified', 'booked', 'closed')),
  ai_status TEXT NOT NULL DEFAULT 'active' CHECK (ai_status IN ('active', 'qualified', 'booked', 'closed')),
  last_message TEXT DEFAULT '',
  last_timestamp TIMESTAMPTZ DEFAULT NOW(),
  pending_ai_draft TEXT,
  conversation_summary TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DM Messages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ig_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_ai BOOLEAN DEFAULT FALSE,
  override BOOLEAN DEFAULT FALSE
);

-- ─── Daily Stats (per account) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_handled INTEGER DEFAULT 0,
  qualified INTEGER DEFAULT 0,
  booked INTEGER DEFAULT 0,
  closed INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  deals_progressed INTEGER DEFAULT 0,
  auto_sent INTEGER DEFAULT 0,
  ai_drafts INTEGER DEFAULT 0,
  UNIQUE(account_id, date)
);

-- ─── Automation Rules ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'story_reply', 'first_message', 'status_change')),
  trigger_value TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL CHECK (action_type IN ('send_message', 'change_status', 'start_sequence', 'notify')),
  action_value TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  times_triggered INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sequences (multi-step DM flows — ManyChat replacement) ──────────────────

CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  condition TEXT,
  UNIQUE(sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  next_step_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, thread_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_dm_threads_account ON dm_threads(account_id);
CREATE INDEX idx_dm_threads_status ON dm_threads(status);
CREATE INDEX idx_dm_threads_updated ON dm_threads(updated_at DESC);
CREATE INDEX idx_dm_messages_thread ON dm_messages(thread_id);
CREATE INDEX idx_dm_messages_sent ON dm_messages(sent_at);
CREATE INDEX idx_dm_messages_account ON dm_messages(account_id);
CREATE INDEX idx_daily_stats_account_date ON daily_stats(account_id, date);
CREATE INDEX idx_automation_rules_account ON automation_rules(account_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_type, is_active);
CREATE INDEX idx_sequences_account ON sequences(account_id);
CREATE INDEX idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_sequence_enrollments_next ON sequence_enrollments(next_step_at) WHERE status = 'active';

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- Dashboard reads (anon key) — no token exposure
CREATE POLICY "anon_read_accounts" ON accounts FOR SELECT USING (true);
CREATE POLICY "anon_read_threads" ON dm_threads FOR SELECT USING (true);
CREATE POLICY "anon_read_messages" ON dm_messages FOR SELECT USING (true);
CREATE POLICY "anon_read_stats" ON daily_stats FOR SELECT USING (true);
CREATE POLICY "anon_read_rules" ON automation_rules FOR SELECT USING (true);
CREATE POLICY "anon_read_sequences" ON sequences FOR SELECT USING (true);
CREATE POLICY "anon_read_steps" ON sequence_steps FOR SELECT USING (true);
CREATE POLICY "anon_read_enrollments" ON sequence_enrollments FOR SELECT USING (true);

-- Note: Writes use service_role key (bypasses RLS) — accounts table token column excluded from anon select above

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE dm_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE automation_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE sequence_enrollments;

-- ─── Helper function: update updated_at automatically ─────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_threads BEFORE UPDATE ON dm_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_rules BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_sequences BEFORE UPDATE ON sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
