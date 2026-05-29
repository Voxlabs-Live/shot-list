/**
 * Runtime validation + deterministic post-processing for Shot List output.
 *
 * Doctrine (mirrors the hook-sheet hardening): the LLM does judgment
 * (the creative shot breakdown), the code does arithmetic and enforcement.
 *   - `total_duration_sec` and `shot_count` are recomputed from `shots` so the
 *     summary card can never disagree with the shots below it (the model's
 *     self-reported totals are discarded).
 *   - `shot_number` is renumbered 1..N from array order.
 *   - `transition_in` is dropped unless it's a valid non-"cut" enum value, so
 *     the exported JSON stays render-engine-clean.
 *
 * FORMAT_TARGET_SEC and the transition enum are duplicated from generate.ts /
 * shot-types.ts / vibe-kit-eval on purpose — they live in different repos.
 */
import type { Shot, ShotListResult, TransitionIn } from "./shot-types";

export const VALID_TRANSITIONS: ReadonlySet<string> = new Set([
  "cut",
  "cross_warp",
  "whip_pan",
  "light_leak",
  "glitch",
  "dissolve",
]);

export const FORMAT_TARGET_SEC: Record<string, number> = {
  "9:16 reel (15-30s)": 22,
  "9:16 reel (60s)": 58,
  "16:9 commercial (30s)": 28,
  "16:9 commercial (60s)": 58,
};

/**
 * Clean the model's shots into a canonical, render-engine-safe array:
 * sequential shot_number from 1, numeric durations, and transition_in present
 * only when it's a real non-"cut" enum value.
 */
export function normalizeShots(shots: Shot[]): Shot[] {
  return (shots ?? []).map((s, i) => {
    const clean: Shot = {
      shot_number: i + 1,
      action: typeof s?.action === "string" ? s.action : "",
      framing: typeof s?.framing === "string" ? s.framing : "",
      duration_sec: typeof s?.duration_sec === "number" ? s.duration_sec : 0,
      audio: typeof s?.audio === "string" ? s.audio : "",
    };
    if (
      typeof s?.transition_in === "string" &&
      s.transition_in !== "cut" &&
      VALID_TRANSITIONS.has(s.transition_in)
    ) {
      clean.transition_in = s.transition_in as TransitionIn;
    }
    if (typeof s?.notes === "string" && s.notes.trim().length > 0) {
      clean.notes = s.notes;
    }
    return clean;
  });
}

/** Authoritative totals — derived from the shots, never trusted from the model. */
export function computeTotals(shots: Shot[]): { total_duration_sec: number; shot_count: number } {
  const sum = (shots ?? []).reduce((a, s) => a + (typeof s?.duration_sec === "number" ? s.duration_sec : 0), 0);
  return { total_duration_sec: Math.round(sum * 10) / 10, shot_count: (shots ?? []).length };
}

/** Drift of the shot-duration sum from the format's target window. */
export function driftInfo(shots: Shot[], format: string): { sum: number; target: number; drift: boolean } {
  const target = FORMAT_TARGET_SEC[format] ?? 0;
  const sum = (shots ?? []).reduce((a, s) => a + (typeof s?.duration_sec === "number" ? s.duration_sec : 0), 0);
  const drift = target > 0 ? Math.abs(sum - target) > target * 0.1 : false;
  return { sum: Math.round(sum * 10) / 10, target, drift };
}

export interface Violation {
  code: string;
  /** Phrased as a correction instruction — fed verbatim into the repair pass. */
  message: string;
}

/**
 * Validate the MODEL's output. Returns violations to feed into a single
 * corrective re-prompt. Note: total_duration_sec / shot_count / shot_number are
 * NOT validated here — they're recomputed deterministically, so the model can't
 * break them. Duration drift IS a violation because only the model can fix it
 * (redistribute durations across shots).
 */
export function validateShotModelOutput(data: Partial<ShotListResult>, format: string): Violation[] {
  const v: Violation[] = [];

  if (!Array.isArray(data.shots) || data.shots.length === 0) {
    v.push({ code: "shots", message: "`shots` must be a non-empty array of shot objects." });
    return v; // nothing else is checkable without shots
  }

  const shapeOk = data.shots.every(
    (s) =>
      typeof s?.action === "string" &&
      typeof s?.framing === "string" &&
      typeof s?.duration_sec === "number" &&
      typeof s?.audio === "string",
  );
  if (!shapeOk) {
    v.push({ code: "shots_shape", message: "Each shot needs action, framing, duration_sec (number) and audio." });
  }

  const badTrans = new Set<string>();
  for (const s of data.shots) {
    if (s?.transition_in === undefined || s?.transition_in === null) continue;
    if (typeof s.transition_in !== "string" || !VALID_TRANSITIONS.has(s.transition_in)) {
      badTrans.add(String(s.transition_in));
    }
  }
  if (badTrans.size) {
    v.push({ code: "transition_enum", message: `Invalid transition_in values: ${[...badTrans].join(", ")}. Use only: cut, cross_warp, whip_pan, light_leak, glitch, dissolve (or omit the field).` });
  }

  const { sum, target, drift } = driftInfo(data.shots as Shot[], format);
  if (drift) {
    v.push({ code: "duration_drift", message: `The shot durations sum to ${sum}s but the ${format} target is ~${target}s. Redistribute the per-shot durations so they sum to about ${target}s WITHOUT changing the number of shots.` });
  }

  return v;
}
