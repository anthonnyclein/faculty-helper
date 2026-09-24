// Exam AI contracts (shared by client + server prompts), deterministic demonstration generators
// (no AI model involved) and validators that sanitize live AI output into the documented shapes.
import type { QuestionType } from "../../types";
import { parseExamText } from "../../services/exam-import";

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

export interface AiSource {
  id: string;
  title: string;
  text: string;
}

export interface ExamMetaInput {
  courseCode: string;
  courseTitle: string;
  term: string;
  title: string;
}

export interface AiGenQuestion {
  prompt: string;
  choices?: string[];
  correctIndex?: number;
  answerKey?: string;
  rubric?: string;
  code?: string;
  codeLanguage?: string;
  subItems?: string[];
  topic?: string;
  cloCode?: string;
  cognitiveLevel?: string;
  sourceIds?: string[];
}

export interface GenerateSectionPlan {
  id: string;
  title: string;
  type: QuestionType;
  typeLabel: string;
  count: number;
  points: number | null;
  instructions?: string;
}

export interface GenerateExamInput {
  exam: ExamMetaInput;
  coverage: string;
  instructions: string;
  sections: GenerateSectionPlan[];
  clos: { code: string; statement: string }[];
  levels: string[];
  sources: AiSource[];
  /** Prompts already in the exam — must not be duplicated. */
  avoid?: string[];
}

export interface GenerateExamResult {
  sections: { sectionId: string; questions: AiGenQuestion[] }[];
  coverageWarnings: string[];
}

export interface RegenerateQuestionInput {
  id: string;
  type: QuestionType;
  typeLabel: string;
  prompt: string;
  choices?: string[];
  topic?: string;
  cloCode?: string;
  cognitiveLevel?: string;
  points: number;
}

export interface RegenerateInput {
  exam: ExamMetaInput;
  coverage: string;
  instructions: string;
  /** Teacher's reason / direction for the new versions. */
  direction: string;
  clos: { code: string; statement: string }[];
  levels: string[];
  sources: AiSource[];
  questions: RegenerateQuestionInput[];
  avoid?: string[];
  /** Changes on every request so demo output varies between attempts. */
  attempt?: number;
}

export interface RegenerateResult {
  questions: (AiGenQuestion & { id: string })[];
  coverageWarnings: string[];
}

export interface ExtractedQuestion {
  number?: string;
  prompt: string;
  choices?: string[];
  subItems?: string[];
  answerKey?: string;
  points?: number | null;
  uncertain?: string;
}

export interface ExtractedSection {
  title: string;
  instructions: string;
  type: string; // QuestionType or unknown label
  defaultPoints?: number | null;
  questions: ExtractedQuestion[];
}

export interface ExtractInput {
  text: string;
  templateHint?: string;
}

export interface ExtractResult {
  title?: string;
  generalInstructions?: string;
  sections: ExtractedSection[];
  warnings: string[];
}

export const QUESTION_TYPES: QuestionType[] = ["multiple-choice", "identification", "essay", "analysis", "drawing", "programming", "custom"];

/* ------------------------------------------------------------------ */
/* Validators (live AI output → documented shape)                      */
/* ------------------------------------------------------------------ */

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const strArr = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter((x) => x.trim()) : undefined);
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function toGenQuestion(v: any): AiGenQuestion | null {
  if (!v || typeof v !== "object") return null;
  const prompt = str(v.prompt) ?? str(v.question) ?? "";
  const ci = numOrNull(v.correctIndex);
  return {
    prompt,
    choices: strArr(v.choices),
    correctIndex: ci === null ? undefined : Math.round(ci),
    answerKey: str(v.answerKey),
    rubric: str(v.rubric),
    code: typeof v.code === "string" && v.code.trim() ? v.code : undefined,
    codeLanguage: str(v.codeLanguage),
    subItems: strArr(v.subItems),
    topic: str(v.topic),
    cloCode: str(v.cloCode),
    cognitiveLevel: str(v.cognitiveLevel),
    sourceIds: strArr(v.sourceIds),
  };
}

export function validateGenerateResult(v: unknown): GenerateExamResult {
  const o = v as any;
  if (!o || !Array.isArray(o.sections)) throw new Error("Missing sections array");
  return {
    sections: o.sections
      .filter((s: any) => s && typeof s === "object")
      .map((s: any) => ({
        sectionId: String(s.sectionId ?? s.id ?? ""),
        questions: (Array.isArray(s.questions) ? s.questions : []).map(toGenQuestion).filter(Boolean) as AiGenQuestion[],
      })),
    coverageWarnings: strArr(o.coverageWarnings) ?? [],
  };
}

export function validateRegenerateResult(v: unknown): RegenerateResult {
  const o = v as any;
  if (!o || !Array.isArray(o.questions)) throw new Error("Missing questions array");
  return {
    questions: o.questions
      .map((q: any) => {
        const g = toGenQuestion(q);
        return g && q?.id ? { ...g, id: String(q.id) } : null;
      })
      .filter(Boolean),
    coverageWarnings: strArr(o.coverageWarnings) ?? [],
  };
}

export function validateExtractResult(v: unknown): ExtractResult {
  const o = v as any;
  if (!o || !Array.isArray(o.sections)) throw new Error("Missing sections array");
  return {
    title: str(o.title),
    generalInstructions: typeof o.generalInstructions === "string" ? o.generalInstructions : undefined,
    sections: o.sections.map((s: any) => ({
      title: typeof s?.title === "string" ? s.title : "",
      instructions: typeof s?.instructions === "string" ? s.instructions : "",
      type: typeof s?.type === "string" ? s.type : "custom",
      defaultPoints: numOrNull(s?.defaultPoints),
      questions: (Array.isArray(s?.questions) ? s.questions : []).map((q: any) => ({
        number: q?.number !== undefined && q?.number !== null ? String(q.number) : undefined,
        prompt: typeof q?.prompt === "string" ? q.prompt : "",
        choices: strArr(q?.choices),
        subItems: strArr(q?.subItems),
        answerKey: str(q?.answerKey),
        points: numOrNull(q?.points),
        uncertain: str(q?.uncertain),
      })),
    })),
    warnings: strArr(o.warnings) ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Source text analysis (demo)                                         */
/* ------------------------------------------------------------------ */

interface Definition {
  term: string;
  verb: string;
  rest: string;
  sentence: string;
  sourceId: string;
}

function splitSentences(text: string): string[] {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 25 && s.length <= 320);
}

const DEF_RE = /^(?:(?:An?|The)\s+)?([A-Za-z][A-Za-z0-9 \-()/'’]{1,60}?)\s+(is|are|refers to|means|is defined as|are defined as)\s+(.{12,})$/;
const BAD_TERMS = /^(it|this|that|there|these|those|they|he|she|we|you|which|what|one|each|such|here|also|many|some|all|most)\b/i;

function findDefinitions(sources: AiSource[]): Definition[] {
  const out: Definition[] = [];
  const seen = new Set<string>();
  sources.forEach((src) =>
    splitSentences(src.text).forEach((sentence) => {
      const m = sentence.match(DEF_RE);
      if (!m) return;
      const term = m[1].trim();
      const words = term.split(/\s+/).length;
      if (words > 6 || BAD_TERMS.test(term) || term.length < 3) return;
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ term, verb: m[2], rest: m[3].replace(/[.!?]+$/, ""), sentence, sourceId: src.id });
    })
  );
  return out;
}

/** Capitalized multi-word phrases used as extra distractors. */
function keyPhrases(sources: AiSource[]): string[] {
  const counts = new Map<string, number>();
  sources.forEach((s) =>
    (s.text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) ?? []).forEach((raw) => {
      const p = raw.replace(/^(The|A|An)\s+/, "");
      if (p.length < 4 || BAD_TERMS.test(p) || /^(The|A|An|In|On|For|To|Of|And|But|When|If)$/.test(p)) return;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    })
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const TYPE_LEVEL_INDEX: Record<QuestionType, number> = {
  "multiple-choice": 0,
  identification: 0,
  essay: 1,
  analysis: 3,
  drawing: 5,
  programming: 2,
  custom: 1,
};

function levelFor(type: QuestionType, levels: string[]): string | undefined {
  if (!levels.length) return undefined;
  return levels[Math.min(TYPE_LEVEL_INDEX[type], levels.length - 1)];
}

function cloFor(text: string, clos: { code: string; statement: string }[]): string | undefined {
  if (!clos.length) return undefined;
  const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  let best = clos[0];
  let bestScore = -1;
  clos.forEach((c) => {
    const score = c.statement.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && words.has(w)).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  });
  return best.code;
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function coverageTopics(coverage: string): string[] {
  const t = (coverage || "")
    .split(/[\n;,]+/)
    .map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter((x) => x.length > 2);
  return t.length ? t : ["the topics in the exam coverage"];
}

interface DemoCtx {
  defs: Definition[];
  phrases: string[];
  levels: string[];
  clos: { code: string; statement: string }[];
  coverage: string;
}

/** Builds one demo question of `type` from definition #idx (or a generic placeholder when no sources). */
function demoQuestion(type: QuestionType, idx: number, ctx: DemoCtx, typeLabel: string): AiGenQuestion {
  const level = levelFor(type, ctx.levels);
  if (!ctx.defs.length) {
    const topics = coverageTopics(ctx.coverage);
    const topic = topics[idx % topics.length];
    const n = idx + 1;
    const base: AiGenQuestion = {
      prompt: "",
      topic,
      cognitiveLevel: level,
      cloCode: cloFor(topic, ctx.clos),
      sourceIds: [],
    };
    switch (type) {
      case "multiple-choice":
        return {
          ...base,
          prompt: `[Demo] Which statement best describes a key idea of ${topic}? (placeholder ${n})`,
          choices: ["[Demo] Option A", "[Demo] Option B", "[Demo] Option C", "[Demo] Option D"],
          correctIndex: idx % 4,
        };
      case "identification":
        return { ...base, prompt: `[Demo] Identify the term described here: a core concept of ${topic}. (placeholder ${n})`, answerKey: "[Demo] Write the expected term" };
      case "programming":
        return {
          ...base,
          prompt: `[Demo] Write a short program that applies a concept covered in ${topic}.`,
          codeLanguage: "python",
          rubric: "[Demo] Correctness 50% · Code structure 30% · Documentation 20%",
        };
      case "drawing":
        return { ...base, prompt: `[Demo] Draw and label a diagram that illustrates ${topic}.`, rubric: "[Demo] Completeness 50% · Correct labels 30% · Neatness 20%" };
      default:
        return {
          ...base,
          prompt: `[Demo] Explain the concept of ${topic} covered in ${ctx.coverage.trim() || "this examination"}. (${typeLabel} placeholder ${n})`,
          rubric: "[Demo] Content accuracy 50% · Organization 30% · Examples 20%",
        };
    }
  }

  const d = ctx.defs[idx % ctx.defs.length];
  const round = Math.floor(idx / ctx.defs.length); // >0 when definitions are reused
  const base: AiGenQuestion = {
    prompt: "",
    topic: d.term,
    cognitiveLevel: level,
    cloCode: cloFor(d.sentence, ctx.clos),
    sourceIds: [d.sourceId],
  };
  const plural = /are/.test(d.verb);
  switch (type) {
    case "multiple-choice": {
      const pool = [...ctx.defs.filter((x) => x.term !== d.term).map((x) => x.term), ...ctx.phrases.filter((p) => p.toLowerCase() !== d.term.toLowerCase())];
      const distractors: string[] = [];
      const start = hashStr(d.term) % Math.max(1, pool.length);
      for (let i = 0; i < pool.length && distractors.length < 3; i++) {
        const cand = pool[(start + i) % pool.length];
        const lc = cand.toLowerCase();
        const tl = d.term.toLowerCase();
        const overlaps = lc.includes(tl) || tl.includes(lc) || distractors.some((x) => x.toLowerCase().includes(lc) || lc.includes(x.toLowerCase()));
        if (!overlaps) distractors.push(cand);
      }
      while (distractors.length < 3) distractors.push(`[Demo distractor ${distractors.length + 1}]`);
      const correctIndex = (idx + round) % 4;
      const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
      const choices = distractors.map(cap);
      choices.splice(correctIndex, 0, cap(d.term));
      const stem = round % 2 === 0 ? `Which of the following ${plural ? "are" : "is"} ${lowerFirst(d.rest)}?` : `“${d.rest}.” This describes which of the following?`;
      return { ...base, prompt: stem, choices, correctIndex, answerKey: cap(d.term) };
    }
    case "identification":
      return { ...base, prompt: `${plural ? "These are" : "It is"} ${lowerFirst(d.rest)}.`, answerKey: d.term };
    case "essay":
      return {
        ...base,
        prompt:
          round % 2 === 0
            ? `Discuss ${d.term} as presented in the course materials. Explain its meaning and give one practical example.`
            : `In your own words, explain why ${d.term} is important and how it relates to the other topics covered.`,
        answerKey: `Expected points: ${d.sentence}`,
        rubric: "Accurate explanation of the concept – 50%\nRelevant example – 30%\nClarity and organization – 20%",
      };
    case "analysis":
      return {
        ...base,
        prompt: `Analyze the following statement and explain its implications in a real-world situation:\n“${d.sentence}”`,
        answerKey: `Answers should break down the statement about ${d.term} and relate it to a concrete scenario.`,
        rubric: "Correct interpretation – 40%\nDepth of analysis – 40%\nSupporting example – 20%",
      };
    case "drawing":
      return {
        ...base,
        prompt: `Draw a labeled diagram that illustrates ${d.term}. Briefly describe each part of your diagram.`,
        rubric: "Correct components – 50%\nAccurate labels – 30%\nNeatness and clarity – 20%",
      };
    case "programming":
      return {
        ...base,
        prompt: `Write a program that demonstrates ${d.term}. Use meaningful variable names and include comments explaining each step.`,
        codeLanguage: "python",
        answerKey: `A correct solution applies the idea that ${lowerFirst(d.rest)}.`,
        rubric: "Correct output – 50%\nProper use of the concept – 30%\nReadability and comments – 20%",
      };
    default:
      return {
        ...base,
        prompt: `Explain ${d.term} and give an example.`,
        answerKey: d.sentence,
        rubric: "Accuracy – 60%\nExample – 40%",
      };
  }
}

function demoCtx(input: { sources: AiSource[]; levels: string[]; clos: { code: string; statement: string }[]; coverage: string }): DemoCtx {
  return {
    defs: findDefinitions(input.sources ?? []),
    phrases: keyPhrases(input.sources ?? []),
    levels: input.levels ?? [],
    clos: input.clos ?? [],
    coverage: input.coverage ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* Demo generators                                                     */
/* ------------------------------------------------------------------ */

export function demoGenerateExam(input: GenerateExamInput): GenerateExamResult {
  const ctx = demoCtx(input);
  const warnings: string[] = [];
  if (!input.sources?.length) warnings.push("No readable resources were provided, so the demonstration produced generic placeholder questions marked [Demo].");
  else if (!ctx.defs.length)
    warnings.push("No definition-style sentences (“X is …”) were found in the resources; the demonstration produced generic placeholder questions.");
  let cursor = 0;
  const sections = input.sections.map((s) => {
    const questions: AiGenQuestion[] = [];
    for (let i = 0; i < s.count; i++) questions.push(demoQuestion(s.type, cursor++, ctx, s.typeLabel));
    return { sectionId: s.id, questions };
  });
  const total = input.sections.reduce((a, s) => a + s.count, 0);
  if (ctx.defs.length && total > ctx.defs.length)
    warnings.push(`The resources contain ${ctx.defs.length} usable definitions for ${total} requested items; some concepts are reused with different wording.`);
  console.log("[ai-demo] generate-exam", { sections: sections.length, items: total, definitions: ctx.defs.length });
  return { sections, coverageWarnings: warnings };
}

export function demoRegenerate(input: RegenerateInput): RegenerateResult {
  const ctx = demoCtx(input);
  const attempt = input.attempt ?? 1;
  const questions = input.questions.map((q, i) => {
    const offset = (hashStr(q.id) + attempt * 7 + i * 3) % Math.max(1, ctx.defs.length || 5);
    let g = demoQuestion(q.type, offset + (ctx.defs.length ? 0 : attempt), ctx, q.typeLabel);
    if (g.prompt.trim() === q.prompt.trim()) g = demoQuestion(q.type, offset + 1, ctx, q.typeLabel);
    return { ...g, id: q.id, cognitiveLevel: q.cognitiveLevel || g.cognitiveLevel, cloCode: q.cloCode || g.cloCode };
  });
  console.log("[ai-demo] regenerate-questions", { count: questions.length, attempt });
  return {
    questions,
    coverageWarnings: input.sources?.length ? [] : ["No readable resources were provided; replacements are generic placeholders."],
  };
}

export function demoExtractExam(input: ExtractInput): ExtractResult {
  const r = parseExamText(input.text ?? "");
  console.log("[ai-demo] extract-exam", { sections: r.sections.length, items: r.sections.reduce((a, s) => a + s.questions.length, 0) });
  return { ...r, warnings: ["Extracted with the built-in rule-based parser (demonstration). Review every item.", ...r.warnings] };
}
