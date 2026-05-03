/**
 * Doctrine orchestrator — full inbound-message pipeline.
 *
 * Called by /api/ai/reply (and optionally by /api/webhook).
 * Flow: classify → next-stage → respond → persist transitions.
 */

import { db, generateId } from "../db";
import { classify, type ClassifierOutput } from "../claude/classify";
import { respond, type ResponderOutput } from "../claude/respond";
import { nextStage, type Stage, TERMINAL_STAGES } from "./pipeline";
import type { ObjectionType } from "./objections";

export interface DoctrineResult {
  draft: string;
  previousStage: Stage;
  nextStage: Stage;
  stageChanged: boolean;
  objection: ObjectionType | null;
  signalScore: number;
  botCheck: boolean;
  outOfIcp: boolean;
  classifier: ClassifierOutput;
  tokens: { input: number; output: number };
}

export interface DoctrineInput {
  accountId: string;
  threadId: string;
  inbound: string;
  // Optional: override stage/friend for testing or manual control
  forceStage?: Stage;
  forceFriend?: boolean;
}

export async function runDoctrine(input: DoctrineInput): Promise<DoctrineResult> {
  // ── Load thread state ────────────────────────────────────────────────
  const threadRes = await db().execute({
    sql: `SELECT id, account_id, stage, objection, is_friend, in_icp, signal_score, bot_check_count,
            last_inbound_at, last_outbound_at
          FROM dm_threads WHERE id = ? LIMIT 1`,
    args: [input.threadId],
  });
  if (threadRes.rows.length === 0) {
    throw new Error(`Thread not found: ${input.threadId}`);
  }
  const thread = threadRes.rows[0] as unknown as {
    id: string;
    account_id: string;
    stage: Stage;
    objection: string | null;
    is_friend: number;
    in_icp: number;
    signal_score: number;
    bot_check_count: number;
  };

  const currentStage: Stage = input.forceStage ?? thread.stage;
  const isFriend = input.forceFriend !== undefined ? input.forceFriend : !!thread.is_friend;

  // ── Load recent messages (PRIOR history only — strip current inbound if already persisted) ─
  // Pull 30 messages (~15 turns) so multi-day conversations retain their
  // arc. Anthropic prompt token budget easily fits this — average DM is
  // <40 tokens, so 30 messages ≈ 1200 tokens of history.
  const msgsRes = await db().execute({
    sql: `SELECT direction, content FROM dm_messages
          WHERE thread_id = ? ORDER BY sent_at DESC LIMIT 30`,
    args: [input.threadId],
  });
  const all = (msgsRes.rows as unknown as Array<{ direction: "inbound" | "outbound"; content: string }>)
    .reverse();
  const recentMessages = all.length > 0
    && all[all.length - 1].direction === "inbound"
    && all[all.length - 1].content === input.inbound
    ? all.slice(0, -1)
    : all;

  // ── Load ICP config for this account ─────────────────────────────────
  const icpRes = await db().execute({
    sql: `SELECT target_niches, allowed_regions, min_followers FROM icp_configs
          WHERE account_id = ? LIMIT 1`,
    args: [input.accountId],
  });
  const icp = icpRes.rows.length > 0
    ? parseIcp(icpRes.rows[0] as unknown as { target_niches: string; allowed_regions: string; min_followers: number })
    : undefined;

  // ── Load account system prompt ───────────────────────────────────────
  const acctRes = await db().execute({
    sql: `SELECT system_prompt, display_name FROM accounts WHERE id = ? LIMIT 1`,
    args: [input.accountId],
  });
  const acct = acctRes.rows[0] as unknown as { system_prompt: string | null; display_name: string } | undefined;

  // ── Classify inbound ────────────────────────────────────────────────
  const classifier = await classify({
    currentStage,
    inbound: input.inbound,
    recentMessages,
    isFriend,
    icp,
  });

  // ── Compute next stage ──────────────────────────────────────────────
  const target = nextStage(currentStage, {
    detectedObjection: classifier.objection,
    bookedCall: classifier.booked_call,
    explicitNo: classifier.explicit_no,
    askedForHelp: classifier.asked_for_help,
    sharedPain: classifier.shared_pain,
    stalled: classifier.stalled,
    outOfIcp: classifier.out_of_icp,
    botCheck: classifier.bot_check,
    signalScore: classifier.signal_score,
  });

  const stageChanged = target !== currentStage;

  // ── Don't reply if terminal stage ───────────────────────────────────
  if (TERMINAL_STAGES.includes(target) && target !== "booked") {
    await persistState({
      threadId: input.threadId,
      accountId: input.accountId,
      fromStage: currentStage,
      toStage: target,
      objection: classifier.objection,
      signalScore: classifier.signal_score,
      botCheckHit: classifier.bot_check,
      inboundMessage: input.inbound,
      rebuttalSent: null,
    });

    return {
      draft: "",
      previousStage: currentStage,
      nextStage: target,
      stageChanged,
      objection: classifier.objection,
      signalScore: classifier.signal_score,
      botCheck: classifier.bot_check,
      outOfIcp: classifier.out_of_icp,
      classifier,
      tokens: { input: 0, output: 0 },
    };
  }

  // ── Generate reply ──────────────────────────────────────────────────
  let responder: ResponderOutput;
  try {
    responder = await respond({
      stage: target,
      inbound: input.inbound,
      recentMessages,
      isFriend,
      objection: classifier.objection,
      botCheck: classifier.bot_check,
      accountSystemPrompt: acct?.system_prompt ?? null,
      accountDisplayName: acct?.display_name ?? null,
    });
  } catch (err) {
    console.error("[doctrine] responder failed:", err);
    // Persist classifier signals even if reply failed — human can draft manually
    await persistState({
      threadId: input.threadId,
      accountId: input.accountId,
      fromStage: currentStage,
      toStage: target,
      objection: classifier.objection,
      signalScore: classifier.signal_score,
      botCheckHit: classifier.bot_check,
      inboundMessage: input.inbound,
      rebuttalSent: null,
    });
    throw err;
  }

  // ── Persist state transitions ───────────────────────────────────────
  await persistState({
    threadId: input.threadId,
    accountId: input.accountId,
    fromStage: currentStage,
    toStage: target,
    objection: classifier.objection,
    signalScore: classifier.signal_score,
    botCheckHit: classifier.bot_check,
    inboundMessage: input.inbound,
    rebuttalSent: classifier.objection ? responder.reply : null,
  });

  return {
    draft: responder.reply,
    previousStage: currentStage,
    nextStage: target,
    stageChanged,
    objection: classifier.objection,
    signalScore: classifier.signal_score,
    botCheck: classifier.bot_check,
    outOfIcp: classifier.out_of_icp,
    classifier,
    tokens: { input: responder.inputTokens, output: responder.outputTokens },
  };
}

async function persistState(args: {
  threadId: string;
  accountId: string;
  fromStage: Stage;
  toStage: Stage;
  objection: ObjectionType | null;
  signalScore: number;
  botCheckHit: boolean;
  inboundMessage: string;
  rebuttalSent: string | null;
}) {
  const now = new Date().toISOString();
  const stageChanged = args.fromStage !== args.toStage;

  // Update thread state
  const updates: string[] = [
    "stage = ?",
    "objection = ?",
    "signal_score = ?",
    "last_inbound_at = ?",
    "updated_at = ?",
  ];
  const values: (string | number | null)[] = [
    args.toStage,
    args.objection,
    args.signalScore,
    now,
    now,
  ];

  if (stageChanged) {
    updates.push("last_stage_change_at = ?");
    values.push(now);
  }
  if (args.botCheckHit) {
    updates.push("bot_check_count = bot_check_count + 1");
  }

  values.push(args.threadId);

  await db().execute({
    sql: `UPDATE dm_threads SET ${updates.join(", ")} WHERE id = ?`,
    args: values,
  });

  // Audit: stage transition
  if (stageChanged) {
    await db().execute({
      sql: `INSERT INTO stage_transitions (id, thread_id, account_id, from_stage, to_stage, triggered_by, reason, created_at)
            VALUES (?, ?, ?, ?, ?, 'ai', ?, ?)`,
      args: [generateId(), args.threadId, args.accountId, args.fromStage, args.toStage, `classifier`, now],
    });
  }

  // Audit: objection history
  if (args.objection) {
    await db().execute({
      sql: `INSERT INTO objection_history (id, thread_id, account_id, objection_type, inbound_message, rebuttal_sent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        generateId(),
        args.threadId,
        args.accountId,
        args.objection,
        args.inboundMessage.slice(0, 500),
        args.rebuttalSent,
        now,
      ],
    });
  }
}

function parseIcp(row: { target_niches: string; allowed_regions: string; min_followers: number }) {
  const tryParse = (s: string): string[] => {
    try {
      const arr = JSON.parse(s || "[]");
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    targetNiches: tryParse(row.target_niches),
    allowedRegions: tryParse(row.allowed_regions),
    minFollowers: row.min_followers || 0,
  };
}
