// Syllabus validation grouped by editor section. Used by the editor step list and the preview.
import { dimensionIssues, gradingIssues } from "./calc";
import { missingReferenceFields } from "./citations";
import type { AppData, Syllabus } from "./types";

export type SyllabusSectionKey =
  | "course"
  | "institutional"
  | "outcomes"
  | "clos"
  | "plan"
  | "references"
  | "policies"
  | "signatories"
  | "agreement";

export function syllabusIssues(s: Syllabus, data: AppData): Record<SyllabusSectionKey, string[]> {
  const r: Record<SyllabusSectionKey, string[]> = {
    course: [],
    institutional: [],
    outcomes: [],
    clos: [],
    plan: [],
    references: [],
    policies: [],
    signatories: [],
    agreement: [],
  };

  const req: [keyof Syllabus, string][] = [
    ["collegeName", "College Name"],
    ["syllabusCode", "Syllabus Code"],
    ["courseCode", "Course Code"],
    ["descriptiveTitle", "Descriptive Title"],
    ["semester", "Semester"],
    ["academicYear", "Academic Year"],
    ["courseDescription", "Course Description"],
  ];
  req.forEach(([k, label]) => {
    if (!String(s[k] ?? "").trim()) r.course.push(`${label} is required.`);
  });
  if (s.units === null || s.units === undefined) r.course.push("Number of Units is required.");
  else if (s.units <= 0) r.course.push("Number of Units must be greater than 0.");
  if (s.lectureHours !== null && s.lectureHours < 0) r.course.push("Lecture hours cannot be negative.");
  if (s.labHours !== null && s.labHours < 0) r.course.push("Laboratory hours cannot be negative.");
  if (s.academicYear && !/^\d{4}\s*[-–]\s*\d{4}$/.test(s.academicYear.trim())) r.course.push("Academic Year should look like 2025-2026.");

  if (!s.institutional.vision.trim() || !s.institutional.mission.trim()) r.institutional.push("Vision and Mission must come from the institutional template.");

  const cat = (c: number) => s.programOutcomes.filter((p) => p.category === c);
  if (!cat(2).length) r.outcomes.push("Select at least one outcome Common to the Discipline.");
  if (!cat(3).length) r.outcomes.push("Select at least one outcome Specific to the IT Program.");
  s.programOutcomes.forEach((p) => {
    if ((p.category === 2 || p.category === 3) && !p.peos.length) r.outcomes.push(`“${p.description.slice(0, 50)}…” has no PEO mapping.`);
  });
  if (!s.addressedPoIds.length) r.outcomes.push("Select the Program Outcomes addressed by this course.");
  const poIds = new Set(s.programOutcomes.map((p) => p.id));
  if (s.addressedPoIds.some((id) => !poIds.has(id))) r.outcomes.push("An addressed PO no longer exists in this syllabus.");
  s.programOutcomes.forEach((p) => {
    if (p.libraryId) {
      const lib = data.libraryPOs.find((l) => l.id === p.libraryId);
      if (lib && lib.version !== p.libraryVersion) r.outcomes.push(`Library outcome ${lib.code} was revised after it was added. Review and update explicitly if needed.`);
    }
  });

  if (!s.clos.length) r.clos.push("Add at least one Course Learning Outcome.");
  s.clos.forEach((c, i) => {
    if (!c.statement.trim()) r.clos.push(`CLO ${i + 1}: statement is required.`);
    if (!c.poIds.length) r.clos.push(`CLO ${i + 1}: select at least one corresponding PO.`);
    if (c.poIds.some((id) => !poIds.has(id))) r.clos.push(`CLO ${i + 1}: refers to a PO that was removed.`);
    else if (c.poIds.some((id) => !s.addressedPoIds.includes(id))) r.clos.push(`CLO ${i + 1}: maps to a PO not marked as addressed by the course.`);
  });

  const cloIds = new Set(s.clos.map((c) => c.id));
  const lessons = s.learningPlan.filter((l) => l.kind === "lesson");
  if (!lessons.length) r.plan.push("Add learning-plan items (manually or with AI).");
  lessons.forEach((l) => {
    if (l.weekStart < 1 || l.weekStart > 18 || (l.weekEnd && (l.weekEnd < l.weekStart || l.weekEnd > 18)))
      r.plan.push(`A learning-plan item has an invalid week (${l.weekStart}${l.weekEnd ? `-${l.weekEnd}` : ""}).`);
    if (!l.content.trim()) r.plan.push(`Week ${l.weekStart}: Learning Content is empty.`);
    if (l.cloIds.some((id) => !cloIds.has(id))) r.plan.push(`Week ${l.weekStart}: refers to a CLO that was removed.`);
    const exam = s.learningPlan.find((e) => e.kind === "exam" && e.weekStart >= l.weekStart && e.weekStart <= (l.weekEnd || l.weekStart));
    if (exam) r.plan.push(`Week ${exam.weekStart} is reserved for ${exam.examLabel || "an examination"} but also has a lesson.`);
  });
  const covered = new Set<number>();
  s.learningPlan.forEach((l) => {
    for (let w = l.weekStart; w <= (l.weekEnd || l.weekStart); w++) covered.add(w);
  });
  const missing = Array.from({ length: 18 }, (_, i) => i + 1).filter((w) => !covered.has(w));
  if (lessons.length && missing.length) r.plan.push(`No plan entries for week(s): ${missing.join(", ")}.`);

  s.references.forEach((ref, i) => {
    const m = missingReferenceFields(ref);
    if (m.length) r.references.push(`Reference ${i + 1} is missing: ${m.join(", ")}.`);
  });
  if (!s.references.length) r.references.push("Add at least one reference.");

  r.policies.push(...gradingIssues(s.grading.rows), ...dimensionIssues(s.dimensionEvaluation));
  if (s.classPolicies.filter((p) => p.kind === "grading").length !== 1) r.policies.push("Class Policies must contain exactly one Grading System item.");

  if (!s.preparedBy.some((p) => p.name.trim())) r.signatories.push("Prepared by: select at least one faculty member.");
  if (!s.reviewedBy.name.trim()) r.signatories.push("Reviewed by: select the Department Chairperson.");
  if (!s.approvedBy.name.trim()) r.signatories.push("Approved by: select the Dean.");

  if (!s.courseCode.trim() || !s.semester.trim() || !s.academicYear.trim())
    r.agreement.push("The agreement needs the course code, semester and academic year.");

  return r;
}
