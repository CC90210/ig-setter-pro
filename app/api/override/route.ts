import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: { thread_id: string; message: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { thread_id, message } = body;

  if (!thread_id || !message?.trim()) {
    return NextResponse.json({ error: "thread_id and message are required" }, { status: 400 });
  }

  // Fetch thread with account info
  const { data: thread, error: threadError } = await supabase
    .from("dm_threads")
    .select("ig_thread_id, ig_user_id, username, account_id")
    .eq("id", thread_id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Get account's n8n override URL (fall back to env var)
  const n8nWebhookUrl = process.env.N8N_OVERRIDE_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    return NextResponse.json({ error: "N8N_OVERRIDE_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const n8nRes = await fetch(n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ig_thread_id: thread.ig_thread_id,
      ig_user_id: thread.ig_user_id,
      account_id: thread.account_id,
      message: message.trim(),
    }),
  });

  if (!n8nRes.ok) {
    const errText = await n8nRes.text();
    console.error("n8n override webhook error:", errText);
    return NextResponse.json({ error: "Failed to send via n8n" }, { status: 502 });
  }

  const now = new Date().toISOString();

  // Record outbound message
  await supabase.from("dm_messages").insert({
    thread_id,
    account_id: thread.account_id,
    ig_message_id: null,
    direction: "outbound",
    content: message.trim(),
    sent_at: now,
    is_ai: false,
    override: true,
  });

  // Clear pending draft and update thread
  await supabase
    .from("dm_threads")
    .update({
      pending_ai_draft: null,
      last_message: message.trim(),
      last_timestamp: now,
      updated_at: now,
    })
    .eq("id", thread_id);

  return NextResponse.json({ ok: true });
}
