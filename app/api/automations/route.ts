import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const accountId = req.nextUrl.searchParams.get("account_id");

  let query = supabase.from("automation_rules").select("*").order("priority", { ascending: true });
  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: {
    account_id: string;
    name: string;
    trigger_type: string;
    trigger_value: string;
    action_type: string;
    action_value: string;
    priority?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      account_id: body.account_id,
      name: body.name,
      trigger_type: body.trigger_type,
      trigger_value: body.trigger_value,
      action_type: body.action_type,
      action_value: body.action_value,
      priority: body.priority ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
