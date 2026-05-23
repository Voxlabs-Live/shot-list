# Shot List Generator

Paste a script or concept. Pick a format. Get back a structured shot list:

- **Numbered shots** with action description, framing, duration in seconds, and audio cue
- **Optional shader transitions** (cross_warp, whip_pan, light_leak, glitch, dissolve) for shots where the transition itself does creative work
- **Total duration** that lands within ±10% of the format target — drift warning if not
- **Render-engine-agnostic JSON** — fits Hyperframes natively and maps to Remotion via fps multiplication

Part of the [Agency Vibe-Coding Kit](https://voxlabs.live) — a $7 starter pack of four small tools your creative agency can run from a browser.

**Live demo:** [shot-list.voxlabs.live](https://shot-list.voxlabs.live) (5 free runs per visitor)

**The output is a handoff document.** Hand it to your editor for a manual cut, or pipe the JSON into a [Hyperframes](https://hyperframes.com) composition for auto-assembly.

---

## Deploy your own copy (3 minutes, browser-only)

You don't need a terminal. You need a GitHub account, a Vercel account, and an Anthropic API key.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVoxlabs-Live%2Fshot-list&env=ANTHROPIC_API_KEY&envDescription=Get%20your%20Anthropic%20API%20key%20from%20platform.claude.com&envLink=https%3A%2F%2Fplatform.claude.com)

1. Click **Deploy with Vercel**.
2. Sign in to GitHub. Vercel will fork this repo into your GitHub account.
3. Sign up for Vercel free tier (~3 min, no credit card needed).
4. Paste your **Anthropic API key** when prompted. Get one at [platform.claude.com](https://platform.claude.com) — sign up, click "Get API Key" on the dashboard, copy the key somewhere safe (you only see it once).
5. Click **Deploy**. Wait ~90 seconds. You get your own URL.

That's it. The tool is yours — no limits, you pay only what you use on Anthropic.

### Watch the deploy walkthrough

A 10-minute screen recording covers the whole flow. [Watch it here](#loom-coming-soon) *(link added when the kit's Looms are released).*

---

## What you'll spend on your own deploy

- ~**$0.010 – $0.020 per shot list** depending on script length and format
- ~**$5 – $20/month** for typical agency use (a few generations per week across clients)
- No subscription. You pay Anthropic directly.

---

## Output schema

The JSON output is intentionally render-engine-agnostic. Use it as-is for editor handoff, or feed it directly into your auto-assembly pipeline.

```json
{
  "format": "9:16 reel (15-30s)",
  "total_duration_sec": 22.0,
  "shot_count": 6,
  "shots": [
    {
      "shot_number": 1,
      "action": "Macro shot on closed eyelid. The artist's tweezers come into frame, place a single lash with precision.",
      "framing": "macro",
      "duration_sec": 4.5,
      "audio": "soft ambient room tone, faint click of tweezers"
    },
    {
      "shot_number": 2,
      "action": "Cut to artist's hands in the foreground...",
      "framing": "low angle medium",
      "duration_sec": 3.0,
      "audio": "ambient",
      "transition_in": "whip_pan"
    }
  ]
}
```

`transition_in` is omitted when the transition is a normal hard cut (the default). It's included only when the transition itself does creative work — the values match [Hyperframes' built-in shader transitions](https://hyperframes.com/docs).

---

## Customize the tool

### Tune the format targets

Open `src/prompts/system.ts`. The four format options and their target duration windows are defined in the system prompt — add your own (`16:9 commercial (15s)`, `1:1 square (30s)`, etc.) and update `FORMAT_TARGET_SEC` in `src/pages/api/generate.ts` to match.

### Add per-client concept presets

The fixtures in `src/fixtures/studio-north.ts` are demo content. Replace them with your real clients' brand templates so common concepts populate the form with one click.

### Upgrade to polished UI

The kit's **Bump #1 — Claude Design Polish Guide** ($17) walks you through styling this repo with [Claude Design](https://claude.com/design). *(Available after kit purchase.)*

---

## Local dev

```sh
git clone https://github.com/Voxlabs-Live/shot-list
cd shot-list
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Then open `http://localhost:4321`.

---

## Tech

- **Astro 5** + TypeScript strict mode
- **`@anthropic-ai/sdk`** with prompt caching on the system prompt
- **Claude Sonnet 4.6** as default model
- **Vercel** for hosting + serverless API route
- **Upstash Redis** (via Vercel Marketplace) for the hosted demo's lifetime cap — disabled on your own deploy

---

## Part of the kit

| Tool | Repo |
|---|---|
| Brief Translator | [Voxlabs-Live/brief-translator](https://github.com/Voxlabs-Live/brief-translator) |
| Brand Voice Checker | [Voxlabs-Live/brand-voice-checker](https://github.com/Voxlabs-Live/brand-voice-checker) |
| Weekly Hook Sheet Generator | [Voxlabs-Live/hook-sheet](https://github.com/Voxlabs-Live/hook-sheet) |
| **Shot List Generator** | this repo |

---

## License

MIT for the code. The system prompts (`src/prompts/system.ts`) are part of the kit product — you can modify them for your own use, but please don't redistribute the prompts unchanged as a competing product.
