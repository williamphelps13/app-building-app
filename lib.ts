import {
  ASPECTS, ASPECT_KEYS, CADENCE, CRITERIA, NEEDS, WEIGHTS,
} from "./schema";
import type {
  AspectKey, CriterionKey, Feature, SortKey, StackLayer, StackOption, Weights,
} from "./schema";

/* ============================================================
   The timeline axis

   Change these to point the tool at a different span: months
   of a rollout, quarters, versions. Everything else reads from
   here.
   ============================================================ */

export const TIMELINE = {
  max: 18,
  ticks: [0, 3, 6, 9, 12, 15, 18],
  unit: "y",
  subUnit: "m",
  zeroLabel: "birth",
} as const;

export const MAX = TIMELINE.max;
export const STEP = 0.5;

/* ============================================================
   Numbers and formatting
   ============================================================ */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const snap = (v: number) => Math.round(v / STEP) * STEP;
export const pct = (v: number) => (v / MAX) * 100;

export function fmtPoint(v: number): string {
  if (v === 0) return TIMELINE.zeroLabel;
  const whole = Math.floor(v);
  const part = Math.round((v - whole) * 12);
  if (whole === 0) return `${part}${TIMELINE.subUnit}`;
  if (part === 0) return `${whole}${TIMELINE.unit}`;
  return `${whole}${TIMELINE.unit}${part}${TIMELINE.subUnit}`;
}

export function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return "<1 MB";
}

/* ============================================================
   Editing a range, with the invariants in one place
   ============================================================ */

export type Edge = "start" | "handoff" | "end";

export function applyEdit(item: Feature, which: Edge, raw: number): Feature {
  const v = clamp(snap(raw), 0, MAX);
  const next = { ...item };
  if (which === "start") next.start = Math.min(v, item.end - STEP);
  if (which === "end") next.end = Math.max(v, item.start + STEP);
  if (which === "handoff") next.handoff = v;
  next.handoff = clamp(next.handoff, next.start, next.end);
  return next;
}

/* ============================================================
   Sorting and filtering
   ============================================================ */

const isAspect = (k: string): k is AspectKey => (ASPECT_KEYS as readonly string[]).includes(k);

function compareBy(key: SortKey | "none", a: Feature, b: Feature): number {
  if (key === "none") return 0;
  if (key === "name") return a.name.localeCompare(b.name);
  if (isAspect(key)) return b.ratings[key] - a.ratings[key];
  return a[key] - b[key];
}

export function sortAndFilter(
  items: Feature[],
  sortA: SortKey,
  sortB: SortKey | "none",
  filterKey: AspectKey | "none",
  filterMin: number,
): Feature[] {
  const kept = filterKey === "none"
    ? items
    : items.filter((it) => it.ratings[filterKey] >= filterMin);
  return [...kept].sort(
    (x, y) => compareBy(sortA, x, y) || compareBy(sortB, x, y) || x.start - y.start,
  );
}

/* ============================================================
   Derived load and size
   ============================================================ */

export interface LoadPoint { at: number; a: number; b: number; total: number }

export function loadAt(items: Feature[], at: number): LoadPoint {
  let a = 0, b = 0;
  for (const it of items) {
    if (at < it.start || at > it.end) continue;
    const rate = CADENCE[it.cadence].perWeek;
    if (at < it.handoff) a += rate; else b += rate;
  }
  return { at, a, b, total: a + b };
}

export function buildCurve(items: Feature[]): LoadPoint[] {
  const points: LoadPoint[] = [];
  for (let v = 0; v <= MAX + 0.001; v += STEP) {
    points.push(loadAt(items, Math.round(v * 2) / 2));
  }
  return points;
}

export function archiveMb(item: Feature): number {
  const span = Math.max(item.end - item.start, 0);
  return CADENCE[item.cadence].perWeek * 52 * span * WEIGHTS[item.weight].mb;
}

/* ============================================================
   Stack scoring
   ============================================================ */

export function scoreOption(option: StackOption, weights: Weights): number {
  let num = 0, den = 0;
  for (const c of CRITERIA) {
    const w = weights[c.key as CriterionKey];
    num += option.scores[c.key] * w;
    den += w;
  }
  if (den === 0) {
    const flat = CRITERIA.reduce((s, c) => s + option.scores[c.key], 0);
    return flat / CRITERIA.length;
  }
  return num / den;
}

export function rankLayer(layer: StackLayer, weights: Weights) {
  return [...layer.options]
    .map((opt) => ({ opt, score: scoreOption(opt, weights) }))
    .sort((x, y) => y.score - x.score);
}

/* ============================================================
   Export
   ============================================================ */

/* The conventions, in the form you paste into a new conversation. */
export function conventionsToMarkdown(doc: {
  title: string;
  intro: string;
  sections: { header: string; summary?: string; rules: { rule: string; why: string }[] }[];
}): string {
  const lines = [`# ${doc.title}`, "", doc.intro, ""];
  for (const s of doc.sections) {
    lines.push(`## ${s.header}`, "");
    if (s.summary) lines.push(`*${s.summary}*`, "");
    for (const r of s.rules) {
      lines.push(`**${r.rule}**`, "", r.why, "");
    }
  }
  return lines.join("\n");
}

export function stackToMarkdown(
  layers: { id: string; name: string; options: { id: string; name: string }[] }[],
  choices: Record<string, string | null>,
  ranked: Record<string, { opt: { id: string; name: string }; score: number }[]>,
): string {
  const lines = ["# Stack", ""];
  for (const layer of layers) {
    const picked = layer.options.find((o) => o.id === choices[layer.id]);
    const top = ranked[layer.id]?.[0];
    const chosen = picked ?? top?.opt;
    lines.push(`- ${layer.name}: ${chosen?.name ?? "undecided"}${picked ? "" : " (best score, not picked)"}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function namesToMarkdown(
  candidates: { domain: string; bucket: string; note: string; auto: boolean;
    price: string; purchase: number | null; renewal: number | null }[],
  names: string[],
  bucketLabel: Record<string, string>,
  buckets: readonly string[],
): string {
  const money = (n: number | null) =>
    n === null ? null : `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;

  const lines = ["# Domains", ""];
  for (const b of buckets) {
    const list = candidates.filter((c) => c.bucket === b);
    if (!list.length) continue;
    lines.push(`## ${bucketLabel[b]}`, "");
    for (const c of list) {
      const auto = money(c.purchase);
      const renew = c.renewal !== null && c.renewal !== c.purchase ? `${money(c.renewal)} to renew` : null;
      const price = c.price || (auto ? [auto, renew].filter(Boolean).join(", ") : "");
      lines.push(`- ${c.domain}${price ? ` — ${price}` : ""}`);
      if (c.note) lines.push(`  - ${c.note}${c.auto ? " (automatic)" : ""}`);
    }
    lines.push("");
  }
  const unchecked = names.filter((n) => !candidates.some((c) => c.domain.startsWith(`${n}.`)));
  if (unchecked.length) lines.push("## Not yet checked", "", ...unchecked.map((n) => `- ${n}`), "");
  return lines.join("\n");
}

export function toMarkdown(items: Feature[]): string {
  const lines = ["# Plan", ""];
  for (const it of items) {
    lines.push(`## ${it.name}`, "", it.blurb, "");
    lines.push(`- Range: ${fmtPoint(it.start)} to ${fmtPoint(it.end)}`);
    lines.push(`- Handover at: ${fmtPoint(it.handoff)}`);
    lines.push(`- Cadence: ${CADENCE[it.cadence].label} (${CADENCE[it.cadence].perWeek}/week)`);
    lines.push(`- Entry size: ${WEIGHTS[it.weight].label}, about ${fmtSize(archiveMb(it))} in total`);
    lines.push(`- Ratings: ${ASPECTS.map((a) => `${a.full} ${it.ratings[a.key]}/5`).join(", ")}`);
    lines.push(`- Needs: ${it.needs.length ? it.needs.map((n) => NEEDS[n]).join(", ") : "nothing"}`);
    lines.push(`- Fields: ${it.fields.map((f) => `${f.name} (${f.type})`).join(", ") || "none"}`);
    if (it.note) lines.push(`- Notes: ${it.note}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
