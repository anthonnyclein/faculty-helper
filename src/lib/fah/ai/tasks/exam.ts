import { AI_GUARDRAILS, formatSources, type AiTaskRegistry } from "../types";
import type { ExtractInput, GenerateExamInput, RegenerateInput } from "../demo/exam";

// Exam AI tasks (generation, regeneration, import extraction).
// Client contracts, validators and demonstration fallbacks live in src/lib/fah/ai/demo/exam.ts.

const QUESTION_SHAPE = `{"prompt": string, "choices"?: string[], "correctIndex"?: number, "answerKey"?: string, "rubric"?: string, "code"?: string, "codeLanguage"?: string, "subItems"?: string[], "topic"?: string, "cloCode"?: string, "cognitiveLevel"?: string, "sourceIds"?: string[]}`;

const TYPE_RULES = `Question-type rules:
- "multiple-choice": exactly 4 plausible "choices" (no "all/none of the above" unless essential), a single correct option given by 0-based "correctIndex"; distractors must be clearly wrong according to the sources.
- "identification": a statement or definition whose answer is a short term; put the term in "answerKey". Do not include choices.
- "essay" / "analysis": open-ended prompt; give expected points in "answerKey" and a scoring "rubric" whose criteria add up to 100%.
- "drawing": ask for a labeled diagram or design; include a "rubric".
- "programming": a precise problem statement; optional starter "code" snippet (with "codeLanguage"); give a model solution outline in "answerKey" and a "rubric".
- "custom": follow the section title/label and instructions.
- "subItems" (a, b, c) are optional parts of ONE item; they share the parent's points.
- Answer keys and rubrics are for the teacher only — never put the answer inside the student-facing "prompt".`;

function metaBlock(i: { exam?: GenerateExamInput["exam"]; coverage?: string; instructions?: string; clos?: { code: string; statement: string }[]; levels?: string[] }) {
  const e = i.exam ?? ({} as GenerateExamInput["exam"]);
  return [
    `COURSE: ${e.courseCode ?? ""} — ${e.courseTitle ?? ""}`,
    `EXAM: ${e.title ?? ""} (${e.term ?? ""})`,
    `COVERAGE / SCOPE: ${i.coverage?.trim() || "(not specified)"}`,
    `TEACHER INSTRUCTIONS: ${i.instructions?.trim() || "(none)"}`,
    `COURSE LEARNING OUTCOMES (use the code exactly in "cloCode"):\n${(i.clos ?? []).map((c) => `${c.code}: ${c.statement}`).join("\n") || "(none provided — omit cloCode)"}`,
    `COGNITIVE LEVELS (copy exactly into "cognitiveLevel"): ${(i.levels ?? []).join(", ") || "(none)"}`,
  ].join("\n");
}

export const examTasks: AiTaskRegistry = {
  "generate-exam": {
    system: `You are an experienced university examiner writing a Philippine college examination.
Write NEW exam questions strictly grounded in the provided source excerpts and within the stated coverage.
For every requested section, produce EXACTLY the requested number of questions of the requested type. Do not add or remove sections.
Vary the questions (no duplicates, no near-duplicates of the "avoid" list). Use clear, grammatical, unambiguous English suitable for the level.
${TYPE_RULES}
Return JSON: {"sections": [{"sectionId": string, "questions": [${QUESTION_SHAPE}]}], "coverageWarnings": string[]}.
Use the sectionId values exactly as given. When the sources do not support enough questions for a section, still return the requested count but add a coverageWarnings entry saying which topic lacked support.${AI_GUARDRAILS}`,
    user: (input: GenerateExamInput) =>
      `${metaBlock(input)}

SECTIONS TO GENERATE:
${(input.sections ?? [])
  .map((s) => `- sectionId=${s.id} | title="${s.title}" | type=${s.type} (${s.typeLabel}) | count=${s.count} | points per item=${s.points ?? "default"}${s.instructions ? ` | instructions: ${s.instructions}` : ""}`)
  .join("\n")}

AVOID (already in the exam):
${(input.avoid ?? []).slice(0, 60).map((p) => `- ${p.slice(0, 160)}`).join("\n") || "(none)"}

${formatSources(input.sources)}`,
    maxTokens: 7000,
    temperature: 0.5,
    model: "gpt-4.1-2025-04-14",
  },

  "regenerate-questions": {
    system: `You rewrite selected examination questions. For EACH question given, write ONE replacement of the SAME type that assesses the same topic / learning outcome at a similar cognitive level, grounded in the sources, and different from the original wording and from the "avoid" list.
Follow the teacher's direction when given. Keep the same "id" so each replacement can be matched to its original.
${TYPE_RULES}
Return JSON: {"questions": [{"id": string, ...${QUESTION_SHAPE.slice(1)}], "coverageWarnings": string[]}.${AI_GUARDRAILS}`,
    user: (input: RegenerateInput) =>
      `${metaBlock(input)}
TEACHER DIRECTION FOR THE NEW VERSIONS: ${input.direction?.trim() || "(none — produce a fresh, equivalent question)"}

QUESTIONS TO REPLACE:
${(input.questions ?? [])
  .map(
    (q) =>
      `- id=${q.id} | type=${q.type} (${q.typeLabel}) | points=${q.points} | topic=${q.topic ?? ""} | cloCode=${q.cloCode ?? ""} | level=${q.cognitiveLevel ?? ""}\n  original: ${q.prompt}${
        q.choices?.length ? `\n  original choices: ${q.choices.join(" | ")}` : ""
      }`
  )
  .join("\n")}

AVOID (other questions in the exam):
${(input.avoid ?? []).slice(0, 60).map((p) => `- ${p.slice(0, 160)}`).join("\n") || "(none)"}

${formatSources(input.sources)}`,
    maxTokens: 4000,
    temperature: 0.6,
    model: "gpt-4.1-2025-04-14",
  },

  "extract-exam": {
    system: `You convert the plain text of an EXISTING examination into structured data. You are a careful transcriber, not an author.
- Copy every question, choice, instruction and answer EXACTLY as written (same words, spelling, punctuation and capitalization). Never rewrite, correct, translate, summarize or complete anything.
- Detect sections (e.g. "Test I", "Part II", "I. MULTIPLE CHOICE") with their instructions, and numbered items ("1.", "1)").
- "type" must be one of: multiple-choice, identification, essay, analysis, drawing, programming, custom.
- Multiple-choice options go in "choices" WITHOUT their letter labels. Lettered parts of non-multiple-choice items go in "subItems".
- Keep the printed item number as a string in "number". Do NOT renumber, even when numbering has gaps, duplicates or restarts.
- If a points value is printed (e.g. "(5 pts)", "2 points each"), set "points" (per item) or "defaultPoints" (per section).
- If an answer key is present in the text, copy it into "answerKey"; otherwise omit it. Never invent answers.
- Whenever anything is uncertain (merged lines, unclear boundaries, missing text, unreadable symbols, unclear type) set "uncertain" to a short reason on that item, and list general problems in "warnings".
Return JSON: {"title"?: string, "generalInstructions"?: string, "sections": [{"title": string, "instructions": string, "type": string, "defaultPoints"?: number, "questions": [{"number": string, "prompt": string, "choices"?: string[], "subItems"?: string[], "answerKey"?: string, "points"?: number, "uncertain"?: string}]}], "warnings": string[]}.
Respond with a single valid JSON value and nothing else (no markdown fences).`,
    user: (input: ExtractInput) =>
      `${input.templateHint ? `FORMAT HINT (the institution's exam template, for recognizing headings only — do not copy its content):\n${input.templateHint.slice(0, 3000)}\n\n` : ""}EXAM TEXT TO EXTRACT:\n"""\n${(input.text ?? "").slice(0, 60000)}\n"""`,
    maxTokens: 7000,
    temperature: 0,
    model: "gpt-4.1-2025-04-14",
  },
};
