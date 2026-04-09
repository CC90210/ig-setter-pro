import { NextRequest, NextResponse } from "next/server";
import { db, uuid } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");

  try {
    // Fetch sequences
    let seqResult;
    if (accountId) {
      seqResult = await db().execute({
        sql: "SELECT * FROM sequences WHERE account_id = ? ORDER BY created_at DESC",
        args: [accountId],
      });
    } else {
      seqResult = await db().execute("SELECT * FROM sequences ORDER BY created_at DESC");
    }

    // Fetch steps for all returned sequences
    const sequences = seqResult.rows as unknown as Array<{ id: string }>;
    if (!sequences.length) return NextResponse.json({ sequences: [] });

    const placeholders = sequences.map(() => "?").join(",");
    const stepsResult = await db().execute({
      sql: `SELECT * FROM sequence_steps WHERE sequence_id IN (${placeholders}) ORDER BY step_order ASC`,
      args: sequences.map((s) => s.id),
    });

    // Group steps by sequence_id
    const stepsBySeq = new Map<string, unknown[]>();
    for (const step of stepsResult.rows) {
      const s = step as unknown as { sequence_id: string };
      const arr = stepsBySeq.get(s.sequence_id) ?? [];
      arr.push(step);
      stepsBySeq.set(s.sequence_id, arr);
    }

    const result = sequences.map((seq) => ({
      ...seq,
      sequence_steps: stepsBySeq.get(seq.id) ?? [],
    }));

    return NextResponse.json({ sequences: result });
  } catch (err) {
    console.error("[sequences/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

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

  if (body.steps?.length > 20) {
    return NextResponse.json({ error: "Maximum 20 steps per sequence" }, { status: 400 });
  }

  const seqId = uuid();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO sequences (id, account_id, name, description, is_active, total_enrolled, total_completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, 0, 0, ?, ?)`,
      args: [seqId, body.account_id, body.name, body.description || null, now, now],
    });

    if (body.steps?.length) {
      for (const s of body.steps) {
        await db().execute({
          sql: `INSERT INTO sequence_steps (id, sequence_id, step_order, delay_minutes, message_template, condition)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [uuid(), seqId, s.step_order, s.delay_minutes, s.message_template, s.condition || null],
        });
      }
    }

    return NextResponse.json({ sequence: { id: seqId } }, { status: 201 });
  } catch (err) {
    console.error("[sequences/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM sequences WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sequences/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
