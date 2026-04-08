import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F8C471", "#82E0AA", "#F1948A", "#AED6F1", "#D7BDE2",
];

function usernameToColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — Receives cleaned DM payload from n8n
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const secret = req.headers.get("x-webhook-secret");

  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    account_id: string;
    ig_thread_id: string;
    ig_user_id: string;
    username: string;
    display_name: string;
    message: string;
    direction: "inbound" | "outbound";
    status: string;
    ai_status: string;
    pending_ai_draft: string | null;
    is_ai: boolean;
    ig_message_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const avatarColor = usernameToColor(body.username);
  const avatarInitial = (body.username || "?")[0].toUpperCase();

  // Upsert thread
  const { data: thread } = await supabase
    .from("dm_threads")
    .upsert(
      {
        account_id: body.account_id,
        ig_thread_id: body.ig_thread_id,
        ig_user_id: body.ig_user_id,
        username: body.username,
        display_name: body.display_name || body.username,
        avatar_initial: avatarInitial,
        avatar_color: avatarColor,
        status: body.status || "active",
        ai_status: body.ai_status || "active",
        last_message: body.message,
        last_timestamp: now,
        pending_ai_draft: body.pending_ai_draft,
        updated_at: now,
      },
      { onConflict: "ig_thread_id" }
    )
    .select("id, message_count")
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Failed to upsert thread" }, { status: 500 });
  }

  // Insert message
  await supabase.from("dm_messages").insert({
    thread_id: thread.id,
    account_id: body.account_id,
    ig_message_id: body.ig_message_id || null,
    direction: body.direction,
    content: body.message,
    sent_at: now,
    is_ai: body.is_ai || false,
    override: false,
  });

  // Update message count
  await supabase
    .from("dm_threads")
    .update({ message_count: (thread.message_count || 0) + 1 })
    .eq("id", thread.id);

  // Upsert daily stats
  const today = now.split("T")[0];
  const statsUpdate: Record<string, number> = {};

  if (body.direction === "inbound") {
    statsUpdate.total_handled = 1;
    statsUpdate.replies_received = 1;
  }
  if (body.ai_status === "qualified") statsUpdate.qualified = 1;
  if (body.ai_status === "booked") statsUpdate.booked = 1;
  if (body.ai_status === "closed") statsUpdate.closed = 1;
  if (body.is_ai) statsUpdate.ai_drafts = 1;

  const { data: existingStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("account_id", body.account_id)
    .eq("date", today)
    .maybeSingle();

  if (existingStats) {
    const updates: Record<string, number> = {};
    for (const [key, val] of Object.entries(statsUpdate)) {
      updates[key] = (existingStats[key] || 0) + val;
    }
    await supabase.from("daily_stats").update(updates).eq("id", existingStats.id);
  } else {
    await supabase.from("daily_stats").insert({
      account_id: body.account_id,
      date: today,
      ...statsUpdate,
    });
  }

  // Check automation rules (if inbound)
  if (body.direction === "inbound") {
    await checkAutomationRules(supabase, body.account_id, thread.id, body.message);
  }

  return NextResponse.json({ ok: true, thread_id: thread.id });
}

async function checkAutomationRules(
  supabase: ReturnType<typeof getSupabase>,
  accountId: string,
  threadId: string,
  message: string
) {
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (!rules?.length) return;

  const lowerMsg = message.toLowerCase();

  for (const rule of rules) {
    let triggered = false;

    switch (rule.trigger_type) {
      case "keyword":
        triggered = rule.trigger_value
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .some((keyword: string) => lowerMsg.includes(keyword));
        break;
      case "first_message": {
        const { count } = await supabase
          .from("dm_messages")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", threadId);
        triggered = (count || 0) <= 1;
        break;
      }
      case "story_reply":
        triggered = lowerMsg.includes("replied to your story");
        break;
    }

    if (triggered) {
      // Increment trigger count
      await supabase
        .from("automation_rules")
        .update({ times_triggered: (rule.times_triggered || 0) + 1 })
        .eq("id", rule.id);

      // Execute action
      switch (rule.action_type) {
        case "change_status":
          await supabase
            .from("dm_threads")
            .update({ status: rule.action_value })
            .eq("id", threadId);
          break;
        case "start_sequence":
          await supabase.from("sequence_enrollments").upsert(
            {
              sequence_id: rule.action_value,
              thread_id: threadId,
              current_step: 1,
              status: "active",
              next_step_at: new Date().toISOString(),
            },
            { onConflict: "sequence_id,thread_id" }
          );
          break;
      }
      // Only fire the highest-priority matching rule
      break;
    }
  }
}
