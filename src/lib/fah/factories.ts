import { DEFAULT_INSTITUTIONAL } from "./template";
import { deepClone, nowIso, uid } from "./ids";
import type {
  AppData,
  AppSettings,
  Exam,
  ExamSection,
  InstitutionalConfig,
  Question,
  QuestionType,
  Syllabus,
  SyllabusPO,
  Tos,
} from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  syllabusPaper: "custom-13x11",
  paperDiscrepancyResolved: false,
  examWeeks: { prelim1: 7, prelim2: 14, final: 18 },
  examWeekLabels: {
    prelim1: "FIRST PRELIM EXAMINATIONS",
    prelim2: "SECOND PRELIM EXAMINATIONS",
    final: "FINAL EXAMINATIONS",
  },
  showCloColumn: true,
  showMaterialsColumn: true,
  showHoursInUnits: false,
  defaultCitationStyle: "APA 7",
  aiMode: "auto",
  autosave: true,
  defaultSignatories: { facultyIds: [] },
  defaultCollege: "College of Business and Information Technology",
  defaultDepartment: "Department of Information Technology",
  institutionalUnlocked: false,
};

export function emptyAppData(): AppData {
  return {
    version: 1,
    institutional: deepClone(DEFAULT_INSTITUTIONAL),
    settings: deepClone(DEFAULT_SETTINGS),
    syllabi: [],
    libraryPOs: [],
    resources: [],
    people: [],
    exams: [],
    tos: [],
  };
}

/** Template-prescribed POs (categories 1, 4, 5) copied into a syllabus with their PEO mappings. */
export function templatePOs(inst: InstitutionalConfig): SyllabusPO[] {
  const mk = (cat: 1 | 4 | 5, list: InstitutionalConfig["category1"]) =>
    list.map<SyllabusPO>((p) => ({
      id: uid("spo"),
      category: cat,
      description: p.description,
      peos: [...p.peos],
      source: "template",
      mappingSource: "template",
    }));
  return [...mk(1, inst.category1), ...mk(4, inst.category4), ...mk(5, inst.category5)];
}

export function examWeekItems(settings: AppSettings) {
  const w = settings.examWeeks;
  const l = settings.examWeekLabels;
  return [
    { week: w.prelim1, label: l.prelim1 },
    { week: w.prelim2, label: l.prelim2 },
    { week: w.final, label: l.final },
  ];
}

export function newSyllabus(data: AppData): Syllabus {
  const inst = data.institutional;
  const s = data.settings;
  const people = data.people;
  const personRef = (id?: string, title = "") => {
    const p = id ? people.find((x) => x.id === id) : undefined;
    return { personId: p?.id, name: p?.name ?? "", title, dateSigned: "" };
  };
  const t = nowIso();
  const gradingId = uid("pol");
  return {
    id: uid("syl"),
    createdAt: t,
    updatedAt: t,
    collegeName: s.defaultCollege,
    syllabusCode: "",
    courseCode: "",
    descriptiveTitle: "",
    prerequisite: "",
    corequisite: "",
    units: null,
    lectureHours: null,
    labHours: null,
    semester: "",
    academicYear: "",
    courseDescription: "",
    institutional: {
      vision: inst.vision,
      mission: inst.mission,
      goals: [...inst.goals],
      coreValues: [...inst.coreValues],
      peoIntro: inst.peoIntro,
      peos: deepClone(inst.peos),
    },
    programOutcomes: templatePOs(inst),
    addressedPoIds: [],
    clos: [],
    learningPlan: examWeekItems(s).map((e) => ({
      id: uid("lp"),
      weekStart: e.week,
      weekEnd: null,
      kind: "exam" as const,
      examLabel: e.label,
      content: "",
      silos: "",
      cloIds: [],
      activities: "",
      assessment: "",
      materials: "",
      origin: "manual" as const,
    })),
    references: [],
    citationStyle: s.defaultCitationStyle,
    requirements: inst.defaultRequirements.map((text) => ({ id: uid("req"), kind: "text" as const, text })),
    classPolicies: [
      ...inst.defaultClassPolicies.map((text) => ({ id: uid("pol"), kind: "text" as const, text })),
      { id: gradingId, kind: "grading" as const, text: "Grading System:" },
    ],
    grading: {
      rows: inst.defaultGrading.map((g) => ({ id: uid("gr"), component: g.component, weight: g.weight })),
      passingRate: inst.defaultPassingRate,
    },
    dimensionEvaluation: inst.defaultDimensionEvaluation.map((d) => ({ id: uid("dim"), ...d })),
    policySections: {
      circulatingMaterials: inst.circulatingMaterials,
      swdStatement: inst.swdStatement,
      attendanceStatement: inst.attendanceStatement,
      gadThemes: [...inst.gadThemes],
    },
    preparedBy: (s.defaultSignatories.facultyIds.length ? s.defaultSignatories.facultyIds : [undefined]).map((id) =>
      personRef(id, "Faculty")
    ),
    reviewedBy: personRef(s.defaultSignatories.chairId, "Department Chairperson"),
    approvedBy: personRef(s.defaultSignatories.deanId, "Dean"),
    revision: { number: "", dateRevised: "", effectivity: "" },
    resourceIds: [],
  };
}

/** Duplicate keeps every field (including revision information) but gets fresh stable ids. */
export function duplicateSyllabus(src: Syllabus): Syllabus {
  const copy = deepClone(src);
  const t = nowIso();
  const poMap = new Map<string, string>();
  const cloMap = new Map<string, string>();
  copy.id = uid("syl");
  copy.createdAt = t;
  copy.updatedAt = t;
  copy.isDemo = false;
  copy.descriptiveTitle = copy.descriptiveTitle ? `${copy.descriptiveTitle} (Copy)` : "Untitled (Copy)";
  copy.programOutcomes.forEach((p) => {
    const n = uid("spo");
    poMap.set(p.id, n);
    p.id = n;
  });
  copy.addressedPoIds = copy.addressedPoIds.map((id) => poMap.get(id) ?? id);
  copy.clos.forEach((c) => {
    const n = uid("clo");
    cloMap.set(c.id, n);
    c.id = n;
    c.poIds = c.poIds.map((id) => poMap.get(id) ?? id);
  });
  copy.learningPlan.forEach((l) => {
    l.id = uid("lp");
    l.cloIds = l.cloIds.map((id) => cloMap.get(id) ?? id);
  });
  copy.references.forEach((r) => (r.id = uid("ref")));
  copy.requirements.forEach((r) => (r.id = uid("req")));
  copy.classPolicies.forEach((r) => (r.id = uid("pol")));
  copy.grading.rows.forEach((r) => (r.id = uid("gr")));
  copy.dimensionEvaluation.forEach((r) => (r.id = uid("dim")));
  return copy;
}

export function newQuestion(type: QuestionType): Question {
  const q: Question = { id: uid("q"), prompt: "", points: null, origin: "manual" };
  if (type === "multiple-choice") {
    q.choices = ["A", "B", "C", "D"].map(() => ({ id: uid("ch"), text: "" }));
  }
  if (type === "essay" || type === "analysis" || type === "drawing") q.answerLines = 6;
  if (type === "programming") {
    q.codeLanguage = "python";
    q.answerLines = 12;
  }
  return q;
}

export function newSection(type: QuestionType = "multiple-choice", title = "Test I"): ExamSection {
  return {
    id: uid("sec"),
    title,
    instructions: "",
    type,
    plannedItems: null,
    defaultPoints: 1,
    questions: [],
  };
}

export function newExam(): Exam {
  const t = nowIso();
  return {
    id: uid("exam"),
    createdAt: t,
    updatedAt: t,
    courseCode: "",
    courseTitle: "",
    semester: "",
    academicYear: "",
    term: "First Prelim",
    title: "",
    instructions: "",
    coverage: "",
    aiInstructions: "",
    resourceIds: [],
    sections: [newSection()],
    source: "manual",
    numbering: "continuous",
    revision: 1,
  };
}

export function blankTos(exam: Exam, data: AppData): Tos {
  const t = nowIso();
  const syl = exam.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  return {
    id: uid("tos"),
    createdAt: t,
    updatedAt: t,
    examId: exam.id,
    syllabusId: exam.syllabusId,
    title: `TOS — ${exam.title || exam.courseCode || "Exam"}`,
    tosCode: "",
    college: syl?.collegeName || data.settings.defaultCollege,
    department: data.settings.defaultDepartment,
    subjectCode: exam.courseCode,
    descriptiveTitle: exam.courseTitle,
    period: exam.term,
    semester: exam.semester,
    academicYear: exam.academicYear,
    levels: [...data.institutional.tosCognitiveLevels],
    objectives: [],
    mappings: [],
    numbering: "placement",
    sourceExamRevision: exam.revision,
    preparedBy: { name: "", date: "" },
    reviewedBy: { name: "", date: "" },
    approvedBy: { name: "", date: "" },
  };
}
