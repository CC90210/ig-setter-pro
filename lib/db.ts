import { createClient, type Client } from "@libsql/client/web";

let _client: Client | null = null;

export function db(): Client {
  if (!_client) {
    const rawUrl = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!rawUrl) throw new Error("Missing TURSO_DATABASE_URL");
    // @libsql/client/web needs https:// not libsql://
    const url = rawUrl.replace(/^libsql:\/\//, "https://");
    _client = createClient({ url, authToken });
  }
  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThreadStatus = "active" | "qualified" | "booked" | "closed";

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

export function uuid(): string {
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
