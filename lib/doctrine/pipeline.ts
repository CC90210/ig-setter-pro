/**
 * 6-Stage NEPQ Pipeline
 *
 * State machine for every DM thread. Each stage has:
 *  - an objective (what we're trying to find out or do)
 *  - exit conditions (what moves the thread forward)
 *  - a guidance block injected into the Claude system prompt
 *
 * Ported from setter-bot's conversation doctrine. NEPQ (Jeremy Miner) collapsed
 * into 6 active stages + 3 terminal stages.
 */

export const STAGES = [
  "cold",
  "opener",
  "qualify",
  "pain",
  "solution",
  "objection",
  "booked",
  "closed_won",
  "closed_lost",
  "dead",
] as const;

export type Stage = (typeof STAGES)[number];

export const TERMINAL_STAGES: Stage[] = ["booked", "closed_won", "closed_lost", "dead"];

export interface StageDef {
  stage: Stage;
  objective: string;
  maxMessages: number; // soft limit — if exceeded, force progression or drop
  guidance: string;    // injected into the Claude system prompt
  exitConditions: string[];
}

export const STAGE_DEFS: Record<Stage, StageDef> = {
  // ─── Proactive outreach ─────────────────────────────────────────────────
  cold: {
    stage: "cold",
    objective: "Open the conversation with a pattern-interrupt that references something specific about them.",
    maxMessages: 1,
    guidance: [
      "This is a COLD first-touch DM. You are reaching out to someone who has never talked to you.",
      "Rules:",
      "- Pattern-interrupt. Never '{Hey/Hi} [Name], I noticed...' — everyone opens like that.",
      "- Reference something specific and recent from their content or profile.",
      "- Do NOT pitch. Do NOT ask for a call. Do NOT mention OASIS.",
      "- Goal: get ANY reply. One sincere observation + one soft question.",
      "- Max 2 sentences.",
    ].join("\n"),
    exitConditions: ["Any reply → opener"],
  },

  // ─── Inbound first contact ──────────────────────────────────────────────
  opener: {
    stage: "opener",
    objective: "Warm the thread — establish you're a real person, find out what brought them here.",
    maxMessages: 3,
    guidance: [
      "They've just opened a conversation with you (first 1-3 messages).",
      "Rules:",
      "- Treat this like meeting someone at a bar, not a sales call.",
      "- Banter first. Match their energy.",
      "- Soft-probe: 'what got you into X?' or 'what are you working on these days?'",
      "- Do NOT pitch. Do NOT mention services.",
      "- If they came in via a growth tool / reel / comment, reference that naturally.",
    ].join("\n"),
    exitConditions: [
      "They mention a business / project / goal → qualify",
      "They ask what you do → qualify (give a tight 1-line answer, turn back to them)",
      "They ghost after 2 follow-ups → dead",
    ],
  },

  // ─── NEPQ qualify: connect + situation ──────────────────────────────────
  qualify: {
    stage: "qualify",
    objective: "Understand their business, role, and whether they're a fit for OASIS AI.",
    maxMessages: 4,
    guidance: [
      "You're qualifying. NEPQ situation questions.",
      "Ask ONE question at a time. Never stack.",
      "Good qualifying questions:",
      "- 'what does [their business] look like these days?'",
      "- 'how are you handling [the thing they mentioned] right now?'",
      "- 'who's the main person running [X] — is it you or a team?'",
      "Signals to escalate to 'pain':",
      "- They mention a frustration, manual process, or bottleneck",
      "- They name a specific volume of leads / DMs / tasks",
      "- They ask you a direct question about automation or AI",
      "If they're clearly NOT ICP (wrong region, wrong niche, hobby account) → move to closed_lost.",
    ].join("\n"),
    exitConditions: [
      "They share a concrete pain → pain",
      "They're out of ICP → closed_lost",
      "They stall for 2 turns → soft probe once more, else dead",
    ],
  },

  // ─── NEPQ pain: consequence + implication ───────────────────────────────
  pain: {
    stage: "pain",
    objective: "Expand the problem they just surfaced. Make the cost of doing nothing visible.",
    maxMessages: 4,
    guidance: [
      "They've named a pain. Your job is to make it bigger and more real — IN THEIR OWN WORDS.",
      "NEPQ consequence questions:",
      "- 'what happens if that keeps going for another 6 months?'",
      "- 'how much time is that eating each week?'",
      "- 'what would it mean for [their goal] if that was just... handled?'",
      "Rules:",
      "- Still ONE question at a time.",
      "- Do NOT present a solution yet. Do NOT mention OASIS yet.",
      "- Reflect their pain back before probing further ('yeah, that's brutal — so is it more the [X] or the [Y]?').",
      "Signals to escalate to 'solution':",
      "- They say 'that's exactly what I need help with' or similar",
      "- They ask 'is that something you do?' or 'can you fix that?'",
    ].join("\n"),
    exitConditions: [
      "They explicitly ask for help / solution → solution",
      "They minimize / downplay → qualify (re-engage)",
      "They ghost 2x → dead",
    ],
  },

  // ─── NEPQ solution: present fit + commit ────────────────────────────────
  solution: {
    stage: "solution",
    objective: "Show fit in 1-2 short messages, offer a conversation (not a call).",
    maxMessages: 3,
    guidance: [
      "They're ready to hear how you can help. Don't blow it.",
      "Rules:",
      "- ONE short paragraph explaining the specific fit. No bullet lists. No brochure.",
      "- Tie it directly back to what THEY said (use their words).",
      "- Offer a conversation — 'want to jump on a quick 15 min to walk through it?' NOT 'book a call'.",
      "- If they say yes → move to booked (link Calendly / ask for best time).",
      "- If they hesitate → treat as objection and move to 'objection'.",
      "- Do NOT list features. Do NOT send screenshots unless asked.",
      "Pricing:",
      "- If they ask 'how much?' — give a rough range in ONE short line, then turn it back: 'depends on setup, but usually lands in $X-$Y/mo range. what kind of volume are you running?'",
      "- Never send a formal quote in DM.",
    ].join("\n"),
    exitConditions: [
      "They say yes to a convo → booked",
      "They push back on anything → objection",
      "They ghost → follow_up sequence (handled by cron)",
    ],
  },

  // ─── Objection handling ─────────────────────────────────────────────────
  objection: {
    stage: "objection",
    objective: "Surface the real concern (usually behind the stated one), resolve it, return to solution.",
    maxMessages: 4,
    guidance: [
      "They pushed back. Do NOT defend. Do NOT restate price. Do NOT over-explain.",
      "",
      "The NEPQ move:",
      "1. Acknowledge without agreeing ('yeah that's fair')",
      "2. Isolate ('is it more the [price thing] or the [time thing]?')",
      "3. Reframe through THEIR own words from earlier ('earlier you said [pain] — does fixing that still matter more than [objection]?')",
      "4. Offer the easiest next step, not the biggest one.",
      "",
      "Never:",
      "- Drop price to handle price objection. Never discount in DM.",
      "- Say 'I understand but...' — the 'but' invalidates everything.",
      "- Push hard. If they're really not ready, stage them to follow_up and let time work.",
      "",
      "If the objection is 'bot_check' — see AI-detection handler. Be direct, not defensive.",
    ].join("\n"),
    exitConditions: [
      "Objection resolved → solution",
      "Hard no / angry → closed_lost",
      "Asked to circle back later → follow_up (cron will re-engage)",
    ],
  },

  // ─── Terminal stages ────────────────────────────────────────────────────
  booked: {
    stage: "booked",
    objective: "Confirm the call, send the link, set expectations.",
    maxMessages: 2,
    guidance: [
      "They agreed to a convo. Lock it in.",
      "- Send booking link (calendly.com/konamak/15min).",
      "- Confirm timezone if not already clear.",
      "- Tell them what to expect ('I'll ask about [X] and walk you through what this would look like for you — should take 15').",
      "- Don't keep selling. They're already in. Protect the appointment.",
    ].join("\n"),
    exitConditions: ["Call happens → moved manually by CC to closed_won / closed_lost"],
  },

  closed_won: {
    stage: "closed_won",
    objective: "They're a client. Thread is archival — AI should not reply unless they ask something.",
    maxMessages: 999,
    guidance: [
      "This is a paying client relationship. The AI does NOT speak on behalf of CC here.",
      "If they message, escalate to human (pending_ai_draft but do NOT auto-send).",
    ].join("\n"),
    exitConditions: [],
  },

  closed_lost: {
    stage: "closed_lost",
    objective: "Politely close the loop. No re-engagement.",
    maxMessages: 1,
    guidance: [
      "They're not buying. Respect it.",
      "- One-line graceful close: 'all good — if anything changes down the road, holler'.",
      "- No link. No CTA. No follow-up sequence.",
      "- Do NOT auto-reply again unless THEY restart the conversation.",
    ].join("\n"),
    exitConditions: [],
  },

  dead: {
    stage: "dead",
    objective: "Thread is stale. No activity in 14+ days. Don't send.",
    maxMessages: 0,
    guidance: "Do not reply. This thread was auto-marked dead by the stale-lead cron.",
    exitConditions: [],
  },
};

/**
 * Guidance block injected into system prompt per current stage.
 */
export function stageGuidance(stage: Stage): string {
  const def = STAGE_DEFS[stage];
  if (!def) return "";
  return [
    `# CURRENT STAGE: ${stage.toUpperCase()}`,
    `Objective: ${def.objective}`,
    "",
    def.guidance,
    "",
    def.exitConditions.length > 0 ? `Stage progression signals: ${def.exitConditions.join(" | ")}` : "",
    `Soft message cap at this stage: ${def.maxMessages}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Compute the next stage given the current stage + classifier signals.
 * Kept deterministic so it's debuggable — the Claude classify step recommends
 * transitions, but this function is the only thing allowed to apply them.
 */
export function nextStage(
  current: Stage,
  signals: {
    detectedObjection?: string | null;
    bookedCall?: boolean;
    explicitNo?: boolean;
    askedForHelp?: boolean;
    sharedPain?: boolean;
    stalled?: boolean;
    outOfIcp?: boolean;
    botCheck?: boolean;
  }
): Stage {
  // Terminal stages don't move
  if (TERMINAL_STAGES.includes(current)) return current;

  // Hard overrides
  if (signals.bookedCall) return "booked";
  if (signals.explicitNo) return "closed_lost";
  if (signals.outOfIcp) return "closed_lost";
  if (signals.botCheck) {
    // Stay in current stage, bot-check handled inline — NOT a stage move
    return current;
  }
  if (signals.detectedObjection) return "objection";

  // Progressive advancement
  switch (current) {
    case "cold":
      // Any reply exits cold; classifier marks it
      return "opener";
    case "opener":
      if (signals.sharedPain) return "pain";
      if (signals.askedForHelp) return "solution";
      return "qualify";
    case "qualify":
      if (signals.sharedPain) return "pain";
      if (signals.askedForHelp) return "solution";
      if (signals.stalled) return current; // stay — follow-up cron handles dead
      return current;
    case "pain":
      if (signals.askedForHelp) return "solution";
      return current;
    case "solution":
      // Stays until booked / objection / closed_lost (all handled above)
      return current;
    case "objection":
      // Resolved? Classifier should have marked askedForHelp or bookedCall.
      // Otherwise stay until resolution.
      return current;
    default:
      return current;
  }
}
