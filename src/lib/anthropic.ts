import Anthropic from "@anthropic-ai/sdk";

/**
 * Default model for both production tools and hosted demos. Sonnet 4.6 is the
 * right balance of nuance + cost for messy-text-extraction tasks. Override at
 * call site if a specific tool needs Opus or Haiku.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

/** Lazy-init so a missing key doesn't crash import. */
export function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. In local dev: export it or put it in .env.local. " +
        "On Vercel: set it in the project's env vars."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Retry transient Anthropic failures (overloaded / rate-limited / 5xx) a couple
 * of times with linear backoff. A single demo run shouldn't hard-fail because
 * the API was briefly overloaded.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable =
        status === 429 || status === 529 || (typeof status === "number" && status >= 500);
      if (!retryable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Call Claude with a cached system prompt. The system block is marked
 * cache_control: ephemeral so repeat calls within ~5 minutes get a ~90%
 * discount on system-prompt tokens AND lower latency.
 *
 * Pass the user input as `userInput` — that part is NOT cached.
 *
 * The response.content[0].text string is returned directly; callers parse it
 * (typically as JSON).
 */
export async function callCached(opts: {
  systemPrompt: string;
  userInput: string;
  maxTokens?: number;
  model?: string;
}): Promise<{ text: string; usage: Anthropic.Messages.Usage; stopReason: string | null }> {
  const response = await withRetry(() =>
    client().messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      system: [
        {
          type: "text",
          text: opts.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: opts.userInput }],
    }),
  );

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }
  return { text: block.text, usage: response.usage, stopReason: response.stop_reason };
}

/**
 * One corrective re-prompt. Replays the original turn, the model's flawed
 * output, and a list of violations, asking for fully-corrected JSON. Used when
 * `validate*` finds structural problems (or duration drift) the prompt alone
 * didn't prevent.
 */
export async function repair(opts: {
  systemPrompt: string;
  userInput: string;
  priorRaw: string;
  violations: string[];
  maxTokens?: number;
  model?: string;
}): Promise<{ text: string; usage: Anthropic.Messages.Usage; stopReason: string | null }> {
  const fixMessage =
    `Your previous response had these problems:\n` +
    opts.violations.map((m, i) => `${i + 1}. ${m}`).join("\n") +
    `\n\nReturn the COMPLETE corrected JSON, fixing every problem above. ` +
    `Strict JSON only — no prose, no code fences.`;

  const response = await withRetry(() =>
    client().messages.create({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 2048,
      system: [
        {
          type: "text",
          text: opts.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: opts.userInput },
        { role: "assistant", content: opts.priorRaw },
        { role: "user", content: fixMessage },
      ],
    }),
  );

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }
  return { text: block.text, usage: response.usage, stopReason: response.stop_reason };
}

/**
 * Parse JSON from a Claude response. Strips Markdown code fences if present
 * (Claude occasionally wraps output in ```json … ``` even when asked not to).
 */
export function parseJson<T>(text: string): T {
  let cleaned = text.trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) cleaned = fenced[1].trim();
  return JSON.parse(cleaned) as T;
}
