/**
 * POST /api/ai/reply
 *
 * The central AI entry point — Python daemon calls this instead of calling Claude directly.
 *
 * Body:
 *   { account_id, thread_id, inbound_message, force_stage?, force_friend? }
 *
 * Returns:
 *   { draft, stage, previous_stage, objection, signal_score,
 *     bot_check, out_of_icp, stage_changed }
 */

import { NextRequest, NextResponse } from "next/server";
import { runDoctrine } from "@/lib/doctrine";
import type { Stage } from "@/lib/doctrine/pipeline";

export const maxDuration = 30; // Vercel: allow up to 30s for Claude calls

export async function POST(req: NextRequest) {
  // Auth
  const secret = (req.headers.get("x-webhook-secret") || "").trim();
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    account_id: string;
    thread_id: string;
    inbound_message: string;
    force_stage?: Stage;
    force_friend?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.thread_id || !body.inbound_message) {
    return NextResponse.json(
      { error: "Missing required fields: account_id, thread_id, inbound_message" },
      { status: 400 }
    );
  }

  try {
    const result = await runDoctrine({
      accountId: body.account_id,
      threadId: body.thread_id,
      inbound: body.inbound_message,
      forceStage: body.force_stage,
      forceFriend: body.force_friend,
    });

    return NextResponse.json({
      ok: true,
      draft: result.draft,
      stage: result.nextStage,
      previous_stage: result.previousStage,
      stage_changed: result.stageChanged,
      objection: result.objection,
      signal_score: result.signalScore,
      bot_check: result.botCheck,
      out_of_icp: result.outOfIcp,
      should_send: result.draft.length > 0,  // empty when terminal stage
      classifier: {
        intent: result.classifier.intent,
        confidence: result.classifier.confidence,
        notes: result.classifier.notes,
      },
      tokens: result.tokens,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai/reply] error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
