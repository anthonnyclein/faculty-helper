// Deterministic demonstration generators (no AI model) for the Course Learning Plan, plus
// validators that coerce live AI output into the documented shapes. Demo output is clearly generic:
// topics come from source headings when available, otherwise from the CLO statements.
// Never invents citations — "materials" only ever holds titles of the resources provided.

export interface PlanCourseInput {
  code: string;
  title: string;
  description: string;
  units: number | null;
  lectureHours: number | null;
  labHours: number | null;
}

export interface PlanCloInput {
  id: string;
  code: string;
  statement: string;
}

export interface PlanSourceInput {
  id: string;
  title: string;
  text: string;
}

export interface PlanGenInput {
  course: PlanCourseInput;
  clos: PlanCloInput[];
  examWeeks: { week: number; label: string }[];
  sources: PlanSourceInput[];
  instructions: string;
}

export interface PlanRowSummary {
  id: string;
  weekStart: number;
  weekEnd: number | null;
  content: string;
  silos: string;
}

export interface PlanRegenInput extends PlanGenInput {
  rowsToRegenerate: PlanRowSummary[];
  keepRows: { weekStart: number; weekEnd: number | null; content: string }[];
}

export interface PlanProposalItem {
  rowId?: string;
  weekStart: number;
  weekEnd: number | null;
  content: string;
  silos: string[];
  cloCodes: string[];
  activities: string[];
  assessment: string[];
  materials: string;
  sourceIds: string[];
}

export interface PlanGenResult {
  items: PlanProposalItem[];
  coverageWarnings: string[];
}

export interface SiloSupportInput {
  silos: string;
  content: string;
  clos: PlanCloInput[];
  courseTitle: string;
}

export interface SiloSupportResult {
  cloIds: string[];
  activities: string[];
  assessment: string[];
  explanation: string;
}

/* ------------------------------------------------------------------ */
/* Validators (live output → safe shapes)                             */
/* ------------------------------------------------------------------ */

const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x).trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(/\r?\n/)
      .map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
  return [];
}

function weekNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseInt(str(v), 10);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function toItem(raw: unknown): PlanProposalItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ws = weekNum(r.weekStart ?? r.week);
  if (ws === null) return null;
  const weRaw = weekNum(r.weekEnd);
  const weekStart = Math.min(18, Math.max(1, ws));
  const weekEnd = weRaw !== null && weRaw > weekStart ? Math.min(18, weRaw) : null;
  return {
    rowId: r.rowId ? str(r.rowId) : undefined,
    weekStart,
    weekEnd,
    content: str(r.content).trim(),
    silos: strList(r.silos),
    cloCodes: strList(r.cloCodes),
    activities: strList(r.activities),
    assessment: strList(r.assessment),
    materials: str(r.materials).trim(),
    sourceIds: strList(r.sourceIds),
  };
}

export function validatePlanResult(v: unknown): PlanGenResult {
  const o = (Array.isArray(v) ? { items: v } : v) as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.items)) throw new Error("Missing items array");
  const items = o.items.map(toItem).filter((x): x is PlanProposalItem => !!x);
  if (!items.length) throw new Error("No usable plan items");
  return { items, coverageWarnings: strList(o.coverageWarnings) };
}

export function validateSiloSupport(v: unknown): SiloSupportResult {
  if (!v || typeof v !== "object") throw new Error("Expected an object");
  const o = v as Record<string, unknown>;
  return {
    cloIds: strList(o.cloIds),
    activities: strList(o.activities),
    assessment: strList(o.assessment),
    explanation: str(o.explanation).trim(),
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  "a an and are as at be by for from in into is it its of on or that the their this to with using use able students student will should can learners learner course demonstrate".split(
    " "
  )
);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/(ing|ed|es|s)$/, ""));
}

/** Normalizes CLO codes for matching: "clo1", "CLO 1", "1" → "CLO1". */
export function normCloCode(s: string): string {
  const t = s.replace(/\s+/g, "").toUpperCase();
  return /^\d+$/.test(t) ? `CLO${t}` : t;
}

/** Lines of source text that look like headings (Chapter N / Unit N / short Title Case lines). */
export function extractHeadings(text: string, max = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.replace(/^[#\s]+/, "").replace(/\s+/g, " ").trim();
    if (line.length < 4 || line.length > 80) continue;
    if (/[.;,:]$/.test(line) && !/^(chapter|unit|module|lesson|part|topic)\b/i.test(line)) continue;
    const chapter = /^(chapter|unit|module|lesson|part|topic)\s+[\divxlc]+\b/i.test(line);
    const numbered = /^\d+(\.\d+)?\s+[A-Z]/.test(line);
    const words = line.split(" ");
    const caps = words.filter((w) => /^[A-Z0-9]/.test(w)).length;
    const titleCase = words.length >= 2 && words.length <= 10 && caps / words.length >= 0.6 && !/[.!?]$/.test(line);
    if (!(chapter || numbered || titleCase)) continue;
    const cleanLine = line.replace(/^(chapter|unit|module|lesson|part|topic)\s+[\divxlc]+\s*[:.\-–—]?\s*/i, "").replace(/^\d+(\.\d+)?\s+/, "").trim() || line;
    const key = cleanLine.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleanLine);
    if (out.length >= max) break;
  }
  return out;
}

/** "Design and implement a relational database…" → "design and implement a relational database" (short phrase). */
function cloPhrase(statement: string): string {
  const s = statement.trim().replace(/[.;]+$/, "");
  const words = s.split(/\s+/).slice(0, 9).join(" ");
  return words.charAt(0).toLowerCase() + words.slice(1);
}

function topicFromClo(statement: string): string {
  const s = statement.trim().replace(/[.;]+$/, "").split(/\s+/);
  const body = s.slice(1, 8).join(" ");
  return body ? body.charAt(0).toUpperCase() + body.slice(1) : "Course topic";
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* ------------------------------------------------------------------ */
/* Demo: full plan                                                     */
/* ------------------------------------------------------------------ */

export function demoLearningPlan(input: PlanGenInput): PlanGenResult {
  const examWeeks = new Set(input.examWeeks.map((e) => e.week));
  const lessonWeeks = Array.from({ length: 18 }, (_, i) => i + 1).filter((w) => !examWeeks.has(w));
  const hasLab = (input.course.labHours ?? 0) > 0;
  const warnings: string[] = [];

  // Topics: source headings first (keeping source attribution), then CLO-derived topics.
  const topics: { title: string; sourceId?: string; sourceTitle?: string }[] = [];
  input.sources.forEach((s) => extractHeadings(s.text).forEach((h) => topics.push({ title: h, sourceId: s.id, sourceTitle: s.title })));
  if (!topics.length) {
    input.clos.forEach((c) => topics.push({ title: topicFromClo(c.statement) }));
    warnings.push(
      input.sources.length
        ? "No chapter or section headings were found in the selected sources; topics were derived from the CLO statements and are generic placeholders."
        : "No readable sources were used; topics were derived from the CLO statements and are generic placeholders. Replace them with the actual course topics."
    );
  }
  if (!topics.length) topics.push({ title: input.course.title || "Course topic" });

  const items: PlanProposalItem[] = [];
  const first = lessonWeeks[0] ?? 1;
  items.push({
    weekStart: first,
    weekEnd: null,
    content: "Course Orientation; VMGO of MSU-Naawan",
    silos: [
      "Recite the vision, mission, goals, and core values of MSU-Naawan.",
      `Explain the scope, requirements, and class policies of ${input.course.code || "the course"}.`,
    ],
    cloCodes: [],
    activities: ["Lecture. The instructor will discuss the vision, mission, goals and core values of MSU-Naawan.", "Syllabus walkthrough and class policy discussion"],
    assessment: ["Oral recitation on the VMGO of MSU-Naawan"],
    materials: "",
    sourceIds: [],
  });

  const rest = lessonWeeks.slice(1);
  const clos = input.clos;
  // One entry per remaining lesson week; consecutive weeks sharing a topic merge into a range (never across an exam).
  const perWeek = rest.map((w, i) => {
    const tStart = Math.floor((i * topics.length) / Math.max(1, rest.length));
    const tEnd = Math.max(tStart, Math.floor(((i + 1) * topics.length) / Math.max(1, rest.length)) - 1);
    const group = topics.slice(tStart, tEnd + 1);
    const clo = clos.length ? clos[Math.min(clos.length - 1, Math.floor((i * clos.length) / Math.max(1, rest.length)))] : undefined;
    return { week: w, group, clo, key: `${tStart}-${tEnd}` };
  });

  for (let i = 0; i < perWeek.length; i++) {
    const cur = perWeek[i];
    let end = cur.week;
    while (i + 1 < perWeek.length && perWeek[i + 1].key === cur.key && perWeek[i + 1].week === end + 1) {
      end = perWeek[i + 1].week;
      i++;
    }
    const titles = cur.group.map((g) => g.title);
    const content = titles.join("; ");
    const main = titles[0] ?? "Course topic";
    const beforeExam = examWeeks.has(end + 1);
    const silos = [`Explain the key concepts of ${main.toLowerCase()}.`];
    if (cur.clo) silos.push(`${cap(cloPhrase(cur.clo.statement))} in the context of ${main.toLowerCase()}.`);
    else silos.push(`Apply ${main.toLowerCase()} to a guided exercise.`);
    const activities = ["Lecture-discussion", hasLab ? "Hands-on laboratory activity" : "Guided practice exercise", "Small-group discussion"];
    if (beforeExam) activities.push("Review session for the upcoming examination");
    const assessment = [hasLab ? "Laboratory exercise (rubric-based)" : "Written exercise", "Short quiz"];
    const srcIds = Array.from(new Set(cur.group.map((g) => g.sourceId).filter((x): x is string => !!x)));
    const srcTitles = Array.from(new Set(cur.group.map((g) => g.sourceTitle).filter((x): x is string => !!x)));
    items.push({
      weekStart: cur.week,
      weekEnd: end > cur.week ? end : null,
      content,
      silos,
      cloCodes: cur.clo ? [cur.clo.code] : [],
      activities,
      assessment,
      materials: srcTitles.join("; "),
      sourceIds: srcIds,
    });
  }

  const usedClos = new Set(items.flatMap((i) => i.cloCodes));
  const unused = clos.filter((c) => !usedClos.has(c.code));
  if (unused.length) warnings.push(`Not enough weeks to address every CLO: ${unused.map((c) => c.code).join(", ")}. Add them to suitable rows.`);
  if (input.instructions.trim()) warnings.push("Demonstration output does not interpret additional instructions; apply them manually.");
  console.log("[ai-demo] learning plan", { items: items.length, topics: topics.length });
  return { items, coverageWarnings: warnings };
}

/* ------------------------------------------------------------------ */
/* Demo: regenerate rows                                               */
/* ------------------------------------------------------------------ */

export function demoRegenerateRows(input: PlanRegenInput): PlanGenResult {
  const full = demoLearningPlan(input);
  const items = input.rowsToRegenerate.map<PlanProposalItem>((row) => {
    const match = full.items.find((i) => i.weekStart <= row.weekStart && (i.weekEnd ?? i.weekStart) >= row.weekStart);
    const content = row.content.trim() || match?.content || "Course topic";
    const support = demoSiloSupport({ silos: row.silos || content, content, clos: input.clos, courseTitle: input.course.title });
    const clo = input.clos.find((c) => support.cloIds.includes(c.id));
    const main = content.split(";")[0].trim();
    return {
      rowId: row.id,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      content,
      silos: [
        `Describe the fundamental ideas of ${main.toLowerCase()}.`,
        clo ? `${cap(cloPhrase(clo.statement))} using ${main.toLowerCase()}.` : `Apply ${main.toLowerCase()} to a practical task.`,
      ],
      cloCodes: clo ? [clo.code] : match?.cloCodes ?? [],
      activities: support.activities,
      assessment: support.assessment,
      materials: match?.materials ?? "",
      sourceIds: match?.sourceIds ?? [],
    };
  });
  return { items, coverageWarnings: full.coverageWarnings.filter((w) => !w.startsWith("Not enough weeks")) };
}

/* ------------------------------------------------------------------ */
/* Demo: SILO support                                                  */
/* ------------------------------------------------------------------ */

const VERB_GROUPS: { re: RegExp; activities: string[]; assessment: string[] }[] = [
  {
    re: /\b(recite|recall|identify|define|list|name|state|describe|explain|discuss|summari[sz]e|classify|interpret)\b/i,
    activities: ["Lecture-discussion", "Guided reading with concept mapping"],
    assessment: ["Short quiz", "Oral recitation"],
  },
  {
    re: /\b(apply|implement|develop|build|write|code|program|construct|use|demonstrate|solve|configure|deploy)\b/i,
    activities: ["Hands-on laboratory activity", "Worked-example demonstration followed by guided practice"],
    assessment: ["Laboratory exercise (rubric-based)", "Practical output checklist"],
  },
  {
    re: /\b(analy[sz]e|compare|contrast|differentiate|examine|test|debug|investigate)\b/i,
    activities: ["Case analysis in small groups", "Problem-solving workshop"],
    assessment: ["Case analysis report", "Problem set"],
  },
  {
    re: /\b(evaluate|assess|critique|justify|judge|defend|review)\b/i,
    activities: ["Peer review session", "Panel-style critique"],
    assessment: ["Evaluation rubric", "Reflection paper"],
  },
  {
    re: /\b(design|create|plan|propose|compose|formulate|produce|present)\b/i,
    activities: ["Project work with consultation", "Design studio / group consultation"],
    assessment: ["Project output (rubric-based)", "Presentation"],
  },
];

export function demoSiloSupport(input: SiloSupportInput): SiloSupportResult {
  const text = `${input.silos}\n${input.content}`;
  const t = new Set(tokens(text));
  const scored = input.clos
    .map((c) => ({ c, score: tokens(c.statement).filter((x) => t.has(x)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const cloIds = scored.slice(0, 2).map((x) => x.c.id);
  const activities: string[] = [];
  const assessment: string[] = [];
  VERB_GROUPS.forEach((g) => {
    if (g.re.test(text)) {
      g.activities.forEach((a) => !activities.includes(a) && activities.push(a));
      g.assessment.forEach((a) => !assessment.includes(a) && assessment.push(a));
    }
  });
  if (!activities.length) activities.push("Lecture-discussion", "Guided practice exercise");
  if (!assessment.length) assessment.push("Short quiz");
  const codes = scored.slice(0, 2).map((x) => x.c.code);
  return {
    cloIds,
    activities: activities.slice(0, 4),
    assessment: assessment.slice(0, 3),
    explanation: codes.length
      ? `Matched ${codes.join(" and ")} by shared key terms; activities and assessment follow the action verbs used in the SILOs.`
      : "No CLO shares key terms with these SILOs — select the corresponding CLOs manually. Activities follow the SILO action verbs.",
  };
}
