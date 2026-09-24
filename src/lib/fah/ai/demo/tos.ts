// TOS item mapping: request/response contract, deterministic demonstration generator and a
// validator that sanitizes live AI output against the objective ids / level names that exist.
import type { Exam, Tos } from "../../types";
import { examItems } from "../../calc";
import { overlapScore } from "./syllabus-outcomes";

export interface MapTosItemInput {
  questionId: string;
  sectionId: string;
  label: string;
  type: string;
  points: number;
  prompt: string;
  topic?: string;
  cloId?: string;
  cognitiveLevel?: string;
}

export interface MapTosInput {
  items: MapTosItemInput[];
  objectives: { id: string; label: string; cloId?: string; topic?: string }[];
  levels: string[];
}

export interface MapTosRow {
  questionId: string;
  objectiveId: string | null;
  level: string | null;
  rationale: string;
}

export interface MapTosResult {
  mappings: MapTosRow[];
  warnings: string[];
}

/** Builds the AI request from the draft TOS + exam (optionally restricted to some questions). */
export function buildMapTosInput(tos: Tos, exam: Exam, onlyQuestionIds?: string[]): MapTosInput {
  const only = onlyQuestionIds ? new Set(onlyQuestionIds) : null;
  const items = examItems(exam)
    .filter((i) => !only || only.has(i.questionId))
    .map((i) => {
      const q = i.question;
      const sub = q.subItems?.length ? ` Sub-items: ${q.subItems.map((s) => s.prompt).join(" | ")}` : "";
      return {
        questionId: i.questionId,
        sectionId: i.sectionId,
        label: i.label,
        type: i.typeLabel,
        points: i.points,
        prompt: `${q.prompt}${sub}`.slice(0, 600),
        topic: q.topic || undefined,
        cloId: q.cloId || undefined,
        cognitiveLevel: q.cognitiveLevel || undefined,
      };
    });
  return {
    items,
    objectives: tos.objectives.map((o) => ({ id: o.id, label: o.label, cloId: o.cloId, topic: o.topic })),
    levels: [...tos.levels],
  };
}

/* ------------------------------------------------------------------ */
/* Demonstration rules                                                 */
/* ------------------------------------------------------------------ */

const CANONICAL = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];

const VERB_RULES: { level: string; verbs: string[] }[] = [
  { level: "Creating", verbs: ["write a program", "write a function", "design", "create", "develop", "construct", "compose", "formulate", "build"] },
  { level: "Evaluating", verbs: ["evaluate", "justify", "critique", "assess", "defend", "judge", "recommend"] },
  { level: "Analyzing", verbs: ["analyze", "analyse", "compare", "contrast", "differentiate", "distinguish", "trace", "examine", "categorize"] },
  { level: "Applying", verbs: ["apply", "solve", "compute", "calculate", "use", "implement", "demonstrate", "convert", "execute"] },
  { level: "Understanding", verbs: ["explain", "describe", "summarize", "summarise", "interpret", "discuss", "classify", "give an example"] },
  { level: "Remembering", verbs: ["define", "list", "identify", "name", "state", "recall", "enumerate", "what is", "which of the following"] },
];

const TYPE_DEFAULT: Record<string, string> = {
  "Multiple Choice": "Remembering",
  Identification: "Remembering",
  "Discussion / Essay": "Understanding",
  Analysis: "Analyzing",
  "Drawing / Design": "Creating",
  "Programming Problem": "Applying",
};

/** Resolve a canonical Bloom level to one of the TOS levels (name match, else same position). */
function resolveLevel(canonical: string, levels: string[]): string | null {
  const byName = levels.find((l) => l.toLowerCase() === canonical.toLowerCase());
  if (byName) return byName;
  const idx = CANONICAL.indexOf(canonical);
  return idx >= 0 && idx < levels.length ? levels[idx] : null;
}

function matchLevelName(v: string | undefined, levels: string[]): string | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  return levels.find((l) => l.toLowerCase() === t) ?? levels.find((l) => l.toLowerCase().startsWith(t.slice(0, 5))) ?? null;
}

function verbLevel(prompt: string): { level: string; verb: string } | null {
  const text = ` ${prompt.toLowerCase().replace(/\s+/g, " ")} `;
  let best: { level: string; verb: string; pos: number } | null = null;
  for (const r of VERB_RULES) {
    for (const v of r.verbs) {
      const re = new RegExp(`\\b${v.replace(/ /g, "\\s+")}(?:s|es|d|ed|ing)?\\b`, "i");
      const m = re.exec(text);
      if (m && (!best || m.index < best.pos)) best = { level: r.level, verb: v, pos: m.index };
    }
  }
  return best ? { level: best.level, verb: best.verb } : null;
}

export function demoMapTos(input: MapTosInput): MapTosResult {
  const warnings: string[] = [];
  const mappings = input.items.map((it) => {
    const why: string[] = [];
    // Objective
    let objectiveId: string | null = null;
    const byClo = it.cloId ? input.objectives.find((o) => o.cloId && o.cloId === it.cloId) : undefined;
    if (byClo) {
      objectiveId = byClo.id;
      why.push("objective: the question is tagged with the CLO linked to this objective");
    } else if (input.objectives.length) {
      const scored = input.objectives
        .map((o) => ({ o, ...overlapScore(`${it.topic ?? ""} ${it.prompt}`, `${o.label} ${o.topic ?? ""}`) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0].score > 0) {
        objectiveId = scored[0].o.id;
        why.push(`objective: keyword overlap (${scored[0].shared.slice(0, 3).join(", ")})`);
      } else if (input.objectives.length === 1) {
        objectiveId = input.objectives[0].id;
        why.push("objective: only one objective exists");
      } else {
        objectiveId = input.objectives[0].id;
        why.push("objective: no shared keywords — defaulted to the first objective, review");
      }
    }
    // Level
    let level = matchLevelName(it.cognitiveLevel, input.levels);
    if (level) why.push(`level: taken from the question's cognitive-level tag`);
    else {
      const v = verbLevel(it.prompt);
      if (v) {
        level = resolveLevel(v.level, input.levels);
        if (level) why.push(`level: action verb “${v.verb}” → ${v.level}`);
      }
      if (!level) {
        const d = TYPE_DEFAULT[it.type] ?? "Understanding";
        level = resolveLevel(d, input.levels);
        if (level) why.push(`level: no action verb found — default for ${it.type} items`);
      }
    }
    return { questionId: it.questionId, objectiveId, level, rationale: `Demo rule — ${why.join("; ")}.` };
  });
  if (!input.objectives.length) warnings.push("The TOS has no objectives yet; items could not be assigned to an objective.");
  const defaulted = mappings.filter((m) => m.rationale.includes("defaulted")).length;
  if (defaulted) warnings.push(`${defaulted} item(s) shared no keywords with any objective and were defaulted to the first objective.`);
  return { mappings, warnings };
}

/* ------------------------------------------------------------------ */
/* Validation of live AI output                                        */
/* ------------------------------------------------------------------ */

export function validateMapTos(v: unknown, input: MapTosInput): MapTosResult {
  const o = (v ?? {}) as { mappings?: unknown; warnings?: unknown; coverageWarnings?: unknown };
  if (!Array.isArray(o.mappings)) throw new Error("Missing mappings array");
  const itemIds = new Set(input.items.map((i) => i.questionId));
  const objIds = new Set(input.objectives.map((x) => x.id));
  const warnings: string[] = [];
  const seen = new Set<string>();
  let badObj = 0;
  let badLevel = 0;
  let unknown = 0;
  const mappings: MapTosRow[] = [];
  for (const raw of o.mappings as unknown[]) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const qid = typeof r.questionId === "string" ? r.questionId : "";
    if (!itemIds.has(qid) || seen.has(qid)) {
      unknown++;
      continue;
    }
    seen.add(qid);
    let objectiveId = typeof r.objectiveId === "string" && objIds.has(r.objectiveId) ? r.objectiveId : null;
    if (!objectiveId && r.objectiveId) badObj++;
    const level = typeof r.level === "string" ? matchLevelName(r.level, input.levels) : null;
    if (!level && r.level) badLevel++;
    if (!objectiveId && input.objectives.length === 1) objectiveId = input.objectives[0].id;
    mappings.push({ questionId: qid, objectiveId, level, rationale: typeof r.rationale === "string" ? r.rationale.slice(0, 400) : "" });
  }
  const missing = input.items.filter((i) => !seen.has(i.questionId));
  missing.forEach((i) => mappings.push({ questionId: i.questionId, objectiveId: null, level: null, rationale: "No proposal returned for this item." }));
  if (unknown) warnings.push(`${unknown} proposal(s) referred to unknown or repeated items and were ignored.`);
  if (badObj) warnings.push(`${badObj} proposal(s) used an objective that does not exist; the objective was left empty.`);
  if (badLevel) warnings.push(`${badLevel} proposal(s) used a cognitive level not in this TOS; the level was left empty.`);
  if (missing.length) warnings.push(`The AI returned nothing for ${missing.length} item(s): ${missing.map((i) => i.label).join(", ")}.`);
  for (const w of [o.warnings, o.coverageWarnings]) if (Array.isArray(w)) w.filter((x) => typeof x === "string").forEach((x) => warnings.push(x as string));
  const order = new Map(input.items.map((i, idx) => [i.questionId, idx]));
  mappings.sort((a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0));
  return { mappings, warnings };
}
