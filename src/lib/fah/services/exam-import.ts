// Exam import service (replaceable): file text extraction (browser), a rule-based exam parser used
// offline / in demonstration mode, and review flagging applied to BOTH parser and AI extraction output.
// Wording is never rewritten: prompts, choices and answers are copied exactly as found.

import { newQuestion, newSection } from "../factories";
import { uid } from "../ids";
import type { ExamSection, Question, QuestionType } from "../types";
import type { ExtractResult, ExtractedQuestion, ExtractedSection } from "../ai/demo/exam";

/* ------------------------------------------------------------------ */
/* File text extraction (browser only)                                 */
/* ------------------------------------------------------------------ */

export interface ExtractedFileText {
  text: string;
  fileName: string;
  kind: "text" | "docx" | "pdf";
  pageCount?: number;
  warnings: string[];
}

export const IMPORT_ACCEPT = ".txt,.md,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractTextFromFile(file: File): Promise<ExtractedFileText> {
  const name = file.name.toLowerCase();
  const warnings: string[] = [];
  console.log("[exam-import] extracting text", { name: file.name, size: file.size });
  if (file.size > 25 * 1024 * 1024) throw new Error("The file is larger than 25 MB. Split it or paste the text instead.");

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type === "text/plain") {
    const text = await file.text();
    return { text, fileName: file.name, kind: "text", warnings };
  }

  if (name.endsWith(".docx")) {
    const mod: any = await import("mammoth/mammoth.browser");
    const mammoth = mod.default ?? mod;
    const arrayBuffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer });
    const text: string = res?.value ?? "";
    if (res?.messages?.length) warnings.push(`${res.messages.length} formatting note(s) from the Word file were ignored.`);
    if (/\.(png|jpe?g|gif)/i.test(text) || !text.trim()) warnings.push("Images and drawings in the Word file are not imported — attach them to the questions manually.");
    if (!text.trim()) throw new Error("No text could be read from this Word file.");
    return { text: text.replace(/\n{3,}/g, "\n\n"), fileName: file.name, kind: "docx", warnings };
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      let out = "";
      let lastY: number | null = null;
      for (const it of tc.items as any[]) {
        if (typeof it.str !== "string") continue;
        const y = Array.isArray(it.transform) ? it.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) out += "\n";
        out += it.str;
        if (it.hasEOL) out += "\n";
        lastY = y;
      }
      pages.push(out.replace(/[ \t]+\n/g, "\n"));
    }
    const text = pages.join("\n\n");
    if (text.replace(/\s/g, "").length < 20)
      throw new Error("This PDF has no readable text layer (it is probably scanned). Run OCR first or paste the text instead.");
    warnings.push("PDF line breaks are reconstructed from the layout — check multi-line questions and choices.");
    return { text, fileName: file.name, kind: "pdf", pageCount: doc.numPages, warnings };
  }

  throw new Error("Unsupported file type. Upload a .txt, .docx or .pdf file, or paste the exam text.");
}

/* ------------------------------------------------------------------ */
/* Rule-based parser                                                   */
/* ------------------------------------------------------------------ */

const TYPE_KEYWORDS: [QuestionType, RegExp][] = [
  ["multiple-choice", /multiple[\s-]*choice|choose the (?:best|correct)|encircle|letter of the (?:best|correct)|shade the/i],
  ["identification", /identification|identify|fill in the blank|fill-in|supply the (?:missing|correct)/i],
  ["programming", /programming|write a (?:program|function|code)|coding|source code/i],
  ["drawing", /drawing|draw|design|diagram|sketch/i],
  ["analysis", /analysis|analy[sz]e|case study|problem solving/i],
  ["essay", /essay|discussion|discuss|explain|short answer|elaborate/i],
];

export function detectQuestionType(text: string): QuestionType | null {
  for (const [t, re] of TYPE_KEYWORDS) if (re.test(text)) return t;
  return null;
}

const SECTION_RE = /^\s*(?:TEST|PART|SECTION|EXAM)\s+([IVXLC]+|\d{1,2}|[A-H])\b\s*[.:)\-–—]?\s*(.*)$/i;
const ROMAN_HEADER_RE = /^\s*([IVX]{1,5})\s*[.)]\s+(.+)$/;
const ITEM_RE = /^\s*(\d{1,3})\s*[.)]\s*(.*)$/;
const CHOICE_RE = /^\s*\(?([a-hA-H])\s*[.)]\s+(.*)$/;
const INLINE_CHOICE_RE = /(?:^|\s{2,}|\t|\s)\(?([a-hA-H])[.)]\s+/g;
const ANSWER_RE = /^\s*(?:answer|ans|key|correct answer)\s*[:\-–]\s*(.+)$/i;
const POINTS_RE = /\(?\s*(\d+(?:\.\d+)?)\s*(?:pts?|points?|marks?)\.?\s*(?:each)?\s*\)?/i;
const STUDENT_LINE_RE = /^\s*(name|section|date|score|course\s*&?\s*year|student\s*no\.?|id\s*no\.?)\s*[:_]/i;

function extractPoints(s: string): number | null {
  const m = s.match(POINTS_RE);
  return m ? Number(m[1]) : null;
}

/** Splits "a. foo  b. bar  c. baz" into choices when a line holds several. */
function splitInlineChoices(line: string): string[] | null {
  const matches = [...line.matchAll(INLINE_CHOICE_RE)];
  if (matches.length < 2) return null;
  const letters = matches.map((m) => m[1].toLowerCase());
  // Must be consecutive letters starting at a.
  if (letters[0] !== "a" || letters.some((l, i) => l.charCodeAt(0) !== 97 + i)) return null;
  const out: string[] = [];
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? line.length : line.length;
    out.push(line.slice(start, end).trim());
  });
  return out;
}

function isHeaderText(rest: string) {
  const letters = rest.replace(/[^A-Za-z]/g, "");
  return (letters.length > 0 && letters === letters.toUpperCase()) || !!detectQuestionType(rest);
}

export function parseExamText(raw: string): ExtractResult {
  const text = (raw ?? "").replace(/\r/g, "");
  const lines = text.split("\n");
  const sections: ExtractedSection[] = [];
  const warnings: string[] = [];
  const preamble: string[] = [];
  let sec: ExtractedSection | null = null;
  let q: (ExtractedQuestion & { _choicesClosed?: boolean }) | null = null;
  let title: string | undefined;

  const startSection = (heading: string): ExtractedSection => {
    const created: ExtractedSection = { title: heading.trim(), instructions: "", type: "", defaultPoints: extractPoints(heading), questions: [] };
    sections.push(created);
    return created;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (STUDENT_LINE_RE.test(line) || /^[\s_\-.]{6,}$/.test(line)) continue;

    const sm = line.match(SECTION_RE);
    const rm = !sm ? line.match(ROMAN_HEADER_RE) : null;
    if (sm || (rm && isHeaderText(rm[2]))) {
      sec = startSection(line.trim());
      q = null;
      continue;
    }

    const am = line.match(ANSWER_RE);
    if (am && q) {
      q.answerKey = am[1].trim();
      continue;
    }

    const im = line.match(ITEM_RE);
    if (im) {
      if (!sec) {
        sec = startSection("Test I");
        warnings.push("No section heading was found before the first item; a section “Test I” was created.");
      }
      const body = im[2] ?? "";
      const inline = splitInlineChoices(body);
      let prompt = body;
      let choices: string[] | undefined;
      if (inline) {
        const first = body.search(/\(?[aA][.)]\s+/);
        prompt = body.slice(0, first).trim();
        choices = inline;
      }
      const pts = extractPoints(prompt);
      q = { number: im[1], prompt: prompt.trim(), choices, points: pts };
      sec.questions.push(q);
      continue;
    }

    const inline = splitInlineChoices(line);
    if (inline && q) {
      q.choices = [...(q.choices ?? []), ...inline];
      continue;
    }
    const cm = line.match(CHOICE_RE);
    if (cm && q) {
      q.choices = [...(q.choices ?? []), cm[2].trim()];
      continue;
    }

    // Plain text line.
    if (q) {
      if (q.choices?.length) q.choices[q.choices.length - 1] += `\n${line.trim()}`;
      else q.prompt = q.prompt ? `${q.prompt}\n${line.trim()}` : line.trim();
    } else if (sec) {
      const s = sec as ExtractedSection;
      s.instructions = s.instructions ? `${s.instructions}\n${line.trim()}` : line.trim();
      if (s.defaultPoints === null || s.defaultPoints === undefined) s.defaultPoints = extractPoints(line);
    } else {
      preamble.push(line.trim());
    }
  }

  // Types: from heading + instructions; otherwise inferred from choices.
  sections.forEach((s) => {
    const t = detectQuestionType(`${s.title}\n${s.instructions}`);
    if (t) s.type = t;
    else if (s.questions.length && s.questions.filter((x) => (x.choices?.length ?? 0) >= 2).length >= s.questions.length / 2) {
      s.type = "multiple-choice";
      warnings.push(`“${s.title}”: question type inferred from answer choices — confirm it.`);
    } else {
      s.type = "unknown";
    }
    // Lettered lines under non-MC items are sub-items, not choices.
    if (s.type !== "multiple-choice")
      s.questions.forEach((x) => {
        if (x.choices?.length) {
          x.subItems = x.choices;
          x.choices = undefined;
        }
      });
  });

  if (preamble.length) {
    title = preamble.find((l) => /exam|examination|quiz|test/i.test(l));
    const instr = preamble.filter((l) => /instruction|read|answer|write|use|do not|shall/i.test(l) && l !== title);
    return { title, generalInstructions: instr.join("\n"), sections, warnings: [...new Set(warnings)] };
  }
  if (!sections.length) warnings.push("No numbered items were recognized. Check that items start with numbers such as “1.” or “1)”.");
  return { title, generalInstructions: "", sections, warnings: [...new Set(warnings)] };
}

/* ------------------------------------------------------------------ */
/* Review flags (parser AND AI output)                                 */
/* ------------------------------------------------------------------ */

export interface ReviewedQuestion extends ExtractedQuestion {
  flags: string[];
}

export interface ReviewedSection extends Omit<ExtractedSection, "questions"> {
  questionType: QuestionType;
  questions: ReviewedQuestion[];
  flags: string[];
}

export interface ReviewedImport {
  title?: string;
  generalInstructions?: string;
  sections: ReviewedSection[];
  warnings: string[];
  numbering: "continuous" | "per-section";
}

const norm = (s: string) => s.toLowerCase().replace(/[\s"“”'‘’]+/g, " ").trim();

function toType(t: string): QuestionType | null {
  const k = (t || "").toLowerCase();
  const direct = ["multiple-choice", "identification", "essay", "analysis", "drawing", "programming", "custom"].find((x) => x === k);
  if (direct) return direct as QuestionType;
  return detectQuestionType(k);
}

/** Adds uncertainty flags: numbering gaps/restarts/duplicates, empty items, too few choices, unknown type, altered wording. */
export function reviewExtraction(r: ExtractResult, sourceText: string): ReviewedImport {
  const src = norm(sourceText || "");
  const warnings = [...(r.warnings ?? [])];
  let restarts = 0;
  let prevLast = 0;
  const seenGlobal = new Set<number>();

  const sections: ReviewedSection[] = r.sections.map((s, si) => {
    const secFlags: string[] = [];
    const qt = toType(s.type);
    if (!qt) secFlags.push(`Question type could not be determined${s.type && s.type !== "unknown" ? ` (“${s.type}”)` : ""} — set to Custom; choose the correct type.`);
    const type: QuestionType = qt ?? "custom";
    const seenSec = new Set<number>();
    let prev: number | null = null;
    const questions = s.questions.map((q, qi) => {
      const flags: string[] = [];
      if (q.uncertain) flags.push(q.uncertain);
      const n = q.number !== undefined ? parseInt(q.number, 10) : NaN;
      if (Number.isNaN(n)) flags.push("Item number not detected");
      else {
        if (qi === 0 && si > 0 && n === 1 && prevLast > 1) restarts++;
        if (prev !== null && n !== prev + 1) {
          if (n <= prev) flags.push(`Numbering out of order: item ${n} follows item ${prev}`);
          else flags.push(`Numbering gap: expected ${prev + 1}, found ${n} — items may be missing`);
        } else if (prev === null && qi === 0 && si > 0 && n !== 1 && n !== prevLast + 1) {
          flags.push(`Section starts at item ${n} (previous section ended at ${prevLast})`);
        }
        if (seenSec.has(n)) flags.push(`Duplicate item number ${n}`);
        seenSec.add(n);
        seenGlobal.add(n);
        prev = n;
      }
      if (!q.prompt.trim()) flags.push("Item has no question text");
      if (type === "multiple-choice" && (q.choices?.length ?? 0) < 2) flags.push("Fewer than two answer choices detected");
      if (type !== "multiple-choice" && (q.choices?.length ?? 0) >= 2) flags.push("Answer choices found in a non–multiple-choice section");
      if (src && q.prompt.trim()) {
        const probe = norm(q.prompt).slice(0, 80);
        if (probe.length > 8 && !src.includes(probe)) flags.push("Wording could not be matched to the original text — verify nothing was changed");
      }
      return { ...q, flags: [...new Set(flags)] };
    });
    if (prev !== null) prevLast = prev;
    return { ...s, questionType: type, flags: secFlags, questions };
  });

  const numbering = restarts > 0 ? "per-section" : "continuous";
  if (restarts > 0) warnings.push("Item numbering restarts at 1 in some sections — numbering mode set to “restart per section” (labels like II.3). Change it if needed.");
  return { title: r.title, generalInstructions: r.generalInstructions, sections, warnings: [...new Set(warnings)], numbering };
}

/** Converts reviewed import output into exam sections, preserving wording exactly. */
export function importToSections(r: ReviewedImport): ExamSection[] {
  return r.sections.map((s, i) => {
    const sec = newSection(s.questionType, s.title || `Test ${i + 1}`);
    sec.instructions = s.instructions ?? "";
    sec.defaultPoints = s.defaultPoints ?? 1;
    sec.plannedItems = s.questions.length;
    if (s.questionType === "custom" && s.type && s.type !== "unknown") sec.customTypeLabel = s.type;
    sec.questions = s.questions.map((q) => {
      const base: Question = newQuestion(s.questionType);
      const out: Question = { ...base, prompt: q.prompt, origin: "import", points: q.points ?? null };
      if (q.points !== null && q.points !== undefined && q.points === sec.defaultPoints) out.points = null;
      const isMc = s.questionType === "multiple-choice";
      const choiceTexts = isMc ? q.choices ?? q.subItems ?? [] : [];
      const subTexts = isMc ? (q.choices ? q.subItems ?? [] : []) : q.subItems ?? q.choices ?? [];
      if (isMc) {
        out.choices = choiceTexts.map((t) => ({ id: uid("ch"), text: t }));
        if (q.answerKey) {
          const k = q.answerKey.trim();
          const letter = k.match(/^\(?([a-hA-H])\)?[.)]?(?:\s|$)/);
          const idx = letter ? letter[1].toLowerCase().charCodeAt(0) - 97 : out.choices.findIndex((c) => norm(c.text) === norm(k));
          if (idx >= 0 && idx < out.choices.length) out.correctChoiceId = out.choices[idx].id;
          else out.answerKey = k;
        }
      } else if (q.answerKey) out.answerKey = q.answerKey;
      if (subTexts.length) out.subItems = subTexts.map((p) => ({ id: uid("sub"), prompt: p }));
      const flags = [...q.flags, ...s.flags];
      if (flags.length) out.flags = [...new Set(flags)];
      return out;
    });
    return sec;
  });
}
