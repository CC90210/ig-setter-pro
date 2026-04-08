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

  let query = supabase.from("sequences").select("*, sequence_steps(*)").order("created_at", { ascending: false });
  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sequences: data });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: {
    account_id: string;
    name: string;
    description?: string;
    steps: Array<{ step_order: number; delay_minutes: number; message_template: string; condition?: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Create sequence
  const { data: sequence, error: seqError } = await supabase
    .from("sequences")
    .insert({
      account_id: body.account_id,
      name: body.name,
      description: body.description || null,
    })
    .select()
    .single();

  if (seqError || !sequence) {
    return NextResponse.json({ error: seqError?.message || "Failed" }, { status: 500 });
  }

  // Create steps
  if (body.steps?.length) {
    const steps = body.steps.map((s) => ({
      sequence_id: sequence.id,
      step_order: s.step_order,
      delay_minutes: s.delay_minutes,
      message_template: s.message_template,
      condition: s.condition || null,
    }));

    const { error: stepsError } = await supabase.from("sequence_steps").insert(steps);
    if (stepsError) {
      return NextResponse.json({ error: stepsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ sequence }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase.from("sequences").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
