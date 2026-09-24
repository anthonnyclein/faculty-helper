// Pure calculations shared by editors, previews, exports and validation.
import type {
  DimensionRow,
  Exam,
  ExamSection,
  GradingRow,
  POCategory,
  Question,
  QuestionType,
  Syllabus,
  SyllabusPO,
  Tos,
} from "./types";
import { EXAM_TERM_TO_TOS_PERIOD } from "./template";

/* ------------------------------------------------------------------ */
/* Syllabus                                                            */
/* ------------------------------------------------------------------ */

export const PO_CATEGORIES: POCategory[] = [1, 2, 3, 4, 5];

/** Syllabus POs ordered by category, preserving order inside each category. */
export function orderedPOs(s: Pick<Syllabus, "programOutcomes">): SyllabusPO[] {
  return PO_CATEGORIES.flatMap((c) => s.programOutcomes.filter((p) => p.category === c));
}

/** Sequential printed numbers (1..N) across categories, as in the reference template. */
export function poNumbers(s: Pick<Syllabus, "programOutcomes">): Map<string, number> {
  const m = new Map<string, number>();
  orderedPOs(s).forEach((p, i) => m.set(p.id, i + 1));
  return m;
}

export function poLabel(s: Pick<Syllabus, "programOutcomes">, poId: string): string {
  const n = poNumbers(s).get(poId);
  return n ? `PO ${n}` : "PO ?";
}

export function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function gradingTotal(rows: GradingRow[]): number {
  return round2(rows.reduce((a, r) => a + num(r.weight), 0));
}

export function gradingIssues(rows: GradingRow[]): string[] {
  const out: string[] = [];
  if (!rows.length) out.push("Add at least one grading component.");
  rows.forEach((r, i) => {
    if (!r.component.trim()) out.push(`Row ${i + 1}: component name is required.`);
    if (r.weight === null || r.weight === undefined || Number.isNaN(r.weight)) out.push(`Row ${i + 1}: weight is required.`);
    else if (r.weight < 0 || r.weight > 100) out.push(`Row ${i + 1}: weight must be between 0 and 100%.`);
  });
  const t = gradingTotal(rows);
  if (Math.abs(t - 100) > 0.001) out.push(`Grading weights total ${t}% — they must total exactly 100%.`);
  return out;
}

export function dimensionTotals(rows: DimensionRow[]) {
  return {
    prelim: round2(rows.reduce((a, r) => a + num(r.prelim), 0)),
    midterm: round2(rows.reduce((a, r) => a + num(r.midterm), 0)),
    finals: round2(rows.reduce((a, r) => a + num(r.finals), 0)),
  };
}

export function dimensionIssues(rows: DimensionRow[]): string[] {
  const t = dimensionTotals(rows);
  const out: string[] = [];
  (["prelim", "midterm", "finals"] as const).forEach((k) => {
    if (Math.abs(t[k] - 100) > 0.001) out.push(`${k === "prelim" ? "Prelim" : k === "midterm" ? "Midterm" : "Finals"} column totals ${t[k]}% — must be 100%.`);
  });
  return out;
}

export function weekLabel(start: number, end?: number | null): string {
  if (end && end > start) return `Weeks ${start}-${end}`;
  return `Week ${start}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "2nd Semester" → ["2", "nd", " Semester"] helper for superscript ordinal rendering. */
export function splitOrdinal(s: string): { before: string; sup: string; after: string } | null {
  const m = s.match(/^(.*?\b\d+)(st|nd|rd|th)(\b.*)$/i);
  if (!m) return null;
  return { before: m[1], sup: m[2], after: m[3] };
}

/* ------------------------------------------------------------------ */
/* Exams                                                               */
/* ------------------------------------------------------------------ */

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  "multiple-choice": "Multiple Choice",
  identification: "Identification",
  essay: "Discussion / Essay",
  analysis: "Analysis",
  drawing: "Drawing / Design",
  programming: "Programming Problem",
  custom: "Custom",
};

export function sectionTypeLabel(sec: ExamSection): string {
  if (sec.type === "custom") return sec.customTypeLabel?.trim() || "Custom";
  return QUESTION_TYPE_LABELS[sec.type];
}

export function questionPoints(q: Question, sec: ExamSection): number {
  return q.points !== null && q.points !== undefined ? num(q.points) : num(sec.defaultPoints);
}

export function sectionTotals(sec: ExamSection) {
  return {
    items: sec.questions.length,
    points: round2(sec.questions.reduce((a, q) => a + questionPoints(q, sec), 0)),
  };
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let r = "";
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}

export interface ExamItemRef {
  questionId: string;
  sectionId: string;
  sectionIndex: number;
  indexInSection: number; // 1-based
  ordinal: number; // 1-based across exam
  label: string; // printed item number ("12" or "II.3")
  points: number;
  typeLabel: string;
  question: Question;
  section: ExamSection;
}

/** Flat list of exam items. Rule: every top-level question = ONE item; sub-items belong to their parent. */
export function examItems(exam: Exam): ExamItemRef[] {
  const out: ExamItemRef[] = [];
  let ordinal = 0;
  exam.sections.forEach((sec, si) => {
    sec.questions.forEach((q, qi) => {
      ordinal++;
      out.push({
        questionId: q.id,
        sectionId: sec.id,
        sectionIndex: si,
        indexInSection: qi + 1,
        ordinal,
        label: exam.numbering === "per-section" ? `${toRoman(si + 1)}.${qi + 1}` : String(ordinal),
        points: questionPoints(q, sec),
        typeLabel: sectionTypeLabel(sec),
        question: q,
        section: sec,
      });
    });
  });
  return out;
}

export function examTotals(exam: Exam) {
  const items = examItems(exam);
  return { items: items.length, points: round2(items.reduce((a, i) => a + i.points, 0)) };
}

export function examIssues(exam: Exam): string[] {
  const out: string[] = [];
  if (!exam.courseCode.trim()) out.push("Course code is required.");
  if (!exam.title.trim()) out.push("Exam title is required.");
  if (!exam.sections.length) out.push("Add at least one section.");
  exam.sections.forEach((s, i) => {
    const t = sectionTotals(s);
    const name = s.title || `Section ${i + 1}`;
    if (s.plannedItems !== null && s.plannedItems !== undefined && s.plannedItems !== t.items)
      out.push(`${name}: planned ${s.plannedItems} items but has ${t.items}.`);
    s.questions.forEach((q, qi) => {
      if (!q.prompt.trim()) out.push(`${name}, item ${qi + 1}: question text is empty.`);
      if (s.type === "multiple-choice") {
        const filled = (q.choices ?? []).filter((c) => c.text.trim());
        if (filled.length < 2) out.push(`${name}, item ${qi + 1}: needs at least two answer choices.`);
      }
      if (q.flags?.length) out.push(`${name}, item ${qi + 1}: flagged for review (${q.flags.join("; ")}).`);
    });
  });
  return out;
}

/** Content signature used to detect exam changes that affect a TOS. */
export function examSignature(exam: Exam): string {
  const parts = exam.sections.map(
    (s) => `${s.id}|${s.type}|${s.defaultPoints}|` + s.questions.map((q) => `${q.id}:${q.points ?? "d"}:${q.prompt.length}:${hash(q.prompt)}`).join(",")
  );
  return `${exam.numbering}#${parts.join("/")}`;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------------ */
/* Table of Specifications                                             */
/* ------------------------------------------------------------------ */

export interface TosCell {
  objectiveId: string;
  level: string;
  items: ExamItemRef[]; // in exam order
  count: number;
  points: number;
  horizontalNumbers: number[];
  verticalNumbers: number[];
}

export interface TosComputed {
  levels: string[];
  cells: Map<string, TosCell>; // key `${objectiveId}::${level}`
  rowTotals: Map<string, { count: number; points: number; testTypes: string[] }>;
  colTotals: Map<string, { count: number; points: number; pointsPerItem: string; percent: number }>;
  totalCount: number;
  totalPoints: number;
  groupPercents: { label: string; levels: string[]; percent: number }[];
  /** placement number → exam item, per layout */
  horizontalKey: { placement: number; item: ExamItemRef }[];
  verticalKey: { placement: number; item: ExamItemRef }[];
  examItemCount: number;
  examPoints: number;
  errors: string[];
  warnings: string[];
  needsReview: boolean;
  period: "Prelim" | "Midterm" | "Final";
}

export const cellKey = (objectiveId: string, level: string) => `${objectiveId}::${level}`;

/** Compress sorted numbers to template style: "1", "11, 12", "3-5", "1-4, 9". */
export function formatNumberList(nums: number[]): string {
  if (!nums.length) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else runs.push([n]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${r[0]}-${r[r.length - 1]}` : r.join(", ")))
    .join(", ");
}

/** Actual exam labels, compressing consecutive runs inside the same section. */
export function formatItemLabels(items: ExamItemRef[], exam: Exam): string {
  if (!items.length) return "";
  if (exam.numbering === "continuous") return formatNumberList(items.map((i) => i.ordinal));
  const bySec = new Map<number, number[]>();
  items.forEach((i) => bySec.set(i.sectionIndex, [...(bySec.get(i.sectionIndex) ?? []), i.indexInSection]));
  return [...bySec.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([si, nums]) => formatNumberList(nums).split(", ").map((x) => `${toRoman(si + 1)}.${x}`).join(", "))
    .join(", ");
}

export function computeTos(tos: Tos, exam: Exam | undefined, lowerOrderCount = 3): TosComputed {
  const errors: string[] = [];
  const warnings: string[] = [];
  const levels = tos.levels;
  const cells = new Map<string, TosCell>();
  tos.objectives.forEach((o) =>
    levels.forEach((l) =>
      cells.set(cellKey(o.id, l), { objectiveId: o.id, level: l, items: [], count: 0, points: 0, horizontalNumbers: [], verticalNumbers: [] })
    )
  );

  const items = exam ? examItems(exam) : [];
  const byId = new Map(items.map((i) => [i.questionId, i]));
  const seen = new Map<string, number>();

  if (!exam) errors.push("The source exam no longer exists. Link this TOS to an existing exam.");

  tos.mappings.forEach((m) => {
    seen.set(m.questionId, (seen.get(m.questionId) ?? 0) + 1);
    const it = byId.get(m.questionId);
    if (!it) {
      errors.push("A mapping refers to a question that is no longer in the source exam. Update the TOS from the exam.");
      return;
    }
    if (m.sectionId !== it.sectionId)
      errors.push(`Item ${it.label}: the recorded section reference is out of date (question moved to another section).`);
    if (!m.objectiveId || !tos.objectives.some((o) => o.id === m.objectiveId)) return;
    if (!m.level || !levels.includes(m.level)) return;
    const c = cells.get(cellKey(m.objectiveId, m.level))!;
    c.items.push(it);
  });

  seen.forEach((n, qid) => {
    if (n > 1) errors.push(`Item ${byId.get(qid)?.label ?? "?"} is counted ${n} times. Each exam item may be mapped once.`);
  });

  const unaccounted = items.filter((i) => {
    const m = tos.mappings.find((x) => x.questionId === i.questionId);
    return !m || !m.objectiveId || !m.level || !tos.objectives.some((o) => o.id === m.objectiveId) || !levels.includes(m.level);
  });
  if (unaccounted.length)
    errors.push(`${unaccounted.length} exam item(s) are not accounted for (missing objective or cognitive level): ${unaccounted.map((i) => i.label).join(", ")}.`);

  cells.forEach((c) => {
    c.items.sort((a, b) => a.ordinal - b.ordinal);
    c.count = c.items.length;
    c.points = round2(c.items.reduce((a, i) => a + i.points, 0));
  });

  // Placement numbers (template definitions):
  //  Horizontal: numbers run across each objective row, level by level.
  //  Vertical:   numbers run down each level column, objective by objective.
  const horizontalKey: TosComputed["horizontalKey"] = [];
  const verticalKey: TosComputed["verticalKey"] = [];
  let n = 1;
  tos.objectives.forEach((o) =>
    levels.forEach((l) => {
      const c = cells.get(cellKey(o.id, l))!;
      c.horizontalNumbers = c.items.map((it) => {
        horizontalKey.push({ placement: n, item: it });
        return n++;
      });
    })
  );
  n = 1;
  levels.forEach((l) =>
    tos.objectives.forEach((o) => {
      const c = cells.get(cellKey(o.id, l))!;
      c.verticalNumbers = c.items.map((it) => {
        verticalKey.push({ placement: n, item: it });
        return n++;
      });
    })
  );

  const rowTotals: TosComputed["rowTotals"] = new Map();
  tos.objectives.forEach((o) => {
    const rowCells = levels.map((l) => cells.get(cellKey(o.id, l))!);
    const all = rowCells.flatMap((c) => c.items);
    rowTotals.set(o.id, {
      count: all.length,
      points: round2(all.reduce((a, i) => a + i.points, 0)),
      testTypes: [...new Set(all.map((i) => i.typeLabel))],
    });
  });

  const totalCount = [...cells.values()].reduce((a, c) => a + c.count, 0);
  const totalPoints = round2([...cells.values()].reduce((a, c) => a + c.points, 0));

  const colTotals: TosComputed["colTotals"] = new Map();
  levels.forEach((l) => {
    const colCells = tos.objectives.map((o) => cells.get(cellKey(o.id, l))!);
    const all = colCells.flatMap((c) => c.items);
    const pts = [...new Set(all.map((i) => i.points))].sort((a, b) => a - b);
    colTotals.set(l, {
      count: all.length,
      points: round2(all.reduce((a, i) => a + i.points, 0)),
      pointsPerItem: pts.length === 0 ? "" : pts.length === 1 ? String(pts[0]) : `${pts[0]}–${pts[pts.length - 1]}`,
      percent: totalCount ? (all.length / totalCount) * 100 : 0,
    });
  });

  const lower = levels.slice(0, lowerOrderCount);
  const higher = levels.slice(lowerOrderCount);
  const pct = (ls: string[]) => ls.reduce((a, l) => a + (colTotals.get(l)?.percent ?? 0), 0);
  const groupPercents = [
    { label: "Lower-order", levels: lower, percent: pct(lower) },
    { label: "Higher-order", levels: higher, percent: pct(higher) },
  ];

  const examTot = exam ? examTotals(exam) : { items: 0, points: 0 };
  if (exam) {
    if (totalCount !== examTot.items) errors.push(`TOS accounts for ${totalCount} item(s); the source exam has ${examTot.items}.`);
    if (Math.abs(totalPoints - examTot.points) > 0.001)
      errors.push(`TOS accounts for ${totalPoints} point(s); the source exam totals ${examTot.points}.`);
  }
  if (totalCount) {
    const displayed = levels.reduce((a, l) => a + round2(colTotals.get(l)!.percent), 0);
    if (Math.abs(displayed - 100) > 0.05) errors.push(`Percentage distribution totals ${round2(displayed)}% (must be 100% allowing for rounding).`);
  }
  if (!tos.objectives.length) errors.push("Add at least one test objective (row).");
  tos.objectives.forEach((o, i) => {
    if (!o.label.trim()) warnings.push(`Objective row ${i + 1} has no text.`);
    if ((rowTotals.get(o.id)?.count ?? 0) === 0) warnings.push(`Objective row ${i + 1} has no mapped items.`);
  });

  const needsReview = !!exam && exam.revision !== tos.sourceExamRevision;
  if (needsReview) warnings.push("The source exam changed after this TOS was generated. Review the mappings and use “Update from exam”.");

  return {
    levels,
    cells,
    rowTotals,
    colTotals,
    totalCount,
    totalPoints,
    groupPercents,
    horizontalKey,
    verticalKey,
    examItemCount: examTot.items,
    examPoints: examTot.points,
    errors: [...new Set(errors)],
    warnings,
    needsReview,
    period: EXAM_TERM_TO_TOS_PERIOD[tos.period] ?? "Prelim",
  };
}

export function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}
