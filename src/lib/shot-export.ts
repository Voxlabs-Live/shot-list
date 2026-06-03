/**
 * Export formatters for a generated shot list.
 *
 * Four deliverables off one result object:
 *   - toPlainText  — the brief/Slack/Notion paste (no formatting).
 *   - toMarkdown   — headings + bold fields; pastes into Word/Docs/Notion with
 *                    formatting intact, or converts via pandoc.
 *   - toPrintHtml  — a self-contained, print-styled HTML document opened in a
 *                    new window so the browser's "Save as PDF" yields a clean,
 *                    formatted PDF (no app chrome, no extra deps).
 *
 * All four are pure functions of the result + a display name. Every dynamic
 * string is escaped in the HTML path — the action/audio/notes come from the
 * model (and ultimately the user's concept), so they must never be trusted as
 * markup.
 */

export interface ExportShot {
  shot_number: number;
  action: string;
  framing: string;
  duration_sec: number;
  audio: string;
  transition_in?: string;
  notes?: string;
}

export interface ExportResult {
  format: string;
  total_duration_sec: number;
  shot_count: number;
  shots: ExportShot[];
  duration_drift?: boolean;
  target_duration_sec?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const sec = (n: number) => `${n.toFixed(1)}s`;
const transition = (s: ExportShot) =>
  s.transition_in && s.transition_in !== "cut" ? s.transition_in : "";

/** Plain text — the original brief/Slack format. */
export function toPlainText(d: ExportResult, name?: string): string {
  const lines: string[] = [];
  lines.push(`SHOT LIST${name ? ` — ${name}` : ""}`);
  lines.push(d.format);
  lines.push(`Total: ${sec(d.total_duration_sec)} · ${d.shot_count} shots`);
  if (d.duration_drift && d.target_duration_sec) {
    lines.push(`(drift warning: target was ~${d.target_duration_sec}s)`);
  }
  lines.push("");
  d.shots.forEach((s) => {
    const t = transition(s);
    lines.push(`${pad(s.shot_number)}. [${sec(s.duration_sec)} · ${s.framing}${t ? ` · ${t}` : ""}]`);
    lines.push(`    Action: ${s.action}`);
    lines.push(`    Audio: ${s.audio}`);
    if (s.notes) lines.push(`    Note: ${s.notes}`);
    lines.push("");
  });
  return lines.join("\n");
}

/** Markdown — headings + bold field labels; survives a paste into Word/Docs. */
export function toMarkdown(d: ExportResult, name?: string): string {
  const lines: string[] = [];
  lines.push(`# Shot List${name ? ` — ${name}` : ""}`);
  lines.push("");
  const meta = [`**Format:** ${d.format}`, `**Total:** ${sec(d.total_duration_sec)}`, `**Shots:** ${d.shot_count}`];
  lines.push(meta.join(" · "));
  if (d.duration_drift && d.target_duration_sec) {
    lines.push("");
    lines.push(`> ⚠️ Durations don't add up to the ~${d.target_duration_sec}s target — review before shoot day.`);
  }
  lines.push("");
  d.shots.forEach((s) => {
    const t = transition(s);
    lines.push(`## Shot ${pad(s.shot_number)} — ${sec(s.duration_sec)} · ${s.framing}${t ? ` · → ${t}` : ""}`);
    lines.push("");
    lines.push(`**Action:** ${s.action}`);
    lines.push("");
    lines.push(`**Audio:** ${s.audio}`);
    if (t) {
      lines.push("");
      lines.push(`**Transition in:** ${t}`);
    }
    if (s.notes) {
      lines.push("");
      lines.push(`**Note:** ${s.notes}`);
    }
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** Escape a string for safe insertion into the print document's HTML. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A complete, self-contained HTML document for printing to PDF. Inline styles
 * only (no external assets) so it renders identically in the print window.
 */
export function toPrintHtml(d: ExportResult, name?: string): string {
  const title = `Shot List${name ? ` — ${name}` : ""}`;
  const driftBanner =
    d.duration_drift && d.target_duration_sec
      ? `<p class="drift">Durations don&rsquo;t add up to the ~${escapeHtml(String(d.target_duration_sec))}s target — review before shoot day.</p>`
      : "";

  const shotRows = d.shots
    .map((s) => {
      const t = transition(s);
      const chips = [
        `<span class="chip chip--dur">${escapeHtml(sec(s.duration_sec))}</span>`,
        `<span class="chip">${escapeHtml(s.framing)}</span>`,
        t ? `<span class="chip chip--trans">&rarr; ${escapeHtml(t)}</span>` : "",
      ].join("");
      const note = s.notes
        ? `<p class="note"><span class="lbl">Note</span>${escapeHtml(s.notes)}</p>`
        : "";
      return `
        <li class="shot">
          <div class="num">${escapeHtml(pad(s.shot_number))}</div>
          <div class="body">
            <div class="meta">${chips}</div>
            <p class="action">${escapeHtml(s.action)}</p>
            <p class="audio"><span class="lbl">Audio</span>${escapeHtml(s.audio)}</p>
            ${note}
          </div>
        </li>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1c1917; margin: 0; padding: 2.5rem; line-height: 1.5;
  }
  h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
  .summary { color: #57534e; font-size: 0.9rem; margin: 0 0 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid #e7e5e4; }
  .summary b { color: #1c1917; }
  .drift { background: #fef3c7; border-left: 3px solid #d97706; padding: 0.6rem 0.85rem; border-radius: 4px; font-size: 0.85rem; margin: 0 0 1.25rem; }
  ul.shots { list-style: none; padding: 0; margin: 0; }
  li.shot { display: grid; grid-template-columns: 2.5rem 1fr; gap: 1rem; padding: 0.9rem 0; border-bottom: 1px solid #f5f5f4; break-inside: avoid; page-break-inside: avoid; }
  .num { font-size: 1.4rem; color: #d6d3d1; text-align: right; font-variant-numeric: tabular-nums; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.4rem; }
  .chip { font-size: 0.72rem; font-family: ui-monospace, "SF Mono", Menlo, monospace; padding: 0.1rem 0.45rem; border-radius: 4px; background: #f5f5f4; color: #44403c; border: 1px solid #e7e5e4; }
  .chip--dur { background: #fdebe3; color: #9a3412; border-color: #f4c4ab; font-weight: 600; }
  .chip--trans { background: #fef3c7; color: #1c1917; border-color: #fcd34d; font-style: italic; }
  .action { margin: 0 0 0.35rem; }
  .audio, .note { font-size: 0.85rem; color: #57534e; margin: 0 0 0.2rem; }
  .lbl { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: #a8a29e; margin-right: 0.45rem; }
  .note { font-style: italic; color: #78716c; }
  @media print { body { padding: 0; } @page { margin: 1.5cm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="summary"><b>Format:</b> ${escapeHtml(d.format)} &nbsp;·&nbsp; <b>Total:</b> ${escapeHtml(sec(d.total_duration_sec))} &nbsp;·&nbsp; <b>Shots:</b> ${escapeHtml(String(d.shot_count))}</p>
  ${driftBanner}
  <ul class="shots">${shotRows}</ul>
</body>
</html>`;
}
