import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, ig_username, ig_page_id, auto_send_enabled, display_name, is_active, token_expires_at, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: {
    ig_username: string;
    ig_page_id: string;
    ig_access_token: string;
    display_name: string;
    auto_send_enabled?: boolean;
    system_prompt?: string;
    token_expires_at?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.ig_username || !body.ig_page_id || !body.ig_access_token) {
    return NextResponse.json({ error: "ig_username, ig_page_id, and ig_access_token are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      ig_username: body.ig_username,
      ig_page_id: body.ig_page_id,
      ig_access_token: body.ig_access_token,
      display_name: body.display_name || body.ig_username,
      auto_send_enabled: body.auto_send_enabled ?? false,
      system_prompt: body.system_prompt || null,
      token_expires_at: body.token_expires_at || null,
    })
    .select("id, ig_username, ig_page_id, auto_send_enabled, display_name, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase();
  let body: { id: string; auto_send_enabled?: boolean; system_prompt?: string; display_name?: string; is_active?: boolean };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.auto_send_enabled !== undefined) updates.auto_send_enabled = body.auto_send_enabled;
  if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", body.id)
    .select("id, ig_username, auto_send_enabled, display_name, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
