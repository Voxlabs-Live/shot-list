import type { APIRoute } from "astro";
import { callCached, parseJson } from "../../lib/anthropic";
import { readDemo, consumeDemo } from "../../lib/rate-limit";
import { SHOT_LIST_SYSTEM_PROMPT } from "../../prompts/system";
import type { ShotListResult } from "../../lib/shot-types";
import type { ApiResponse } from "../../lib/types";

export const prerender = false;

const FORMAT_TARGET_SEC: Record<string, number> = {
  "9:16 reel (15-30s)": 22,
  "9:16 reel (60s)": 58,
  "16:9 commercial (30s)": 28,
  "16:9 commercial (60s)": 58,
};

interface GenerateResponseData extends ShotListResult {
  /** True when sum(shot.duration_sec) drifted outside ±10% of the format target. */
  duration_drift?: boolean;
  /** Target seconds for the chosen format (echoed for the UI to render the warning). */
  target_duration_sec?: number;
}

export const POST: APIRoute = async ({ request }) => {
  // Step 1 — rate limit
  const usage = await readDemo(request);
  if (usage.exceeded) {
    return json<GenerateResponseData>({
      ok: false,
      error: "rate_limit_exceeded",
      message: "Demo limit reached. Fork the repo to keep using.",
    });
  }

  // Step 2 — validate input
  let body: { concept?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return json<GenerateResponseData>({
      ok: false,
      error: "invalid_input",
      message: "Body must be JSON with `concept` and `format` fields.",
    });
  }
  const concept = (body.concept ?? "").trim();
  const format = (body.format ?? "").trim();
  if (!concept || !format) {
    return json<GenerateResponseData>({
      ok: false,
      error: "invalid_input",
      message: "Provide both the concept (script or brief) and the chosen format.",
    });
  }
  if (!(format in FORMAT_TARGET_SEC)) {
    return json<GenerateResponseData>({
      ok: false,
      error: "invalid_input",
      message: `Unknown format "${format}". Pick one of the four.`,
    });
  }
  if (concept.length > 8000) {
    return json<GenerateResponseData>({
      ok: false,
      error: "invalid_input",
      message: "Concept too long. Trim to ≤8k characters.",
    });
  }

  // Step 3 — call Claude
  const userInput = `FORMAT: ${format}\n\n---\n\nCONCEPT / SCRIPT:\n\n${concept}`;
  let raw: string;
  try {
    const result = await callCached({
      systemPrompt: SHOT_LIST_SYSTEM_PROMPT,
      userInput,
      maxTokens: 3500,
    });
    raw = result.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("ANTHROPIC_API_KEY")
      ? "missing_api_key"
      : "anthropic_error";
    return json<GenerateResponseData>({ ok: false, error: code, message: msg });
  }

  // Step 4 — parse JSON
  let data: ShotListResult;
  try {
    data = parseJson<ShotListResult>(raw);
  } catch {
    return json<GenerateResponseData>({
      ok: false,
      error: "parse_error",
      message: "Claude returned non-JSON. Try again.",
    });
  }

  // Step 5 — duration sanity (±10% tolerance, soft warning rather than reject)
  const target = FORMAT_TARGET_SEC[format];
  const sum = data.shots.reduce((s, sh) => s + (sh.duration_sec ?? 0), 0);
  const drift = Math.abs(sum - target) > target * 0.1;

  // Step 6 — consume one demo credit
  await consumeDemo(request);
  const remaining =
    usage.remaining === Infinity ? -1 : Math.max(0, usage.remaining - 1);

  return json<GenerateResponseData>({
    ok: true,
    data: { ...data, duration_drift: drift, target_duration_sec: target },
    remaining,
  });
};

function json<T>(payload: ApiResponse<T>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
