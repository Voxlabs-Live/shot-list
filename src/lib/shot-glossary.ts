/**
 * Plain-English glossary for the jargon that shows up on a shot card.
 *
 * Two vocabularies a non-technical agency user shouldn't have to already know:
 *   1. TRANSITIONS — the shader-transition enum rendered on the amber "→" chips
 *      (snake_case, the shared vocabulary with the Hyperframes pipeline).
 *   2. FRAMINGS — common cinematography framing/angle terms. Unlike transitions
 *      these are free text from the model, so we match them best-effort by
 *      keyword rather than by an exact enum.
 *
 * Single source of truth for BOTH surfaces that teach the vocabulary:
 *   - the click-a-chip explainer popover (in-context, "what's THIS one?")
 *   - the collapsible "Shot list terms, explained" section under the result.
 *
 * The transition tokens are duplicated from validate.ts / shot-types.ts /
 * vibe-kit-eval on purpose — they live in different repos. If the enum changes,
 * update this alongside them. Presentation-only: no API/prompt/determinism impact.
 */

export interface GlossaryEntry {
  /** Canonical token — for transitions this matches the chip enum exactly. */
  token: string;
  /** Humanized display title for the popover + glossary. */
  title: string;
  /** One plain-English line. */
  blurb: string;
  /** Optional short example of when you'd reach for it. */
  example?: string;
}

// ─── Transitions (exact enum) ──────────────────────────────────────────────
export const TRANSITION_ORDER: string[] = [
  "cut",
  "cross_warp",
  "whip_pan",
  "light_leak",
  "glitch",
  "dissolve",
];

export const TRANSITION_GLOSSARY: Record<string, GlossaryEntry> = {
  cut: {
    token: "cut",
    title: "Cut",
    blurb:
      "A hard cut — the default. One shot just ends and the next begins, no effect. The tool leaves the chip off when a shot is a plain cut.",
    example: "Most shot-to-shot changes in a normal edit.",
  },
  cross_warp: {
    token: "cross_warp",
    title: "Cross warp",
    blurb:
      "The frame bends and melts from one shot into the next — a smooth, dreamy morph rather than a clean break.",
    example: "Easing between two beauty shots without a jarring jump.",
  },
  whip_pan: {
    token: "whip_pan",
    title: "Whip pan",
    blurb:
      "A fast camera whip that blurs into the next shot. Energetic, and it hides the cut inside the motion.",
    example: "Snapping between two locations or moments with momentum.",
  },
  light_leak: {
    token: "light_leak",
    title: "Light leak",
    blurb:
      "A wash of light bleeds across the frame between shots — warm, cinematic, a little nostalgic.",
    example: "A soft, filmic hand-off between scenes.",
  },
  glitch: {
    token: "glitch",
    title: "Glitch",
    blurb:
      "A quick digital stutter or distortion between shots. Edgy and modern — good for a tonal flip.",
    example: "A punchy beat drop or a hard change in energy.",
  },
  dissolve: {
    token: "dissolve",
    title: "Dissolve",
    blurb:
      "One shot fades through into the next. Gentle — usually signals time passing or a softer mood.",
    example: "Moving from 'before' to 'after', or settling into calm.",
  },
};

export function transitionEntry(token: string): GlossaryEntry | undefined {
  return TRANSITION_GLOSSARY[token];
}

// ─── Framing (free text → best-effort keyword match) ────────────────────────
interface FramingMatcher extends GlossaryEntry {
  /** Lowercase keywords; a framing chip matches if any appears in its text. */
  keywords: string[];
}

const FRAMING_MATCHERS: FramingMatcher[] = [
  {
    token: "macro",
    title: "Macro",
    blurb: "Extreme close detail — texture you could almost touch, like a single lash or a droplet.",
    keywords: ["macro"],
  },
  {
    token: "extreme close-up",
    title: "Extreme close-up",
    blurb: "Tighter than a close-up — fills the frame with one small part of the subject (eyes, lips, hands).",
    keywords: ["extreme close", "ecu"],
  },
  {
    token: "medium close-up",
    title: "Medium close-up",
    blurb: "Chest-and-up. Closer than a medium but with a little breathing room around the face.",
    keywords: ["medium close", "mcu"],
  },
  {
    token: "close-up",
    title: "Close-up",
    blurb: "Fills the frame with a face or single subject — intimate, where the emotion reads.",
    keywords: ["close-up", "close up", "closeup"],
  },
  {
    token: "medium",
    title: "Medium shot",
    blurb: "Roughly waist-up — the natural, conversational default for most shots.",
    keywords: ["medium", "mid shot", "mid-shot"],
  },
  {
    token: "wide",
    title: "Wide shot",
    blurb: "Shows the whole subject in their space — sets context and lets a movement breathe.",
    keywords: ["wide", "full shot", "long shot"],
  },
  {
    token: "establishing",
    title: "Establishing shot",
    blurb: "A wide opener that tells the viewer where we are before you move in closer.",
    keywords: ["establishing", "extreme wide", "ews"],
  },
  {
    token: "over the shoulder",
    title: "Over the shoulder (OTS)",
    blurb: "Shot from behind one person toward another — puts you inside the exchange between them.",
    keywords: ["over the shoulder", "over-the-shoulder", "ots"],
  },
  {
    token: "low angle",
    title: "Low angle",
    blurb: "Camera looks up at the subject — makes them feel taller, stronger, more heroic.",
    keywords: ["low angle", "low-angle"],
  },
  {
    token: "high angle",
    title: "High angle",
    blurb: "Camera looks down at the subject — makes them feel smaller or more vulnerable.",
    keywords: ["high angle", "high-angle"],
  },
  {
    token: "overhead",
    title: "Overhead / top-down",
    blurb: "Looking straight down from above — graphic and design-y, great for flat-lays and reveals.",
    keywords: ["overhead", "top-down", "top down", "bird's eye", "birds eye", "flat lay", "flat-lay"],
  },
  {
    token: "dutch angle",
    title: "Dutch angle",
    blurb: "A deliberately tilted horizon — creates unease or tension.",
    keywords: ["dutch", "canted"],
  },
  {
    token: "insert",
    title: "Insert",
    blurb: "A quick detail shot cut into the sequence — a hand, a product, a label — to add information.",
    keywords: ["insert", "cutaway", "detail shot"],
  },
  {
    token: "two shot",
    title: "Two shot",
    blurb: "Two people framed together — shows the relationship or the dialogue between them.",
    keywords: ["two shot", "two-shot", "2 shot"],
  },
  {
    token: "point of view",
    title: "Point of view (POV)",
    blurb: "What the subject is seeing — drops the viewer directly into their perspective.",
    keywords: ["point of view", "pov", "first person", "first-person"],
  },
];

/** Display order + entries for the glossary's framing section. */
export const FRAMING_ORDER: string[] = FRAMING_MATCHERS.map((f) => f.token);
export const FRAMING_GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(
  FRAMING_MATCHERS.map((f) => [f.token, { token: f.token, title: f.title, blurb: f.blurb, example: f.example }]),
);

// Flat keyword index, longest keyword first — so "low angle medium" matches
// "low angle" (more specific) before "medium", and "medium close-up" beats both.
const FRAMING_KEYWORD_INDEX: Array<{ kw: string; entry: FramingMatcher }> = FRAMING_MATCHERS.flatMap(
  (entry) => entry.keywords.map((kw) => ({ kw, entry })),
).sort((a, b) => b.kw.length - a.kw.length);

/** Best-effort match of a free-text framing tag to a known framing term. */
export function matchFraming(framing: string): GlossaryEntry | undefined {
  const t = (framing || "").toLowerCase();
  if (!t) return undefined;
  for (const { kw, entry } of FRAMING_KEYWORD_INDEX) {
    if (t.includes(kw)) {
      return { token: entry.token, title: entry.title, blurb: entry.blurb, example: entry.example };
    }
  }
  return undefined;
}
