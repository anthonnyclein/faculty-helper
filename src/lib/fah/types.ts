// Faculty Academic Helper — shared domain types.
// All records use stable string identifiers (see ids.ts). Dates are ISO strings.

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string;
  updatedAt: string;
  /** Demonstration records are visibly labeled and can be removed in one action. */
  isDemo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Institutional configuration (copied from the reference template)   */
/* ------------------------------------------------------------------ */

export interface PEO {
  code: string; // e.g. "PEO 1"
  description: string;
}

/** Template-prescribed Program Outcome (categories 1, 4 and 5). */
export interface InstitutionalPO {
  id: ID;
  description: string;
  peos: string[]; // PEO codes exactly as printed, e.g. ["PEO 1", "PEO 3"]
}

export interface TransmutationRow {
  id: ID;
  grade: string;
  range: string;
}

export interface InstitutionalConfig {
  universityName: string;
  vision: string;
  mission: string;
  goals: string[];
  coreValues: string[];
  peoIntro: string;
  peos: PEO[];
  poCategoryTitles: Record<POCategory, string>;
  /** Intro line printed under a category heading (template rows "A graduate of ... should be able to:"). */
  poCategoryIntros: Partial<Record<POCategory, string>>;
  category1: InstitutionalPO[];
  category4: InstitutionalPO[];
  category5: InstitutionalPO[];
  /** Default class policy wording (items a–h) — the grading item is added separately. */
  defaultClassPolicies: string[];
  defaultRequirements: string[];
  defaultGrading: { component: string; weight: number }[];
  defaultPassingRate: string;
  defaultDimensionEvaluation: { level: string; prelim: number | null; midterm: number | null; finals: number | null }[];
  dimensionEvaluationSubtitle: string; // "Example"
  finalGradeStatement: string;
  criteriaForGrading: string[];
  transmutation: TransmutationRow[];
  circulatingMaterials: string;
  swdStatement: string;
  attendanceStatement: string;
  gadThemes: string[];
  scheduleNote: string;
  /** Learning Commitment Agreement. Tokens: {courseCode} {semester} {academicYear} */
  learningCommitmentAgreement: string;
  /** TOS template */
  tosCognitiveLevels: string[];
  tosLowerOrderCount: number; // first N levels grouped in the percentage row (template: 3 / 3)
}

/* ------------------------------------------------------------------ */
/* Program outcomes                                                    */
/* ------------------------------------------------------------------ */

/** 1 Common to all · 2 Common to the discipline · 3 Specific to IT · 4 Horizontal (CMO 46) · 5 University-defined */
export type POCategory = 1 | 2 | 3 | 4 | 5;

export type LibraryPOCategory = "discipline" | "it-specific";

export interface LibraryPO extends BaseRecord {
  code: string;
  description: string;
  category: LibraryPOCategory;
  status: "active" | "archived";
  /** PEO mapping printed in the reference template, if any (used as a reference hint only). */
  referencePeos?: string[];
  referenceNote?: string;
  /** Incremented every time the description changes. Syllabi keep a snapshot + version. */
  version: number;
  fromTemplate?: boolean;
}

export type MappingSource = "template" | "ai" | "demo" | "manual";

export interface SyllabusPO {
  id: ID;
  category: POCategory;
  description: string;
  peos: string[];
  source: "template" | "library";
  libraryId?: ID;
  libraryVersion?: number;
  alignmentNote?: string;
  mappingSource?: MappingSource;
}

/* ------------------------------------------------------------------ */
/* Syllabus                                                            */
/* ------------------------------------------------------------------ */

export interface CLO {
  id: ID;
  code: string; // e.g. "CLO 1"
  statement: string;
  poIds: ID[]; // SyllabusPO ids
  alignmentNote?: string;
  mappingSource?: MappingSource;
}

export interface LearningPlanItem {
  id: ID;
  weekStart: number;
  weekEnd?: number | null;
  kind: "lesson" | "exam";
  examLabel?: string; // for kind === "exam"
  content: string; // Learning Content
  silos: string; // Specific Intended Learning Outcomes (one per line)
  cloIds: ID[];
  activities: string; // Teaching and Learning Activities (one per line)
  assessment: string; // one per line
  materials: string; // Instructional Material References
  origin?: "manual" | "ai" | "demo";
  sourceResourceIds?: ID[];
}

export interface ReferenceEntry {
  id: ID;
  resourceId?: ID;
  origin: "resource" | "manual";
  authors: string;
  year: string;
  title: string;
  edition?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  accessed?: string;
  /** When set, printed verbatim instead of the formatted citation. */
  manualText?: string;
}

export type CitationStyle = "APA 7" | "IEEE" | "MLA 9" | "Chicago";

export interface PolicyItem {
  id: ID;
  kind: "text" | "grading";
  text: string;
}

export interface GradingRow {
  id: ID;
  component: string;
  weight: number | null;
}

export interface DimensionRow {
  id: ID;
  level: string;
  prelim: number | null;
  midterm: number | null;
  finals: number | null;
}

export interface SignatoryRef {
  personId?: ID;
  name: string;
  title: string;
  dateSigned: string; // free text/ISO — may be blank
}

export interface Syllabus extends BaseRecord {
  collegeName: string;
  syllabusCode: string;
  courseCode: string;
  descriptiveTitle: string;
  prerequisite: string;
  corequisite: string;
  units: number | null;
  lectureHours: number | null;
  labHours: number | null;
  semester: string;
  academicYear: string;
  courseDescription: string;

  /** Snapshot of institutional statements at creation (refresh is an explicit action). */
  institutional: {
    vision: string;
    mission: string;
    goals: string[];
    coreValues: string[];
    peoIntro: string;
    peos: PEO[];
  };

  programOutcomes: SyllabusPO[];
  addressedPoIds: ID[];
  clos: CLO[];
  learningPlan: LearningPlanItem[];
  references: ReferenceEntry[];
  citationStyle: CitationStyle;

  requirements: PolicyItem[];
  classPolicies: PolicyItem[]; // contains exactly one kind === "grading"
  grading: { rows: GradingRow[]; passingRate: string };
  dimensionEvaluation: DimensionRow[];
  policySections: {
    circulatingMaterials: string;
    swdStatement: string;
    attendanceStatement: string;
    gadThemes: string[];
  };

  preparedBy: SignatoryRef[];
  reviewedBy: SignatoryRef;
  approvedBy: SignatoryRef;
  revision: { number: string; dateRevised: string; effectivity: string };

  resourceIds: ID[];
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export type ResourceType = "pdf" | "docx" | "text" | "url" | "book";

export type ResourceStatus =
  | "processing"
  | "extracted" // readable content available
  | "metadata-only" // bibliographic record only
  | "needs-ocr" // scanned file, no text layer
  | "failed"
  | "inaccessible";

export interface Resource extends BaseRecord {
  title: string;
  type: ResourceType;
  purpose: "instructional" | "exam-template" | "institutional-template";
  authors: string;
  year: string;
  publisher: string;
  edition: string;
  doi: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  status: ResourceStatus;
  statusMessage?: string;
  content: string;
  wordCount: number;
  pageCount?: number;
  linkedSyllabusIds: ID[];
  linkedExamIds: ID[];
  notes: string;
}

/* ------------------------------------------------------------------ */
/* People / signatories                                                */
/* ------------------------------------------------------------------ */

export type PersonRole = "faculty" | "chair" | "dean";

export interface Person extends BaseRecord {
  name: string;
  roles: PersonRole[];
  department: string;
}

/* ------------------------------------------------------------------ */
/* Exams                                                               */
/* ------------------------------------------------------------------ */

export type ExamTerm = "First Prelim" | "Second Prelim" | "Finals";

export type QuestionType =
  | "multiple-choice"
  | "identification"
  | "essay"
  | "analysis"
  | "drawing"
  | "programming"
  | "custom";

export interface Choice {
  id: ID;
  text: string;
}

export interface SubItem {
  id: ID;
  prompt: string;
}

export interface Question {
  id: ID;
  prompt: string;
  choices?: Choice[];
  correctChoiceId?: ID;
  answerKey?: string; // teacher-only
  rubric?: string; // teacher-only
  code?: string; // student-facing code snippet
  codeLanguage?: string;
  imageDataUrl?: string;
  answerLines?: number; // blank lines / answer space
  /** null → section default points */
  points: number | null;
  /** Sub-items (a, b, c…) are part of their parent: the parent counts as ONE item. */
  subItems?: SubItem[];
  topic?: string;
  cloId?: ID;
  cognitiveLevel?: string;
  flags?: string[]; // import uncertainty flags needing review
  origin?: "manual" | "ai" | "demo" | "import";
  sourceResourceIds?: ID[];
}

export interface ExamSection {
  id: ID;
  title: string;
  instructions: string;
  type: QuestionType;
  customTypeLabel?: string;
  plannedItems: number | null;
  defaultPoints: number | null;
  questions: Question[];
}

export interface Exam extends BaseRecord {
  courseCode: string;
  courseTitle: string;
  semester: string;
  academicYear: string;
  term: ExamTerm;
  title: string;
  instructions: string;
  coverage: string;
  aiInstructions: string;
  syllabusId?: ID;
  resourceIds: ID[];
  templateResourceId?: ID;
  sections: ExamSection[];
  source: "manual" | "ai" | "import";
  /** "continuous" numbers 1..N across sections; "per-section" restarts at 1 (labels like II.3). */
  numbering: "continuous" | "per-section";
  /** Incremented on every saved content change; TOS compares against it. */
  revision: number;
}

/* ------------------------------------------------------------------ */
/* Table of Specifications                                            */
/* ------------------------------------------------------------------ */

export interface TosObjective {
  id: ID;
  label: string; // printed text, e.g. "1. Apply the principles of…"
  cloId?: ID;
  topic?: string;
  /** Optional user-entered weight (e.g. hours or %) — never inferred. */
  weight?: number | null;
}

export interface TosMapping {
  questionId: ID;
  sectionId: ID;
  objectiveId: ID | null;
  level: string | null;
  rationale?: string;
  mappingSource?: MappingSource;
}

export interface TosSignature {
  name: string;
  date: string;
}

export interface Tos extends BaseRecord {
  examId: ID;
  syllabusId?: ID;
  title: string;
  tosCode: string;
  college: string;
  department: string;
  subjectCode: string;
  descriptiveTitle: string;
  period: ExamTerm;
  semester: string;
  academicYear: string;
  levels: string[];
  objectives: TosObjective[];
  mappings: TosMapping[];
  /** "placement": template sequential placement numbers; "exam": actual exam item labels. */
  numbering: "placement" | "exam";
  sourceExamRevision: number;
  preparedBy: TosSignature;
  reviewedBy: TosSignature;
  approvedBy: TosSignature;
}

/* ------------------------------------------------------------------ */
/* Settings / session                                                  */
/* ------------------------------------------------------------------ */

export type SyllabusPaper = "custom-13x11" | "legal-14x8.5";

export interface AppSettings {
  syllabusPaper: SyllabusPaper;
  /** The user explicitly confirmed which paper size to use (template is 14×8.5, request is 13×11). */
  paperDiscrepancyResolved: boolean;
  examWeeks: { prelim1: number; prelim2: number; final: number };
  examWeekLabels: { prelim1: string; prelim2: string; final: string };
  showCloColumn: boolean;
  showMaterialsColumn: boolean;
  showHoursInUnits: boolean;
  defaultCitationStyle: CitationStyle;
  aiMode: "auto" | "demo";
  autosave: boolean;
  defaultSignatories: { facultyIds: ID[]; chairId?: ID; deanId?: ID };
  defaultCollege: string;
  defaultDepartment: string;
  institutionalUnlocked: boolean;
}

export interface AppData {
  version: 1;
  institutional: InstitutionalConfig;
  settings: AppSettings;
  syllabi: Syllabus[];
  libraryPOs: LibraryPO[];
  resources: Resource[];
  people: Person[];
  exams: Exam[];
  tos: Tos[];
}

export type CollectionKey = "syllabi" | "libraryPOs" | "resources" | "people" | "exams" | "tos";

export interface AppSession {
  mode: "demo" | "google";
  name: string;
  email?: string;
  image?: string | null;
}
