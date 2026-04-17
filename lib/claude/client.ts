/**
 * Anthropic API client — thin fetch wrapper.
 * Keeps us off @anthropic-ai/sdk to minimize dependencies.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const MODELS = {
  // Fast classifier — cheap & quick
  HAIKU: "claude-haiku-4-5-20251001",
  // Reply writer — quality + voice
  SONNET: "claude-sonnet-4-6",
} as const;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCallOpts {
  model: string;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface ClaudeResponse {
  text: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude(opts: ClaudeCallOpts): Promise<ClaudeResponse> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in env");
  }

  const body = {
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    ...(opts.stopSequences ? { stop_sequences: opts.stopSequences } : {}),
  };

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "<no body>");
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    stop_reason: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const text = (json.content || [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("");

  return {
    text,
    stopReason: json.stop_reason ?? null,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}

/**
 * Parse a JSON object out of a Claude response. Claude occasionally wraps in
 * markdown fences or adds prose — strip both.
 */
export function extractJson<T = unknown>(text: string): T {
  // Strip markdown fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  // Find first { and last } — lenient parse
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`No JSON object found in response: ${text.slice(0, 200)}`);
  }
  const body = cleaned.slice(first, last + 1);
  return JSON.parse(body) as T;
}
