/**
 * Objection Classification + Rebuttal Tree
 *
 * 12 objection types with NEPQ-framed rebuttal guidance.
 * The rebuttal text is NOT a template — it's guidance for the Sonnet responder
 * so the final DM sounds like CC, not a script.
 */

export const OBJECTION_TYPES = [
  "price",
  "timing",
  "trust",
  "spouse",
  "not_now",
  "competitor",
  "happy_current",
  "no_budget",
  "need_info",
  "too_busy",
  "tried_before",
  "bot_check",
  "other",
] as const;

export type ObjectionType = (typeof OBJECTION_TYPES)[number];

export interface ObjectionPattern {
  type: ObjectionType;
  label: string;
  detectionHints: string[];  // phrases the classifier uses to spot this
  rootCause: string;          // what's *actually* going on underneath
  rebuttalFramework: string;  // what the reply should DO (not what it should SAY)
  exampleMoves: string[];     // reference examples — DO NOT paste verbatim
  forbidden: string[];        // things the reply must NOT do
}

export const OBJECTION_PATTERNS: Record<ObjectionType, ObjectionPattern> = {
  price: {
    type: "price",
    label: "Price / too expensive",
    detectionHints: [
      "too expensive", "can't afford", "out of budget", "how much",
      "that's a lot", "pricey", "cheaper option", "do you have anything less",
    ],
    rootCause: "Usually NOT actually about the number — it's about not seeing enough value yet, or they haven't compared it to the cost of NOT fixing the problem.",
    rebuttalFramework:
      "Isolate whether it's the number or the value. Never defend the price. Re-surface the cost of NOT solving it (from their earlier pain). Do the math for them — convert price into hours saved, leads captured, or revenue unlocked.",
    exampleMoves: [
      "'yeah fair — is it that the number itself doesn't work, or is it more that you're not 100% sure it'll pay back?'",
      "'honestly most people say that first. then when we map out [X hours/week on DMs] vs [$Y/mo], it flips pretty quick. wanna see the math?'",
      "'what were you thinking it'd run?'",
    ],
    forbidden: [
      "Never offer a discount in DM.",
      "Never justify the price by listing features.",
      "Never apologize for it.",
    ],
  },

  timing: {
    type: "timing",
    label: "Bad timing / busy season",
    detectionHints: [
      "bad time", "crazy right now", "maybe in a few months", "after [month/season]",
      "once things settle", "in the new year", "heading into",
    ],
    rootCause: "Either genuinely hectic OR polite 'no'. The real test is whether they'd take it if it started itself.",
    rebuttalFramework:
      "Acknowledge, then reframe: the busier they are, the more the problem compounds. Offer the lightest possible next step — not a call, just a 'should I send you something to look at when you've got 5 min?'",
    exampleMoves: [
      "'totally get it. quick one — is [the pain they named] one of the things making it crazy, or is it separate?'",
      "'yeah. real question — would waiting 3 months cost you more in [X] than it's worth?'",
      "'no stress. want me to send you a 2-min loom when you've got a breather? no call needed.'",
    ],
    forbidden: [
      "Don't pressure timing. If they're truly out, move to follow_up politely.",
      "Don't guilt-trip ('you said this was important...').",
    ],
  },

  trust: {
    type: "trust",
    label: "Don't know you / skeptical",
    detectionHints: [
      "who are you", "how do I know", "never heard of you", "seems sketchy",
      "random DM", "is this legit",
    ],
    rootCause: "Valid. You did slide into their DMs.",
    rebuttalFramework:
      "Be direct. Show work not words — reference a real client result, a post, or your site. Don't argue for credibility, demonstrate it.",
    exampleMoves: [
      "'fair q. I run OASIS AI — we build DM + lead automations for local service businesses. site's oasisai.work if you wanna peek. happy to send you a screenshot of what it does for [similar business].'",
      "'I get it — I'd be skeptical too. no pressure at all. what would make this feel less random?'",
    ],
    forbidden: [
      "Never get defensive.",
      "Never list credentials in a wall of text.",
      "Never send multiple links at once.",
    ],
  },

  spouse: {
    type: "spouse",
    label: "Need to talk to partner / team",
    detectionHints: [
      "talk to my [wife/husband/partner]", "run it by [team/cofounder]",
      "need to discuss", "my business partner", "check with",
    ],
    rootCause: "Often real, sometimes a soft stall. Either way, don't fight it — give them the tools to sell it internally.",
    rebuttalFramework:
      "Respect the ask. Then equip them — offer to hop on a 3-way convo, or send a short 2-min loom they can share.",
    exampleMoves: [
      "'smart — want me to send you a 90-sec loom you can forward to [them]? saves you repeating the whole pitch.'",
      "'works. want to do a 15-min convo with both of you so I can answer their questions too?'",
    ],
    forbidden: [
      "Don't bypass the partner ('just make the call yourself').",
      "Don't pressure a timeline.",
    ],
  },

  not_now: {
    type: "not_now",
    label: "Not now / maybe later",
    detectionHints: [
      "not right now", "maybe later", "down the road", "in the future",
      "not a priority", "on the back burner",
    ],
    rootCause: "Could be real. Usually means they don't feel the pain sharply enough yet, or they lost the urgency between messages.",
    rebuttalFramework:
      "Re-surface the urgency from THEIR earlier words. One question. If they still say no, park them gracefully in follow_up — don't force.",
    exampleMoves: [
      "'no worries. quick one — earlier you mentioned [pain]. is that something that'll get easier on its own, or does it tend to grow?'",
      "'all good. want me to check back in like 30 days?'",
    ],
    forbidden: [
      "Don't push past a second polite no.",
      "Don't send a third follow-up in the same thread.",
    ],
  },

  competitor: {
    type: "competitor",
    label: "Already evaluating / using someone else",
    detectionHints: [
      "using [competitor]", "work with", "already have", "currently with",
      "manychat", "zapier", "already set up", "our agency does",
    ],
    rootCause: "They have a baseline — but baseline rarely = optimal. Your job is to find the gap without trashing the competitor.",
    rebuttalFramework:
      "Compliment the current solution briefly, then ask what it ISN'T doing well. You find the gap by asking.",
    exampleMoves: [
      "'nice, [competitor] is solid for [X]. curious — what's it NOT doing that you wish it would?'",
      "'got it. if you had a magic wand and could change one thing about your current setup, what'd it be?'",
    ],
    forbidden: [
      "Never trash a competitor by name.",
      "Never claim you're 'better at everything'.",
    ],
  },

  happy_current: {
    type: "happy_current",
    label: "Happy with current setup",
    detectionHints: [
      "we're good", "all set", "happy with what we have",
      "not looking to change",
    ],
    rootCause: "Either truly content, or haven't considered what they're missing. Don't push — ask one smart question and let them lead.",
    rebuttalFramework:
      "One genuine question that tests whether they're actually optimized or just settled. If they close the door, respect it.",
    exampleMoves: [
      "'all good. out of curiosity — what's the one thing you'd still want cleaner if it was free?'",
      "'makes sense. appreciate you saying so. if anything changes, I'm here.'",
    ],
    forbidden: [
      "Don't argue.",
      "Don't keep probing after they say no twice.",
    ],
  },

  no_budget: {
    type: "no_budget",
    label: "Literally no money",
    detectionHints: [
      "no budget", "can't spend right now", "broke", "startup mode",
      "bootstrapping", "revenue's been slow",
    ],
    rootCause: "Different from 'price' — this is genuine cashflow, not sticker shock.",
    rebuttalFramework:
      "Compassion first. Then ask a qualifying question — is this a 'when the next deal closes' problem or a 'not for 6 months' problem? If the latter, move to follow_up gracefully.",
    exampleMoves: [
      "'all good — appreciate you being straight. is it a this-month thing or more like the next few months?'",
      "'got it. happy to check back in when things ease up. in the meantime if you ever want me to look at something for free just holler.'",
    ],
    forbidden: [
      "Don't pressure.",
      "Don't offer a payment plan unsolicited.",
    ],
  },

  need_info: {
    type: "need_info",
    label: "Need more info / send me details",
    detectionHints: [
      "send me more info", "have a brochure", "can you email me",
      "any case studies", "how does it work exactly",
    ],
    rootCause: "Often a soft brush-off — sending info dies in an inbox. Better to stay conversational.",
    rebuttalFramework:
      "Offer to show it live instead of sending a PDF. If they insist, send ONE short thing (loom or link) and ask for a callback time.",
    exampleMoves: [
      "'honestly faster to just show you — takes 10 min. wanna do it today or tomorrow?'",
      "'yeah — what'd be most useful: a 90-sec loom walkthrough, or a 15-min live convo?'",
    ],
    forbidden: [
      "Don't dump a brochure into the DM.",
      "Don't send 5 links.",
    ],
  },

  too_busy: {
    type: "too_busy",
    label: "No time to talk",
    detectionHints: [
      "no time", "too busy", "slammed", "back to back",
      "can't talk right now", "in meetings",
    ],
    rootCause: "Valid. The irony is usually that being too busy is the problem you'd be solving.",
    rebuttalFramework:
      "Ultra-light reframe: the reason you're too busy is the reason we'd work together. Offer async.",
    exampleMoves: [
      "'yeah ironic since that's kinda the whole point. want me to send a 2-min loom and you can watch whenever?'",
      "'no stress. when's the NEXT time you'd be free — even 15 min next week?'",
    ],
    forbidden: [
      "Don't ask 'when are you free' open-endedly — always offer 2 specific windows or async.",
    ],
  },

  tried_before: {
    type: "tried_before",
    label: "Tried automation before and it didn't work",
    detectionHints: [
      "tried it before", "didn't work", "did manychat", "hired an agency before",
      "got burned", "waste of money",
    ],
    rootCause: "Real trauma. They need to feel heard before they'll listen.",
    rebuttalFramework:
      "Acknowledge, then get specific about what went wrong — their answer tells you EXACTLY what to do differently.",
    exampleMoves: [
      "'yeah that's frustrating — what do you think went wrong with it?'",
      "'makes sense. what would make a second attempt feel different?'",
    ],
    forbidden: [
      "Don't say 'we're different' without evidence.",
      "Don't overpromise to overcome past burns.",
    ],
  },

  bot_check: {
    type: "bot_check",
    label: "Are you a bot / AI detection",
    detectionHints: [
      "are you a bot", "is this AI", "are you real", "is this a person",
      "chatgpt", "talking to a bot", "are you human",
    ],
    rootCause: "They want honesty. Lying destroys the whole thread. Admitting it handled right is fine.",
    rebuttalFramework:
      "Be HONEST. Don't play dumb. Reframe: 'I run an AI-assisted DM system for OASIS — helps me actually reply instead of ignoring people. when something real needs a human I jump in. what brought this up?'",
    exampleMoves: [
      "'ha fair question. yes and no — I run an AI-assisted setup so I can actually keep up with DMs. real human behind it (me, Conaugh). when something important comes up I jump in directly. what made you ask?'",
      "'honestly yeah — AI helps me triage, but you're talking to someone real when it matters. what's up?'",
    ],
    forbidden: [
      "NEVER lie. Never say 'no I'm a real person' when AI is responding.",
      "Don't be defensive or apologize excessively.",
      "Don't give a technical explanation.",
    ],
  },

  other: {
    type: "other",
    label: "Unclassified pushback",
    detectionHints: [],
    rootCause: "Unknown — the classifier couldn't bucket it.",
    rebuttalFramework:
      "Ask a clarifying question. Don't assume. 'what specifically is making you hesitant?' is always valid.",
    exampleMoves: [
      "'got it — what's the main thing making you unsure?'",
      "'fair. what would need to be true for this to be a yes?'",
    ],
    forbidden: [
      "Don't guess at what the objection is.",
    ],
  },
};

export function objectionGuidance(type: ObjectionType): string {
  const pattern = OBJECTION_PATTERNS[type];
  if (!pattern) return "";
  return [
    `# OBJECTION DETECTED: ${pattern.label}`,
    ``,
    `Root cause (what's usually really going on): ${pattern.rootCause}`,
    ``,
    `Framework for your reply:`,
    pattern.rebuttalFramework,
    ``,
    `Reference moves (DO NOT paste verbatim — match CC's voice):`,
    ...pattern.exampleMoves.map((m) => `- ${m}`),
    ``,
    `Must NOT:`,
    ...pattern.forbidden.map((f) => `- ${f}`),
  ].join("\n");
}

/**
 * Lightweight keyword-based pre-check for the classifier.
 * Returns a best-guess objection type (or null) from the raw message.
 * The Haiku classifier confirms/corrects this; this fallback keeps the
 * system functional if Claude API is unavailable.
 */
export function heuristicObjection(message: string): ObjectionType | null {
  const lower = message.toLowerCase();
  for (const type of OBJECTION_TYPES) {
    if (type === "other") continue;
    const pattern = OBJECTION_PATTERNS[type];
    for (const hint of pattern.detectionHints) {
      if (lower.includes(hint.toLowerCase())) {
        return type;
      }
    }
  }
  return null;
}
