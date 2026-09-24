// Deterministic demonstration generators (no AI model) for outcome alignment, plus validators
// that sanitize live AI output against the codes / ids that actually exist in the syllabus.
import type { LibraryPO, PEO } from "../../types";

export interface PeoSuggestion {
  peos: string[];
  explanation: string;
}

export interface CloPoSuggestion {
  poId: string;
  explanation: string;
}

export interface CloPoResult {
  suggestions: CloPoSuggestion[];
}

const STOPWORDS = new Set(
  (
    "a an and are as at be by for from in into is it its of on or that the their them this to with within using use used " +
    "able should will can could would may might must shall graduate graduates student students course learner learners " +
    "demonstrate demonstrating ability appropriate various including include such other than through across based upon " +
    "etc also both each which who whom whose what when where how all any more most own same so very well being been has have had"
  ).split(/\s+/)
);

/** Lowercase, split on non-letters, drop stopwords/short tokens, crude stemming. */
export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

function stem(w: string): string {
  for (const suf of ["ational", "ation", "ities", "ity", "ments", "ment", "ing", "ies", "ive", "ed", "es", "al", "s"]) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

/** Number of distinct shared tokens between two texts. */
export function overlapScore(a: string, b: string): { score: number; shared: string[] } {
  const ta = new Set(tokenize(a));
  const shared = Array.from(new Set(tokenize(b))).filter((t) => ta.has(t));
  return { score: shared.length, shared };
}

/* ------------------------------------------------------------------ */
/* PO → PEO                                                            */
/* ------------------------------------------------------------------ */

export function demoSuggestPeos(input: { po: string; peos: PEO[]; library?: LibraryPO }): PeoSuggestion {
  const valid = new Set(input.peos.map((p) => p.code));
  const lib = input.library;
  if (lib?.referencePeos?.length) {
    const peos = lib.referencePeos.filter((c) => valid.has(c));
    if (peos.length) {
      const note = lib.referenceNote ? ` Note: ${lib.referenceNote}` : "";
      return { peos, explanation: `Mapping printed in the reference syllabus template (reference hint).${note}` };
    }
  }
  const scored = input.peos
    .map((p) => ({ code: p.code, ...overlapScore(input.po, p.description) }))
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code, undefined, { numeric: true }));
  const top = scored.filter((s) => s.score > 0).slice(0, 2);
  if (top.length === 2 && top[1].score < top[0].score / 2) top.pop();
  if (!top.length) {
    const first = input.peos[0]?.code;
    return {
      peos: first ? [first] : [],
      explanation: "No shared keywords were found; defaulted to the first PEO. Review and choose the mapping manually.",
    };
  }
  return {
    peos: top.map((t) => t.code),
    explanation: `Keyword overlap with the PEO wording: ${top.map((t) => `${t.code} (${t.shared.slice(0, 4).join(", ")})`).join("; ")}.`,
  };
}

export function validatePeoSuggestion(v: unknown, validCodes: string[]): PeoSuggestion {
  const o = (v ?? {}) as { peos?: unknown; explanation?: unknown };
  if (!Array.isArray(o.peos)) throw new Error("Missing peos array");
  const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  const byNorm = new Map(validCodes.map((c) => [norm(c), c]));
  const peos = Array.from(
    new Set(
      o.peos
        .filter((x): x is string => typeof x === "string")
        .map((x) => byNorm.get(norm(x)))
        .filter((x): x is string => !!x)
    )
  );
  const dropped = o.peos.length - peos.length;
  let explanation = typeof o.explanation === "string" ? o.explanation : "";
  if (dropped > 0) explanation = `${explanation} (${dropped} unknown PEO code(s) were ignored.)`.trim();
  return { peos, explanation };
}

/* ------------------------------------------------------------------ */
/* CLO → PO                                                            */
/* ------------------------------------------------------------------ */

export function demoSuggestCloPos(input: { clo: { statement: string }; pos: { id: string; label: string; description: string }[] }): CloPoResult {
  const scored = input.pos
    .map((p) => ({ p, ...overlapScore(input.clo.statement, p.description) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;
  const top = scored.filter((s) => s.score >= Math.max(1, best / 2)).slice(0, 3);
  return {
    suggestions: top.map((s) => ({
      poId: s.p.id,
      explanation: `Shares key terms with ${s.p.label}: ${s.shared.slice(0, 4).join(", ")}.`,
    })),
  };
}

export function validateCloPoResult(v: unknown, allowedIds: string[]): CloPoResult {
  const o = (v ?? {}) as { suggestions?: unknown };
  if (!Array.isArray(o.suggestions)) throw new Error("Missing suggestions array");
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const suggestions: CloPoSuggestion[] = [];
  for (const raw of o.suggestions) {
    const s = (raw ?? {}) as { poId?: unknown; explanation?: unknown };
    if (typeof s.poId !== "string" || !allowed.has(s.poId) || seen.has(s.poId)) continue;
    seen.add(s.poId);
    suggestions.push({ poId: s.poId, explanation: typeof s.explanation === "string" ? s.explanation : "" });
  }
  return { suggestions };
}
