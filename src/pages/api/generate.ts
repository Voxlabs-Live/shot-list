import type { APIRoute } from "astro";
import { callCached, repair, parseJson } from "../../lib/anthropic";
import { readDemo, consumeDemo } from "../../lib/rate-limit";
import { SHOT_LIST_SYSTEM_PROMPT } from "../../prompts/system";
import type { ShotListResult } from "../../lib/shot-types";
import type { ApiResponse } from "../../lib/types";
import {
  validateShotModelOutput,
  normalizeShots,
  computeTotals,
  driftInfo,
  FORMAT_TARGET_SEC,
} from "../../lib/validate";

export const prerender = false;

const MAX_TOKENS = 3500;

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
  let stopReason: string | null;
  try {
    const result = await callCached({
      systemPrompt: SHOT_LIST_SYSTEM_PROMPT,
      userInput,
      maxTokens: MAX_TOKENS,
    });
    raw = result.text;
    stopReason = result.stopReason;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = msg.includes("ANTHROPIC_API_KEY")
      ? "missing_api_key"
      : "anthropic_error";
    return json<GenerateResponseData>({ ok: false, error: code, message: msg });
  }

  if (stopReason === "max_tokens") {
    return json<GenerateResponseData>({
      ok: false,
      error: "truncated",
      message: "That input produced a response too long to finish. Trim the concept and try again.",
    });
  }

  // Step 4 — parse + validate; one corrective re-prompt if the model drifted
  // (bad shape, invalid transition, or duration sum outside the target window)
  let data = tryParse(raw);
  let violations = data
    ? validateShotModelOutput(data, format)
    : [{ code: "json", message: "Return valid strict JSON only, matching the schema exactly." }];

  if (violations.length > 0) {
    try {
      const fixed = await repair({
        systemPrompt: SHOT_LIST_SYSTEM_PROMPT,
        userInput,
        priorRaw: raw,
        violations: violations.map((v) => v.message),
        maxTokens: MAX_TOKENS,
      });
      if (fixed.stopReason !== "max_tokens") {
        const repaired = tryParse(fixed.text);
        if (repaired && Array.isArray(repaired.shots) && repaired.shots.length > 0) {
          const v2 = validateShotModelOutput(repaired, format);
          if (v2.length <= violations.length) {
            data = repaired;
            violations = v2;
          }
        }
      }
    } catch {
      // Swallow — deterministic post-processing below still salvages a usable result.
    }
  }

  // Step 5 — shots are required; nothing else is salvageable without them
  if (!data || !Array.isArray(data.shots) || data.shots.length === 0) {
    return json<GenerateResponseData>({
      ok: false,
      error: "incomplete_output",
      message: "The tool returned an incomplete result. Please try again.",
    });
  }

  // Step 6 — deterministic post-processing (authoritative)
  const shots = normalizeShots(data.shots);
  const { total_duration_sec, shot_count } = computeTotals(shots);
  const { target, drift } = driftInfo(shots, format);

  const out: GenerateResponseData = {
    format,
    total_duration_sec,
    shot_count,
    shots,
    duration_drift: drift,
    target_duration_sec: target,
  };

  // Step 7 — consume one demo credit
  await consumeDemo(request);
  const remaining =
    usage.remaining === Infinity ? -1 : Math.max(0, usage.remaining - 1);

  return json<GenerateResponseData>({ ok: true, data: out, remaining });
};

function tryParse(raw: string): ShotListResult | null {
  try {
    return parseJson<ShotListResult>(raw);
  } catch {
    return null;
  }
}

function json<T>(payload: ApiResponse<T>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
