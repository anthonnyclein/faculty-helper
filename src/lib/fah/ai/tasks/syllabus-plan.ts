import { AI_GUARDRAILS, formatSources, type AiTaskRegistry } from "../types";

// Course Learning Plan AI tasks: full 18-week plan generation, regeneration of selected rows,
// and SILO support suggestions (CLOs, activities, assessment) for a single row.
// Client demo fallbacks + output validators live in src/lib/fah/ai/demo/syllabus-plan.ts.

interface CourseIn {
  code?: string;
  title?: string;
  description?: string;
  units?: number | null;
  lectureHours?: number | null;
  labHours?: number | null;
}

interface PlanIn {
  course?: CourseIn;
  clos?: { id: string; code: string; statement: string }[];
  examWeeks?: { week: number; label: string }[];
  sources?: { id: string; title: string; text: string }[];
  instructions?: string;
}

const ITEM_SHAPE = `{"weekStart": number, "weekEnd": number|null, "content": string, "silos": string[], "cloCodes": string[], "activities": string[], "assessment": string[], "materials": string, "sourceIds": string[]}`;

function courseBlock(input: PlanIn): string {
  const c = input.course ?? {};
  const hours = [c.lectureHours != null ? `${c.lectureHours} lecture hours` : "", c.labHours != null ? `${c.labHours} laboratory hours` : ""].filter(Boolean).join(", ");
  return [
    `COURSE: ${c.code ?? ""} — ${c.title ?? ""}`,
    c.units != null ? `Units: ${c.units}${hours ? ` (${hours})` : ""}` : hours ? `Hours: ${hours}` : "",
    `Course description: ${c.description ?? ""}`,
    "",
    "COURSE LEARNING OUTCOMES (use these codes exactly):",
    ...(input.clos ?? []).map((x) => `${x.code}: ${x.statement}`),
    "",
    `RESERVED EXAMINATION WEEKS (no lessons): ${(input.examWeeks ?? []).map((e) => `Week ${e.week} = ${e.label}`).join("; ") || "none"}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

const PLAN_RULES = `
Planning rules:
- The semester has exactly 18 weeks. Every non-examination week from 1 to 18 must be covered by at least one item (an item may span consecutive weeks with weekEnd, e.g. weeks 4-5, but never across an examination week).
- NEVER place lessons in the reserved examination weeks. Do not output items for them; they are added separately.
- Week 1 is normally course orientation (course syllabus, class policies, and the university's vision, mission, goals and core values) unless instructions say otherwise.
- Sequence content logically from foundations to advanced topics, following the order of the source materials when sources are given.
- "silos": 1-3 Specific Intended Learning Outcomes per item, each starting with a measurable action verb (Bloom's taxonomy).
- "cloCodes": only codes from the CLO list. Every CLO must be addressed by at least one item.
- "activities": concrete teaching and learning activities (lecture-discussion, laboratory exercise, group work...).
- "assessment": concrete assessment tasks aligned with the SILOs (quiz, laboratory exercise, rubric-based output...).
- "materials": short instructional material reference — only titles of the provided sources (never invent books, authors, URLs). Empty string if none.
- "sourceIds": ids of the provided sources that support the item; [] if none.`;

export const syllabusPlanTasks: AiTaskRegistry = {
  "generate-learning-plan": {
    system: `You are an experienced curriculum designer preparing the Course Learning Plan of an outcomes-based syllabus for a Philippine state university (BS Information Technology).
Return JSON: {"items": [${ITEM_SHAPE}], "coverageWarnings": string[]}.
${PLAN_RULES}${AI_GUARDRAILS}`,
    user: (input: PlanIn) =>
      `${courseBlock(input)}

ADDITIONAL INSTRUCTIONS FROM THE FACULTY: ${input.instructions?.trim() || "none"}

${formatSources(input.sources)}

Produce the complete 18-week Course Learning Plan (all non-examination weeks). Use coverageWarnings for any topic, CLO or week the sources do not support.`,
    maxTokens: 7000,
    temperature: 0.3,
    model: "gpt-4.1-2025-04-14",
  },

  "regenerate-plan-rows": {
    system: `You revise selected rows of an existing outcomes-based Course Learning Plan (18 weeks, Philippine BS Information Technology syllabus).
Rewrite ONLY the rows listed under ROWS TO REGENERATE. Keep each row's week. Keep them consistent with the rows that stay unchanged (do not duplicate their topics).
Return JSON: {"items": [${ITEM_SHAPE.replace("{", '{"rowId": string, ')}], "coverageWarnings": string[]} with exactly one item per row to regenerate, copying its "rowId".
${PLAN_RULES}${AI_GUARDRAILS}`,
    user: (input: PlanIn & { rowsToRegenerate?: any[]; keepRows?: any[] }) =>
      `${courseBlock(input)}

ADDITIONAL INSTRUCTIONS FROM THE FACULTY: ${input.instructions?.trim() || "none"}

ROWS THAT STAY UNCHANGED (context only):
${(input.keepRows ?? []).map((r) => `- Week ${r.weekStart}${r.weekEnd ? `-${r.weekEnd}` : ""}: ${r.content}`).join("\n") || "none"}

ROWS TO REGENERATE:
${(input.rowsToRegenerate ?? [])
  .map((r) => `- rowId=${r.id} | Week ${r.weekStart}${r.weekEnd ? `-${r.weekEnd}` : ""} | current content: ${r.content || "(empty)"} | current SILOs: ${r.silos || "(empty)"}`)
  .join("\n")}

${formatSources(input.sources)}`,
    maxTokens: 4000,
    temperature: 0.4,
    model: "gpt-4.1-2025-04-14",
  },

  "suggest-silo-support": {
    system: `You support a faculty member writing one row of an outcomes-based Course Learning Plan.
Given the row's Specific Intended Learning Outcomes (SILOs) and learning content, choose the Course Learning Outcomes (CLOs) the row directly supports (ONLY ids from the list, 1-2 usually), and propose 2-4 teaching and learning activities and 1-3 assessment tasks aligned with the SILOs' cognitive level.
Return JSON: {"cloIds": string[], "activities": string[], "assessment": string[], "explanation": string}.${AI_GUARDRAILS}`,
    user: (input: { silos?: string; content?: string; courseTitle?: string; clos?: { id: string; code: string; statement: string }[] }) =>
      `Course: ${input.courseTitle ?? ""}
Learning content: ${input.content || "(not given)"}
SILOs:
${input.silos ?? ""}

CLOs:
${(input.clos ?? []).map((c) => `id=${c.id} | ${c.code}: ${c.statement}`).join("\n")}`,
    maxTokens: 800,
    temperature: 0.3,
  },
};
