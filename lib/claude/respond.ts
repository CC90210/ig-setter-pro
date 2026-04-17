/**
 * Sonnet responder — writes the actual DM reply.
 *
 * Assembles the full system prompt from:
 *  - Voice rules (always)
 *  - Stage guidance (current stage only)
 *  - Objection framework (if objection detected)
 *  - Friend mode (replaces voice/stage entirely if is_friend=1)
 *  - Per-account custom system prompt (appended)
 */

import { callClaude, MODELS, type ClaudeMessage } from "./client";
import { voiceSystemBlock, friendVoiceBlock, VOICE_RULES } from "../doctrine/voice-rules";
import { stageGuidance, type Stage } from "../doctrine/pipeline";
import { objectionGuidance, type ObjectionType } from "../doctrine/objections";

export interface ResponderInput {
  stage: Stage;
  inbound: string;
  recentMessages: Array<{ direction: "inbound" | "outbound"; content: string }>;
  isFriend: boolean;
  objection: ObjectionType | null;
  botCheck: boolean;
  accountSystemPrompt?: string | null;
  accountDisplayName?: string | null;
  // Personalization for proactive cold outreach
  prospectContext?: {
    niche?: string;
    location?: string;
    hook?: string;
    bio?: string;
  };
}

export interface ResponderOutput {
  reply: string;
  rawText: string;     // full Claude output before trimming
  inputTokens: number;
  outputTokens: number;
}

export async function respond(input: ResponderInput): Promise<ResponderOutput> {
  const system = buildSystemPrompt(input);

  // Message history — we pass prior turns as Claude messages so Sonnet can
  // see the full context the same way a human would.
  const messages: ClaudeMessage[] = [];
  const trimmed = (input.recentMessages || []).slice(-12);
  for (const m of trimmed) {
    messages.push({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.content,
    });
  }

  // Current inbound we need to reply to
  messages.push({ role: "user", content: input.inbound });

  const maxTokens = Math.ceil(
    (VOICE_RULES.lengthCaps[input.stage] ?? 280) * 1.5 // chars → rough tokens
  );

  const res = await callClaude({
    model: MODELS.SONNET,
    system,
    messages,
    maxTokens: Math.max(200, maxTokens),
    temperature: input.isFriend ? 0.85 : 0.75,
  });

  const cleaned = sanitizeReply(res.text);

  return {
    reply: cleaned,
    rawText: res.text,
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
  };
}

function buildSystemPrompt(input: ResponderInput): string {
  const blocks: string[] = [];

  // Friend mode replaces voice + stage entirely
  if (input.isFriend) {
    blocks.push(friendVoiceBlock());
  } else {
    blocks.push(voiceSystemBlock());
    blocks.push("");
    blocks.push(stageGuidance(input.stage));

    if (input.botCheck) {
      blocks.push("");
      blocks.push(objectionGuidance("bot_check"));
    } else if (input.objection) {
      blocks.push("");
      blocks.push(objectionGuidance(input.objection));
    }

    // Cold outreach personalization
    if (input.stage === "cold" && input.prospectContext) {
      const ctx = input.prospectContext;
      blocks.push("");
      blocks.push("# PROSPECT CONTEXT (for personalization)");
      if (ctx.niche) blocks.push(`Niche: ${ctx.niche}`);
      if (ctx.location) blocks.push(`Location: ${ctx.location}`);
      if (ctx.hook) blocks.push(`Personalization hook: ${ctx.hook}`);
      if (ctx.bio) blocks.push(`Their bio snippet: ${ctx.bio}`);
      blocks.push("");
      blocks.push("Use the hook naturally. Do NOT sound like you copied it. Do NOT mention scraping or that you 'noticed' them algorithmically.");
    }
  }

  // Per-account custom prompt appended last
  if (input.accountSystemPrompt && input.accountSystemPrompt.trim().length > 0) {
    blocks.push("");
    blocks.push("# ACCOUNT-SPECIFIC CONTEXT");
    blocks.push(input.accountSystemPrompt.trim());
  }

  // Length enforcement reminder
  const cap = VOICE_RULES.lengthCaps[input.stage] ?? 280;
  blocks.push("");
  blocks.push(`# OUTPUT FORMAT`);
  blocks.push(`Reply with ONLY the DM text. No quotes, no labels, no explanation.`);
  blocks.push(`Hard cap: ~${cap} characters. Prefer much shorter.`);

  return blocks.join("\n");
}

/**
 * Strip common Claude wrappers: markdown, leading labels, quote marks, sign-offs.
 */
function sanitizeReply(text: string): string {
  let out = text.trim();

  // Remove wrapping quotes
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }

  // Remove leading labels Claude sometimes adds
  out = out.replace(/^(reply|dm|message|response):\s*/i, "");

  // Remove markdown fences
  out = out.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");

  // Strip accidental sign-offs
  out = out.replace(/\s*(?:[-–—]\s*)?(?:cc|conaugh|kona)\s*$/i, "");
  out = out.replace(/\s*(?:best|cheers|regards|sincerely),?\s*$/i, "");

  return out.trim();
}
