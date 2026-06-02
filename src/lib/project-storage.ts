/**
 * localStorage persistence for Shot List projects.
 *
 * Browser-only. The /api/generate endpoint receives the full concept+format in
 * the request body — the server never reads from localStorage. This keeps the
 * buyer's fork stateless (no DB, no operational dependency).
 *
 * A "project" is one deliverable: a concept, a chosen format, and the generated
 * shot list. Each successful generate saves/updates the current project so the
 * shot list survives a refresh. Built-in fixtures are seeded once as read-only
 * sample projects (id prefixed with `sample:`) so the picker is never empty.
 *
 * Hardening ported from Brand Voice Checker (voice-doc-storage.ts):
 *  - corruption-tolerant reads (try/catch → []), never a white screen;
 *  - coalesce missing/legacy fields on load so schema drift can't crash render;
 *  - append+dedupe on seed (one-time flag) so user data is never overwritten;
 *  - samples are read-only — guarded at every mutation site.
 */
import type { Format } from "./shot-types";

/** The persisted result shape — the canonical schema plus the two UI flags. */
export interface StoredResult {
  format: string;
  total_duration_sec: number;
  shot_count: number;
  shots: unknown[];
  duration_drift?: boolean;
  target_duration_sec?: number;
}

export interface Project {
  id: string;
  name: string;
  concept: string;
  format: string;
  /** null until the project has been generated at least once. */
  result: StoredResult | null;
  updated_at: string;
}

const STORAGE_KEY = "shotlist:projects:v1";
const SEEDED_FLAG_KEY = "shotlist:projects:seeded:v1";
const LAST_VIEWED_KEY = "shotlist:last-viewed:v1";

export const SAMPLE_ID_PREFIX = "sample:";

export function isSampleId(id: string | undefined | null): boolean {
  return typeof id === "string" && id.startsWith(SAMPLE_ID_PREFIX);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Coalesce a raw stored object into a valid Project. Tolerates partial/legacy/
 * tampered items — a project missing a newer field (or with a malformed result)
 * loads with sane defaults instead of crashing the render path.
 */
function coalesceProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "Untitled project",
    concept: typeof r.concept === "string" ? r.concept : "",
    format: typeof r.format === "string" ? r.format : "",
    result: coalesceResult(r.result),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date(0).toISOString(),
  };
}

function coalesceResult(raw: unknown): StoredResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const shots = Array.isArray(r.shots) ? r.shots : [];
  return {
    format: typeof r.format === "string" ? r.format : "",
    total_duration_sec: typeof r.total_duration_sec === "number" ? r.total_duration_sec : 0,
    shot_count: typeof r.shot_count === "number" ? r.shot_count : shots.length,
    shots,
    duration_drift: r.duration_drift === true,
    target_duration_sec:
      typeof r.target_duration_sec === "number" ? r.target_duration_sec : undefined,
  };
}

function readAll(): Project[] {
  if (!isBrowser()) return [];
  const rawStr = window.localStorage.getItem(STORAGE_KEY);
  if (!rawStr) return [];
  try {
    const parsed = JSON.parse(rawStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coalesceProject).filter((p): p is Project => p !== null);
  } catch {
    return [];
  }
}

function writeAll(projects: Project[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/** List all projects, most-recent-first (newest updated_at at the top). */
export function listProjects(): Project[] {
  return readAll().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getProject(id: string): Project | undefined {
  return readAll().find((p) => p.id === id);
}

/** Save (insert or update). Stamps updated_at. Refuses to overwrite samples. */
export function saveProject(project: Project): Project {
  const stamped: Project = { ...project, updated_at: new Date().toISOString() };
  const all = readAll();
  const idx = all.findIndex((p) => p.id === stamped.id);
  if (idx >= 0) {
    if (isSampleId(stamped.id)) return all[idx]; // samples are read-only
    all[idx] = stamped;
  } else {
    all.push(stamped);
  }
  writeAll(all);
  return stamped;
}

export function deleteProject(id: string): void {
  if (isSampleId(id)) return; // samples re-seed; never deletable
  writeAll(readAll().filter((p) => p.id !== id));
  if (getLastViewedId() === id) clearLastViewed();
}

/** Rename a user project. No-op for samples. */
export function renameProject(id: string, name: string): Project | undefined {
  if (isSampleId(id)) return undefined;
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], name, updated_at: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

/** Duplicate any project (incl. a sample) into a fresh, editable user project. */
export function duplicateProject(id: string): Project | undefined {
  const source = getProject(id);
  if (!source) return undefined;
  const copy: Project = {
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    concept: source.concept,
    format: source.format,
    result: source.result ? JSON.parse(JSON.stringify(source.result)) : null,
    updated_at: new Date().toISOString(),
  };
  return saveProject(copy);
}

/** Derive a friendly project name from the first non-empty line of the concept. */
export function autoName(concept: string): string {
  const firstLine = (concept || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "Untitled project";
  const clean = firstLine.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

/**
 * Seed built-in sample projects on first visit. Idempotent — a one-time flag
 * means re-seeding never overwrites or resurrects user-deleted data.
 */
export function seedSamplesIfNeeded(samples: Project[]): void {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(SEEDED_FLAG_KEY) === "1") return;
  const existing = readAll();
  const existingIds = new Set(existing.map((p) => p.id));
  const toAdd = samples.filter((s) => !existingIds.has(s.id));
  if (toAdd.length > 0) writeAll([...existing, ...toAdd]);
  window.localStorage.setItem(SEEDED_FLAG_KEY, "1");
}

// ─── Last-viewed pointer (restore on load) ──────────────────────────────
export function setLastViewed(id: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(LAST_VIEWED_KEY, id);
}
export function getLastViewedId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(LAST_VIEWED_KEY);
}
export function clearLastViewed(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(LAST_VIEWED_KEY);
}

/** Build the seed sample projects from the fixture concept/format pairs. */
export function buildSampleProjects(
  samples: Array<{ id: string; client: string; format: Format; concept: string }>,
): Project[] {
  // Stable, ascending seed timestamps so samples keep a deterministic order at
  // the bottom of the most-recent-first list (epoch + index seconds).
  return samples.map((s, i) => ({
    id: `${SAMPLE_ID_PREFIX}${s.id}`,
    name: s.client,
    concept: s.concept,
    format: s.format,
    result: null,
    updated_at: new Date(1000 * (i + 1)).toISOString(),
  }));
}
