/**
 * Haiku classifier — reads the inbound message + recent thread history,
 * outputs structured signals for the pipeline state machine.
 */

import { callClaude, MODELS, extractJson, type ClaudeMessage } from "./client";
import { OBJECTION_TYPES, type ObjectionType, heuristicObjection } from "../doctrine/objections";
import type { Stage } from "../doctrine/pipeline";

export interface ClassifierInput {
  currentStage: Stage;
  inbound: string;
  recentMessages: Array<{ direction: "inbound" | "outbound"; content: string }>;
  isFriend: boolean;
  icp?: {
    targetNiches?: string[];
    allowedRegions?: string[];
    minFollowers?: number;
  };
}

export interface ClassifierOutput {
  intent:
    | "greeting"
    | "question"
    | "pain_signal"
    | "ask_for_help"
    | "objection"
    | "agreement"
    | "refusal"
    | "small_talk"
    | "bot_check"
    | "unclear";
  objection: ObjectionType | null;
  booked_call: boolean;        // they just agreed to a call
  explicit_no: boolean;         // hard "no thanks"
  shared_pain: boolean;         // named a specific problem
  asked_for_help: boolean;      // asked you to solve something
  stalled: boolean;             // vague/disengaged reply
  bot_check: boolean;           // asking if you're AI
  out_of_icp: boolean;          // signal they don't fit (wrong region, wrong niche)
  region_hint: string | null;
  niche_hint: string | null;
  signal_score: number;         // 0-100 rolling buy intent
  confidence: number;           // 0-1 classifier confidence
  notes: string;                // debug string
}

const CLASSIFIER_SYSTEM = `You are the classification layer of an Instagram DM setter AI.

Given the latest inbound message + recent thread context, output STRICT JSON with these fields:
{
  "intent": "greeting" | "question" | "pain_signal" | "ask_for_help" | "objection" | "agreement" | "refusal" | "small_talk" | "bot_check" | "unclear",
  "objection": null | "price" | "timing" | "trust" | "spouse" | "not_now" | "competitor" | "happy_current" | "no_budget" | "need_info" | "too_busy" | "tried_before" | "bot_check" | "other",
  "booked_call": boolean,          // true ONLY if they just agreed to a call/convo
  "explicit_no": boolean,          // hard refusal, not a soft stall
  "shared_pain": boolean,          // they named a specific friction/problem/bottleneck
  "asked_for_help": boolean,       // they asked you directly to help them / solve X
  "stalled": boolean,              // vague, disengaged, 1-word reply with no forward motion
  "bot_check": boolean,            // asked whether you're a bot / AI / real
  "out_of_icp": boolean,           // clear signal they're not ICP (wrong country, hobby, unrelated niche)
  "region_hint": string | null,    // any region they mention — ISO-ish code or city (e.g. "ON-CA", "New York")
  "niche_hint": string | null,     // their business niche if mentioned
  "signal_score": number,          // 0-100 — buy intent right now
  "confidence": number,            // 0-1 — your confidence in this classification
  "notes": string                  // one-sentence rationale (debug only)
}

Rules:
- Output ONLY the JSON object. No prose. No markdown fences.
- "booked_call" must be true only if they clearly accepted — words like "yes let's talk", "ok book it", "DM me a link".
- "objection" can be non-null even when intent is "question" — asking "how much?" is intent=question but objection=price.
- "bot_check" and intent="bot_check" should both fire when they question your realness.
- "out_of_icp" — only set true if strong signal. Don't guess.
- "signal_score" — think like a sales engineer. 0 = dead. 100 = ready-to-pay. Most will be 20-60.`;

export async function classify(input: ClassifierInput): Promise<ClassifierOutput> {
  const history: ClaudeMessage[] = [];

  const icpLine = input.icp
    ? `\nICP: niches=${(input.icp.targetNiches || []).join("|") || "-"}, regions=${(input.icp.allowedRegions || []).join("|") || "any"}, min_followers=${input.icp.minFollowers ?? 0}`
    : "";

  const userBlock = [
    `Current pipeline stage: ${input.currentStage}`,
    `Friend mode: ${input.isFriend ? "YES (casual, not selling)" : "NO (normal setter flow)"}`,
    icpLine.trim() ? icpLine : "",
    "",
    "Recent thread history (oldest to newest):",
    input.recentMessages.length === 0
      ? "<no prior messages — first contact>"
      : input.recentMessages
          .slice(-12)
          .map((m) => `[${m.direction}] ${m.content}`)
          .join("\n"),
    "",
    "Latest inbound message (classify THIS):",
    input.inbound,
    "",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  history.push({ role: "user", content: userBlock });

  let raw: string;
  try {
    const res = await callClaude({
      model: MODELS.HAIKU,
      system: CLASSIFIER_SYSTEM,
      messages: history,
      maxTokens: 512,
      temperature: 0.2,
    });
    raw = res.text;
  } catch (err) {
    // Fallback: heuristic-only classification if Claude unavailable
    console.error("[classify] Claude call failed, using heuristic:", err);
    const heur = heuristicObjection(input.inbound);
    return {
      intent: heur ? "objection" : "unclear",
      objection: heur,
      booked_call: false,
      explicit_no: false,
      shared_pain: false,
      asked_for_help: false,
      stalled: false,
      bot_check: /\b(bot|ai|chatgpt|real person|are you human)\b/i.test(input.inbound),
      out_of_icp: false,
      region_hint: null,
      niche_hint: null,
      signal_score: 30,
      confidence: 0.3,
      notes: "heuristic fallback (Claude API unavailable)",
    };
  }

  try {
    const parsed = extractJson<Partial<ClassifierOutput>>(raw);
    // Normalize + defend against bad output
    const validObjection = parsed.objection && OBJECTION_TYPES.includes(parsed.objection as ObjectionType)
      ? (parsed.objection as ObjectionType)
      : null;

    return {
      intent: (parsed.intent as ClassifierOutput["intent"]) ?? "unclear",
      objection: validObjection,
      booked_call: !!parsed.booked_call,
      explicit_no: !!parsed.explicit_no,
      shared_pain: !!parsed.shared_pain,
      asked_for_help: !!parsed.asked_for_help,
      stalled: !!parsed.stalled,
      bot_check: !!parsed.bot_check,
      out_of_icp: !!parsed.out_of_icp,
      region_hint: typeof parsed.region_hint === "string" ? parsed.region_hint : null,
      niche_hint: typeof parsed.niche_hint === "string" ? parsed.niche_hint : null,
      signal_score: clamp(Number(parsed.signal_score ?? 30), 0, 100),
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch (err) {
    console.error("[classify] JSON parse failed:", err, "raw:", raw.slice(0, 300));
    // Return safe default on parse failure
    return {
      intent: "unclear",
      objection: heuristicObjection(input.inbound),
      booked_call: false,
      explicit_no: false,
      shared_pain: false,
      asked_for_help: false,
      stalled: false,
      bot_check: false,
      out_of_icp: false,
      region_hint: null,
      niche_hint: null,
      signal_score: 25,
      confidence: 0.2,
      notes: "parse_error",
    };
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
