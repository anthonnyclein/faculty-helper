// Shared helpers for the TOS module (status, objective prefill, exam sync, mapping edits).
import type { AppData, Exam, MappingSource, Tos, TosMapping, TosObjective } from "@/lib/fah/types";
import { computeTos, examItems, type TosComputed } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";

export const NONE = "__none";

export type TosStatusTone = "ok" | "error" | "review";

export function tosStatus(tos: Tos, data: AppData): { computed: TosComputed; exam?: Exam; tone: TosStatusTone; label: string } {
  const exam = data.exams.find((e) => e.id === tos.examId);
  const computed = computeTos(tos, exam, data.institutional.tosLowerOrderCount);
  if (computed.needsReview) return { computed, exam, tone: "review", label: "Needs review (exam changed)" };
  if (computed.errors.length) return { computed, exam, tone: "error", label: `${computed.errors.length} error${computed.errors.length === 1 ? "" : "s"}` };
  return { computed, exam, tone: "ok", label: "Valid" };
}

/** Imported exams must have their extraction reviewed (no remaining flags) before a TOS is generated. */
export function flaggedQuestions(exam: Exam): { label: string; flags: string[] }[] {
  return examItems(exam)
    .filter((i) => i.question.flags?.length)
    .map((i) => ({ label: `${i.section.title || `Section ${i.sectionIndex + 1}`} · item ${i.label}`, flags: i.question.flags ?? [] }));
}

export function examDisplayName(e: Exam): string {
  return e.title || `${e.courseCode} ${e.term}`.trim() || "Untitled exam";
}

/** Objectives: linked syllabus CLOs → distinct question topics → one empty objective. */
export function initialObjectives(exam: Exam, data: AppData): TosObjective[] {
  const syl = exam.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  if (syl && syl.clos.length) {
    return syl.clos.map((c, i) => ({ id: uid("obj"), label: `${i + 1}. ${c.statement}`, cloId: c.id, weight: null }));
  }
  const topics = [...new Set(examItems(exam).map((i) => (i.question.topic ?? "").trim()).filter(Boolean))];
  if (topics.length) return topics.map((t, i) => ({ id: uid("obj"), label: `${i + 1}. ${t}`, topic: t, weight: null }));
  return [{ id: uid("obj"), label: "1. ", weight: null }];
}

/** One unassigned mapping per exam item. */
export function unassignedMappings(exam: Exam): TosMapping[] {
  return examItems(exam).map((i) => ({ questionId: i.questionId, sectionId: i.sectionId, objectiveId: null, level: null }));
}

export interface ExamSyncPlan {
  mappings: TosMapping[];
  added: string[]; // question ids
  removed: number;
  sectionsFixed: number;
  duplicatesRemoved: number;
}

/** Aligns mappings with the current exam without touching existing assignments. */
export function planExamSync(tos: Tos, exam: Exam): ExamSyncPlan {
  const items = examItems(exam);
  const byQ = new Map(items.map((i) => [i.questionId, i]));
  let removed = 0;
  let sectionsFixed = 0;
  let duplicatesRemoved = 0;
  const seen = new Set<string>();
  const kept: TosMapping[] = [];
  tos.mappings.forEach((m) => {
    const it = byQ.get(m.questionId);
    if (!it) {
      removed++;
      return;
    }
    if (seen.has(m.questionId)) {
      duplicatesRemoved++;
      return;
    }
    seen.add(m.questionId);
    if (m.sectionId !== it.sectionId) sectionsFixed++;
    kept.push({ ...m, sectionId: it.sectionId });
  });
  const added = items.filter((i) => !seen.has(i.questionId));
  const order = new Map(items.map((i) => [i.questionId, i.ordinal]));
  const mappings = [...kept, ...added.map((i) => ({ questionId: i.questionId, sectionId: i.sectionId, objectiveId: null, level: null }))].sort(
    (a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0)
  );
  return { mappings, added: added.map((i) => i.questionId), removed, sectionsFixed, duplicatesRemoved };
}

/** Sets objective and/or level for the given questions (creating mappings when missing). */
export function assignMappings(
  tos: Tos,
  exam: Exam | undefined,
  questionIds: string[],
  patch: { objectiveId?: string | null; level?: string | null; rationale?: string },
  source: MappingSource = "manual"
): Tos {
  const ids = new Set(questionIds);
  const items = exam ? examItems(exam) : [];
  const existing = new Set(tos.mappings.map((m) => m.questionId));
  const mappings = tos.mappings.map((m) =>
    ids.has(m.questionId)
      ? {
          ...m,
          ...(patch.objectiveId !== undefined ? { objectiveId: patch.objectiveId } : {}),
          ...(patch.level !== undefined ? { level: patch.level } : {}),
          ...(patch.rationale !== undefined ? { rationale: patch.rationale } : {}),
          mappingSource: source,
        }
      : m
  );
  items
    .filter((i) => ids.has(i.questionId) && !existing.has(i.questionId))
    .forEach((i) =>
      mappings.push({
        questionId: i.questionId,
        sectionId: i.sectionId,
        objectiveId: patch.objectiveId ?? null,
        level: patch.level ?? null,
        rationale: patch.rationale,
        mappingSource: source,
      })
    );
  return { ...tos, mappings };
}

export function sameLevels(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function excerpt(s: string, n = 90): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
