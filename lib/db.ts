import { createClient, type Client } from "@libsql/client/http";

let _client: Client | null = null;

export function db(): Client {
  if (!_client) {
    const rawUrl = (process.env.TURSO_DATABASE_URL || "").trim();
    const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim();
    if (!rawUrl) throw new Error("Missing TURSO_DATABASE_URL");
    const url = rawUrl.replace(/^libsql:\/\//, "https://");
    _client = createClient({ url, authToken });
    _client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  }
  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThreadStatus = "active" | "qualified" | "booked" | "closed";

export type Stage =
  | "cold"
  | "opener"
  | "qualify"
  | "pain"
  | "solution"
  | "objection"
  | "book_call"
  | "booked"
  | "closed_won"
  | "closed_lost"
  | "dead";

export type ObjectionType =
  | "price"
  | "timing"
  | "trust"
  | "spouse"
  | "not_now"
  | "competitor"
  | "happy_current"
  | "no_budget"
  | "need_info"
  | "too_busy"
  | "tried_before"
  | "bot_check"
  | "other";

export interface Account {
  id: string;
  ig_username: string;
  ig_page_id: string;
  ig_access_token: string;
  token_expires_at: string | null;
  auto_send_enabled: number; // SQLite boolean
  system_prompt: string | null;
  display_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DMThread {
  id: string;
  account_id: string;
  ig_thread_id: string;
  ig_user_id: string;
  username: string;
  display_name: string;
  avatar_initial: string;
  avatar_color: string;
  status: ThreadStatus;
  ai_status: ThreadStatus;
  last_message: string;
  last_timestamp: string;
  pending_ai_draft: string | null;
  conversation_summary: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  // Doctrine (migration 004)
  stage: Stage;
  objection: ObjectionType | null;
  is_friend: number;
  region: string | null;
  in_icp: number;
  signal_score: number;
  bot_check_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_stage_change_at: string | null;
  // Booking flow (migration 005)
  booking_offered_at: string | null;
  booking_email: string | null;
  booked_for: string | null;
  calendar_event_id: string | null;
  teaser_sent_at: string | null;
  call_completed_at: string | null;
  repo_delivered_at: string | null;
}

export interface StageTransition {
  id: string;
  thread_id: string;
  account_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  reason: string | null;
  triggered_by: "ai" | "human" | "rule" | "cron";
  created_at: string;
}

export interface ObjectionRecord {
  id: string;
  thread_id: string;
  account_id: string;
  objection_type: ObjectionType;
  inbound_message: string;
  rebuttal_sent: string | null;
  resolved: number;
  created_at: string;
}

export interface Prospect {
  id: string;
  account_id: string;
  ig_username: string;
  ig_user_id: string | null;
  display_name: string | null;
  profile_url: string | null;
  bio_snippet: string | null;
  follower_count: number | null;
  niche: string | null;
  region: string | null;
  source: string | null;
  reason: string | null;
  personalization: string | null;
  status: "queued" | "sending" | "sent" | "replied" | "skipped" | "failed" | "blocked";
  priority: number;
  scheduled_for: string | null;
  attempts: number;
  last_error: string | null;
  thread_id: string | null;
  created_at: string;
  sent_at: string | null;
  replied_at: string | null;
  updated_at: string;
}

export interface IcpConfig {
  id: string;
  account_id: string;
  allowed_regions: string;   // JSON array
  blocked_regions: string;   // JSON array
  target_niches: string;     // JSON array
  excluded_niches: string;   // JSON array
  min_followers: number;
  max_followers: number | null;
  auto_archive_oop: number;
  stale_days: number;
  created_at: string;
  updated_at: string;
}

export interface DMMessage {
  id: string;
  thread_id: string;
  account_id: string;
  ig_message_id: string | null;
  direction: "inbound" | "outbound";
  content: string;
  sent_at: string;
  is_ai: number;
  override: number;
}

export interface PythonOutboundQueueItem {
  id: string;
  account_id: string;
  thread_id: string;
  ig_thread_id: string;
  ig_user_id: string;
  username: string;
  message: string;
  status: "pending" | "sending" | "sent" | "failed";
  is_ai: number;
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyStats {
  id: string;
  account_id: string;
  date: string;
  total_handled: number;
  qualified: number;
  booked: number;
  closed: number;
  revenue: number;
  replies_received: number;
  deals_progressed: number;
  auto_sent: number;
  ai_drafts: number;
}

export interface AutomationRule {
  id: string;
  account_id: string;
  name: string;
  trigger_type: "keyword" | "story_reply" | "first_message" | "status_change";
  trigger_value: string;
  action_type: "send_message" | "change_status" | "start_sequence" | "notify";
  action_value: string;
  is_active: number;
  priority: number;
  times_triggered: number;
  created_at: string;
  updated_at: string;
}

export interface Sequence {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  is_active: number;
  total_enrolled: number;
  total_completed: number;
  created_at: string;
  updated_at: string;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_minutes: number;
  message_template: string;
  condition: string | null;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  thread_id: string;
  current_step: number;
  status: "active" | "completed" | "paused" | "cancelled";
  next_step_at: string | null;
  enrolled_at: string;
  completed_at: string | null;
}

// ─── Helper: generate ID matching DB default lower(hex(randomblob(16))) ─────
// crypto.randomUUID() produces a 36-char UUID with dashes which differs from
// the 32-char lowercase hex the schema uses as its DEFAULT. All app-side
// INSERT statements must use this function so IDs are format-consistent.

/** @deprecated Use generateId() instead */
export const uuid = generateId;

export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const result = await db().execute(
    "SELECT id, ig_username, ig_page_id, auto_send_enabled, display_name, is_active, token_expires_at, created_at, updated_at FROM accounts WHERE is_active = 1 ORDER BY created_at ASC"
  );
  return result.rows as unknown as Account[];
}

export async function fetchThreads(accountId?: string): Promise<DMThread[]> {
  if (accountId) {
    const result = await db().execute({
      sql: "SELECT * FROM dm_threads WHERE account_id = ? ORDER BY updated_at DESC",
      args: [accountId],
    });
    return result.rows as unknown as DMThread[];
  }
  const result = await db().execute("SELECT * FROM dm_threads ORDER BY updated_at DESC");
  return result.rows as unknown as DMThread[];
}

export async function fetchMessages(threadId: string): Promise<DMMessage[]> {
  const result = await db().execute({
    sql: "SELECT * FROM dm_messages WHERE thread_id = ? ORDER BY sent_at ASC",
    args: [threadId],
  });
  return result.rows as unknown as DMMessage[];
}

export async function fetchConversationHistory(threadId: string, limit: number = 20): Promise<DMMessage[]> {
  const result = await db().execute({
    sql: "SELECT * FROM dm_messages WHERE thread_id = ? ORDER BY sent_at DESC LIMIT ?",
    args: [threadId, limit],
  });
  return (result.rows as unknown as DMMessage[]).reverse();
}

export async function fetchTodayStats(accountId?: string): Promise<DailyStats | null> {
  const today = new Date().toISOString().split("T")[0];
  if (accountId) {
    const result = await db().execute({
      sql: "SELECT * FROM daily_stats WHERE date = ? AND account_id = ? LIMIT 1",
      args: [today, accountId],
    });
    return (result.rows[0] as unknown as DailyStats) || null;
  }
  const result = await db().execute({
    sql: "SELECT * FROM daily_stats WHERE date = ? LIMIT 1",
    args: [today],
  });
  return (result.rows[0] as unknown as DailyStats) || null;
}

export async function fetchAutomationRules(accountId: string): Promise<AutomationRule[]> {
  const result = await db().execute({
    sql: "SELECT * FROM automation_rules WHERE account_id = ? ORDER BY priority ASC",
    args: [accountId],
  });
  return result.rows as unknown as AutomationRule[];
}

export async function fetchSequences(accountId: string): Promise<Sequence[]> {
  const result = await db().execute({
    sql: "SELECT * FROM sequences WHERE account_id = ? ORDER BY created_at DESC",
    args: [accountId],
  });
  return result.rows as unknown as Sequence[];
}

// ─── ManyChat Feature Types ───────────────────────────────────────────────────

export interface Subscriber {
  id: string;
  account_id: string;
  ig_user_id: string;
  username: string;
  display_name: string;
  profile_pic_url: string | null;
  is_follower: number;
  opted_in: number;
  first_interaction_at: string;
  last_interaction_at: string;
  source: string | null;
  custom_fields: string;
  lifetime_value: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  account_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  account_id: string;
  name: string;
  message: string;
  button_text: string | null;
  button_url: string | null;
  target_tag_ids: string;
  target_all: number;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  total_clicked: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WelcomeMessage {
  id: string;
  account_id: string;
  is_active: number;
  message: string;
  button_text: string | null;
  button_url: string | null;
  times_sent: number;
  created_at: string;
  updated_at: string;
}

export interface QuickReply {
  id: string;
  account_id: string;
  label: string;
  message: string;
  category: string | null;
  times_used: number;
  created_at: string;
}

export interface Conversion {
  id: string;
  account_id: string;
  subscriber_id: string | null;
  thread_id: string | null;
  source_trigger_id: string | null;
  source_type: string | null;
  event_type: string;
  value: number;
  notes: string | null;
  created_at: string;
}

export interface GrowthTool {
  id: string;
  account_id: string;
  name: string;
  tool_type: "ref_url" | "qr_code" | "opt_in_keyword" | "landing_page";
  slug: string;
  auto_dm_message: string | null;
  auto_tag_ids: string;
  total_hits: number;
  total_conversions: number;
  is_active: number;
  created_at: string;
}

export interface BroadcastDelivery {
  id: string;
  broadcast_id: string;
  subscriber_id: string;
  status: "pending" | "sent" | "failed" | "clicked";
  sent_at: string | null;
  clicked_at: string | null;
  error: string | null;
}
