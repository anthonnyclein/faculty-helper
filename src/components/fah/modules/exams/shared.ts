"use client";
// Exam Builder helpers shared by the list, editor panels and preview.
import { newQuestion } from "@/lib/fah/factories";
import { uid, deepClone } from "@/lib/fah/ids";
import { QUESTION_TYPE_LABELS } from "@/lib/fah/calc";
import type { AppData, Exam, ExamTerm, Question, QuestionType, Syllabus } from "@/lib/fah/types";
import type { AiGenQuestion } from "@/lib/fah/ai/demo/exam";

export const EXAM_TERMS: ExamTerm[] = ["First Prelim", "Second Prelim", "Finals"];
export const QUESTION_TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }));
export const NONE = "__none__";
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const CODE_LANGUAGES = ["python", "java", "c", "cpp", "csharp", "javascript", "typescript", "php", "sql", "html", "pseudocode", "other"];

/** Text handed from the list's "Import existing exam" dialog to the editor's import panel. */
export const pendingImports = new Map<string, { text: string; fileName?: string }>();

export function examDisplayTitle(e: Exam): string {
  return e.title?.trim() || [e.courseCode, e.term].filter(Boolean).join(" · ") || "Untitled exam";
}

/** Reads ?mode=… from the hash route (#/exams/id?mode=generate). */
export function hashQuery(key: string): string | null {
  if (typeof window === "undefined") return null;
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q).get(key);
}

export function applySyllabusToExam(exam: Exam, syl: Syllabus | undefined): Exam {
  if (!syl) return { ...exam, syllabusId: undefined };
  return {
    ...exam,
    syllabusId: syl.id,
    courseCode: syl.courseCode || exam.courseCode,
    courseTitle: syl.descriptiveTitle || exam.courseTitle,
    semester: syl.semester || exam.semester,
    academicYear: syl.academicYear || exam.academicYear,
    resourceIds: exam.resourceIds.length ? exam.resourceIds : [...(syl.resourceIds ?? [])],
  };
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Choose an image file (PNG, JPG, GIF or SVG)."));
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error(`The image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is 1.5 MB — resize or compress it first.`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("The image could not be read."));
    r.readAsDataURL(file);
  });
}

export function duplicateExam(src: Exam): Exam {
  const copy = deepClone(src);
  const t = new Date().toISOString();
  copy.id = uid("exam");
  copy.createdAt = t;
  copy.updatedAt = t;
  copy.isDemo = false;
  copy.revision = 1;
  copy.title = copy.title ? `${copy.title} (Copy)` : "Untitled exam (Copy)";
  copy.sections.forEach((s) => {
    s.id = uid("sec");
    s.questions.forEach((q) => cloneQuestionIds(q));
  });
  return copy;
}

/** Fresh ids for a question and its nested choices/sub-items (keeps the correct-answer link). */
export function cloneQuestionIds(q: Question): Question {
  q.id = uid("q");
  if (q.choices) {
    const map = new Map<string, string>();
    q.choices.forEach((c) => {
      const n = uid("ch");
      map.set(c.id, n);
      c.id = n;
    });
    if (q.correctChoiceId) q.correctChoiceId = map.get(q.correctChoiceId);
  }
  q.subItems?.forEach((s) => (s.id = uid("sub")));
  return q;
}

export function syllabusClos(data: AppData, exam: Exam) {
  const syl = exam.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  return syl?.clos ?? [];
}

/** Converts an AI/demo question into an exam Question of the section's type. */
export function genToQuestion(
  g: AiGenQuestion,
  type: QuestionType,
  ctx: { clos: { id: string; code: string }[]; levels: string[]; origin: "ai" | "demo"; points?: number | null; validSourceIds: string[] }
): Question {
  const q = newQuestion(type);
  q.origin = ctx.origin;
  q.prompt = g.prompt ?? "";
  q.points = ctx.points ?? null;
  const flags: string[] = [];
  if (type === "multiple-choice") {
    const texts = (g.choices ?? []).filter((c) => c.trim());
    if (texts.length < 2) flags.push("AI returned fewer than two answer choices — add choices");
    const padded = texts.length >= 4 ? texts : [...texts, ...Array.from({ length: 4 - texts.length }, () => "")];
    q.choices = padded.map((text) => ({ id: uid("ch"), text }));
    const ci = typeof g.correctIndex === "number" ? g.correctIndex : texts.findIndex((t) => g.answerKey && t.trim() === g.answerKey.trim());
    if (ci >= 0 && ci < texts.length) q.correctChoiceId = q.choices[ci].id;
    else flags.push("No correct answer marked — set the answer key");
  } else {
    if (g.answerKey) q.answerKey = g.answerKey;
  }
  if (g.rubric) q.rubric = g.rubric;
  if (g.code) q.code = g.code;
  if (g.codeLanguage) q.codeLanguage = g.codeLanguage.toLowerCase();
  if (g.subItems?.length) q.subItems = g.subItems.map((p) => ({ id: uid("sub"), prompt: p }));
  if (g.topic) q.topic = g.topic;
  if (g.cloCode) {
    const c = ctx.clos.find((x) => x.code.trim().toLowerCase() === g.cloCode!.trim().toLowerCase());
    if (c) q.cloId = c.id;
  }
  if (g.cognitiveLevel) {
    const l = ctx.levels.find((x) => x.toLowerCase() === g.cognitiveLevel!.trim().toLowerCase());
    if (l) q.cognitiveLevel = l;
  }
  const src = (g.sourceIds ?? []).filter((id) => ctx.validSourceIds.includes(id));
  if (src.length) q.sourceResourceIds = src;
  if (!q.prompt.trim()) flags.push("Empty question text");
  if (flags.length) q.flags = flags;
  return q;
}

export function questionPlainChoices(q: Question): string[] | undefined {
  return q.choices?.map((c) => c.text);
}
