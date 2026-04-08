import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _serviceClient: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    _client = createClient(url, key);
  }
  return _client;
}

export function serviceDb(): SupabaseClient {
  if (!_serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    _serviceClient = createClient(url, key);
  }
  return _serviceClient;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThreadStatus = "active" | "qualified" | "booked" | "closed";

export interface Account {
  id: string;
  ig_username: string;
  ig_page_id: string;
  ig_access_token: string;
  token_expires_at: string | null;
  auto_send_enabled: boolean;
  system_prompt: string | null;
  display_name: string;
  is_active: boolean;
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
  is_ai: boolean;
  override: boolean;
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
  is_active: boolean;
  priority: number;
  created_at: string;
}

export interface Sequence {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
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
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await db()
    .from("accounts")
    .select("id, ig_username, ig_page_id, auto_send_enabled, display_name, is_active, token_expires_at, created_at, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function fetchThreads(accountId?: string): Promise<DMThread[]> {
  let query = db().from("dm_threads").select("*").order("updated_at", { ascending: false });
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchMessages(threadId: string): Promise<DMMessage[]> {
  const { data, error } = await db()
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchConversationHistory(threadId: string, limit: number = 20): Promise<DMMessage[]> {
  const { data, error } = await db()
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function fetchTodayStats(accountId?: string): Promise<DailyStats | null> {
  const today = new Date().toISOString().split("T")[0];
  let query = db().from("daily_stats").select("*").eq("date", today);
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAutomationRules(accountId: string): Promise<AutomationRule[]> {
  const { data, error } = await db()
    .from("automation_rules")
    .select("*")
    .eq("account_id", accountId)
    .order("priority", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSequences(accountId: string): Promise<Sequence[]> {
  const { data, error } = await db()
    .from("sequences")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Realtime ────────────────────────────────────────────────────────────────

export function subscribeToThreads(onUpdate: () => void) {
  return db()
    .channel("dm_threads_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, onUpdate)
    .subscribe();
}

export function subscribeToMessages(threadId: string, onUpdate: () => void) {
  return db()
    .channel(`messages_${threadId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "dm_messages",
      filter: `thread_id=eq.${threadId}`,
    }, onUpdate)
    .subscribe();
}

export function subscribeToStats(onUpdate: () => void) {
  return db()
    .channel("daily_stats_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "daily_stats" }, onUpdate)
    .subscribe();
}
