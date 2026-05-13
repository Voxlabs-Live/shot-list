/**
 * Studio North shot-list fixtures.
 *
 * Each fixture is a plausible production brief — varying script vs. concept
 * inputs, varying formats — so the buyer sees the tool handle the breadth of
 * what creative-agency producers actually paste into shot-list tools.
 *
 * Aurelia → 30s reel (script-shaped, sound-design only)
 * Mantra  → 60s reel (concept-shaped, narrative arc)
 * Eckhardt → 30s commercial (full V/O script, professional patient testimonial)
 */

import type { Format } from "../lib/shot-types";

export interface ShotSample {
  id: "aurelia-lashes" | "mantra-yoga" | "eckhardt-clinic";
  client: string;
  format: Format;
  concept: string;
}

export const SHOT_SAMPLES: ShotSample[] = [
  {
    id: "aurelia-lashes",
    client: "Aurelia Lashes",
    format: "9:16 reel (15-30s)",
    concept: `Aurelia Lashes — before/after reveal of a returning client's first set after a six-week break. Open on her closed eyes mid-application, end on her seeing herself in the mirror. No V/O — pure sound design. Studio aesthetic: warm ring light, neutral linen background, no clutter. The pacing should feel calm-precise, not hyped. Last beat should hold ~0.5s on her reflection before fade.`,
  },
  {
    id: "mantra-yoga",
    client: "Mantra Yoga",
    format: "9:16 reel (60s)",
    concept: `Mantra Yoga — "first day at the studio" narrative reel.

Open: A new student, mid-30s, hesitates outside the studio door at 6:50am. She checks her phone, takes a breath, walks in.

Middle: Inside, soft morning light. She rolls out a borrowed mat. Subtle awkwardness — looking at others to copy poses. The teacher walks past, adjusts her hand position with a small smile, no words. She tries chaturanga. Falls out of it. Resets.

End: Savasana. Quiet shot of her face — eyes closed, slight smile. Last beat: she's the last one to roll up her mat after class. Walks out into bright morning street. No music ending — just street sound.

Tone: calm, observational, anti-hustle. No motivational text. The teacher should feel grounded, not performative. Use only one short voice line if any: a soft "you're doing great, take your time" from the teacher mid-class — optional.`,
  },
  {
    id: "eckhardt-clinic",
    client: "Dr. Eckhardt Clinic",
    format: "16:9 commercial (30s)",
    concept: `Dr. Eckhardt Clinic — 30-second commercial. Patient testimonial format, mid-career professional.

V/O (Patient, female, 47, German-accented English, calm and articulate — read each line in quotes verbatim):
"I tried over-the-counter for two years. Nothing changed."
"My GP referred me to Dr. Eckhardt. Six weeks of consistent treatment."
"This is the first time my scalp has felt like mine again."

Visual notes:
- Clinic interior: clean, modern, warm wood + matte white. NOT clinical-cold.
- Patient should look like a real person, not a stock-photo subject. Subtle gray at temples, no full glam.
- Include one shot of Dr. Eckhardt with the patient in consultation — quiet, focused, the doctor is listening not talking.
- Closing card: clinic name, "Patient outcomes vary" disclaimer in small type.
- Music: subdued instrumental, no swell.
- End beat: 1.5s on the closing card.`,
  },
];

export function findShotSample(id: string): ShotSample | undefined {
  return SHOT_SAMPLES.find((s) => s.id === id);
}
