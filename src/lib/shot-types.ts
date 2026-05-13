/**
 * Output schema for the Shot List Generator.
 *
 * The schema is render-engine-agnostic: durations stay in seconds (Hyperframes'
 * native unit, `data-duration`), and Remotion adapters multiply by fps. The
 * optional `transition_in` enum mirrors Hyperframes' built-in shader
 * transitions; Remotion treats unknown transitions as editor notes.
 *
 * Reference shapes:
 *   - ~/Code/voxlabs/storyboard/examples/sample_shotlist.json (simpler shape)
 *   - ~/Code/voxlabs/storyboard/.agents/skills/hyperframes/rules/compositions.md
 *
 * Sprint C ascension: this same JSON is the input file for the auto-cut
 * pipeline. Fields here that are NOT used at render time (action, framing,
 * notes) are still useful as shot-day documentation for the editor.
 */

export type Format =
  | "9:16 reel (15-30s)"
  | "9:16 reel (60s)"
  | "16:9 commercial (30s)"
  | "16:9 commercial (60s)";

export type TransitionIn =
  | "cut"
  | "cross_warp"
  | "whip_pan"
  | "light_leak"
  | "glitch"
  | "dissolve";

export interface Shot {
  shot_number: number;
  /** What happens visually, 1–2 sentences. Director / editor reads this. */
  action: string;
  /** Close-up, medium, wide, OTS, low angle, etc. */
  framing: string;
  /** Per-shot duration in seconds. Sums to ±10% of total_duration_sec. */
  duration_sec: number;
  /** V/O line, sound design, music cue, or "ambient". */
  audio: string;
  /** Defaults to "cut" when omitted. Optional shader transition for Hyperframes. */
  transition_in?: TransitionIn;
  /** Optional director's note. */
  notes?: string;
}

export interface ShotListResult {
  format: string;
  total_duration_sec: number;
  shot_count: number;
  shots: Shot[];
}
