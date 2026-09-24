// Exam documents: student-facing examination paper and a separate faculty answer key & rubrics.
// The student version never contains answer keys or rubrics.
import { examItems, examTotals, sectionTotals, sectionTypeLabel, toRoman, type ExamItemRef } from "../calc";
import type { AppData, Exam, ExamSection, Question } from "../types";
import { escapeHtml, textHtml, type DocBlock, type PageSpec } from "./paginate";

export type ExamPaper = "a4" | "letter";

export interface ExamDocOptions {
  kind: "student" | "key";
  /** Student version only: append answer keys inline (off by default; normally use the separate key). */
  includeAnswerKey?: boolean;
  paper?: ExamPaper;
}

export const EXAM_PAPERS: Record<ExamPaper, { w: number; h: number; label: string }> = {
  a4: { w: 8.27, h: 11.69, label: "A4 portrait" },
  letter: { w: 8.5, h: 11, label: "US Letter portrait" },
};

const HEADER_RATIO = 452 / 3585; // /header.png intrinsic height / width

const EXAM_CSS = `
.doc-exam{font-family:"Book Antiqua","Palatino Linotype",Palatino,"URW Palladio L",Georgia,serif;font-size:11pt;line-height:1.38;color:#000;}
.doc-exam .hdr-img{display:block;width:100%;height:auto;}
.doc-exam .title-block{text-align:center;margin-top:10px;}
.doc-exam .term{font-size:13pt;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;}
.doc-exam .course{font-size:11.5pt;font-weight:bold;margin-top:2px;}
.doc-exam .meta{font-size:10.5pt;margin-top:1px;}
.doc-exam .exam-title{font-size:11pt;font-style:italic;margin-top:3px;}
.doc-exam .key-banner{margin-top:8px;border:2px solid #000;padding:5px 8px;text-align:center;font-weight:bold;font-size:12pt;letter-spacing:.04em;}
.doc-exam table.student{margin-top:12px;font-size:10.5pt;}
.doc-exam table.student td{padding:4px 4px 0 0;white-space:nowrap;}
.doc-exam .line{display:inline-block;border-bottom:1px solid #000;height:1em;vertical-align:bottom;}
.doc-exam .gen-instr{margin-top:12px;border:1px solid #000;padding:6px 9px;font-size:10.5pt;}
.doc-exam .gen-instr b{display:block;margin-bottom:2px;}
.doc-exam .sec-head{margin-top:14px;font-weight:bold;font-size:11pt;text-transform:uppercase;display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #000;padding-bottom:2px;}
.doc-exam .sec-head span.pts{font-weight:normal;text-transform:none;font-size:10pt;white-space:nowrap;}
.doc-exam .sec-instr{margin-top:4px;font-style:italic;font-size:10.5pt;}
.doc-exam .q{display:flex;gap:6px;margin-top:9px;}
.doc-exam .q .blank{flex:none;width:0.62in;border-bottom:1px solid #000;height:1.1em;}
.doc-exam .q .num{flex:none;min-width:0.3in;text-align:right;}
.doc-exam .q .body{flex:1;min-width:0;}
.doc-exam .q .qpts{font-size:9.5pt;white-space:nowrap;}
.doc-exam .choices{display:grid;grid-template-columns:1fr 1fr;column-gap:14px;row-gap:1px;margin-top:3px;}
.doc-exam .choices.one-col{grid-template-columns:1fr;}
.doc-exam .choice{display:flex;gap:5px;}
.doc-exam .choice .ltr{flex:none;width:1.3em;}
.doc-exam .subs{margin-top:3px;}
.doc-exam .sub{display:flex;gap:5px;margin-top:2px;}
.doc-exam .sub .ltr{flex:none;width:1.6em;}
.doc-exam pre.code{font-family:"Courier New",Consolas,monospace;font-size:9.5pt;line-height:1.3;border:1px solid #666;background:#f6f6f6;padding:5px 7px;margin-top:4px;}
.doc-exam .code-lang{font-size:8.5pt;color:#333;margin-top:3px;}
.doc-exam img.qimg{display:block;max-width:100%;max-height:3.4in;margin-top:5px;border:1px solid #bbb;}
.doc-exam .ans-lines{margin-left:0.36in;}
.doc-exam .ans-line{border-bottom:1px solid #555;height:0.31in;}
.doc-exam .ans-box{margin-left:0.36in;border:1px solid #000;margin-top:4px;}
.doc-exam .end{margin-top:18px;text-align:center;font-size:10pt;font-style:italic;}
.doc-exam .footer{position:absolute;display:flex;justify-content:space-between;font-size:8.5pt;color:#333;border-top:1px solid #999;padding-top:3px;}
.doc-exam table.key{font-size:9.5pt;margin-top:4px;}
.doc-exam table.key th, .doc-exam table.key td{border:1px solid #000;padding:3px 5px;}
.doc-exam table.key th{font-weight:bold;background:#e9e9e9;text-align:center;}
.doc-exam table.key td.c{text-align:center;}
.doc-exam table.key .rub{white-space:pre-wrap;font-size:9pt;}
.doc-exam table.key .tag{font-size:8pt;color:#333;}
.doc-exam table.sum th, .doc-exam table.sum td{border:1px solid #000;padding:3px 5px;font-size:10pt;}
.doc-exam table.sum th{background:#e9e9e9;font-weight:bold;text-align:center;}
.doc-exam table.sum td.c{text-align:center;}
`;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function pts(n: number) {
  return `${n} pt${n === 1 ? "" : "s"}`;
}

function examHeading(exam: Exam): string {
  const term = exam.term ? `${exam.term} Examination` : "Examination";
  const course = [exam.courseCode, exam.courseTitle].filter(Boolean).join(" — ");
  const meta = [exam.semester, exam.academicYear ? `A.Y. ${exam.academicYear}` : ""].filter(Boolean).join(" · ");
  return `<div class="title-block">
<div class="term">${escapeHtml(term)}</div>
${course ? `<div class="course">${escapeHtml(course)}</div>` : ""}
${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}
${exam.title ? `<div class="exam-title">${escapeHtml(exam.title)}</div>` : ""}
</div>`;
}

function studentLines(totalPoints: number): string {
  const L = (w: string) => `<span class="line" style="width:${w}"></span>`;
  return `<table class="student"><colgroup><col style="width:58%"><col style="width:42%"></colgroup><tbody>
<tr><td>Name: ${L("78%")}</td><td>Date: ${L("70%")}</td></tr>
<tr><td>Course / Year / Section: ${L("52%")}</td><td>Score: ${L("40%")} / ${totalPoints}</td></tr>
</tbody></table>`;
}

function sectionHeading(sec: ExamSection, si: number): string {
  const t = sectionTotals(sec);
  const uniform = sec.questions.every((q) => q.points === null || q.points === undefined);
  const each = uniform && sec.defaultPoints !== null ? ` (${pts(sec.defaultPoints ?? 0)} each)` : "";
  const title = sec.title?.trim() || `Test ${toRoman(si + 1)}`;
  const type = sectionTypeLabel(sec);
  const heading = title.toLowerCase().includes(type.toLowerCase()) ? title : `${title}. ${type}`;
  return `<div class="sec-head"><span>${escapeHtml(heading)}</span><span class="pts">${t.items} item${t.items === 1 ? "" : "s"} · ${t.points} point${t.points === 1 ? "" : "s"}${escapeHtml(each)}</span></div>`;
}

function printedNumber(it: ExamItemRef, exam: Exam) {
  return exam.numbering === "per-section" ? String(it.indexInSection) : String(it.ordinal);
}

function correctLetter(q: Question): { letter: string; text: string } | null {
  if (!q.choices || !q.correctChoiceId) return null;
  const i = q.choices.findIndex((c) => c.id === q.correctChoiceId);
  if (i < 0) return null;
  return { letter: LETTERS[i] ?? "?", text: q.choices[i].text };
}

function questionBody(q: Question, sec: ExamSection, showPts: boolean, p: number): string {
  let h = `<div>${textHtml(q.prompt)}${showPts ? ` <span class="qpts">(${pts(p)})</span>` : ""}</div>`;
  if (q.imageDataUrl) h += `<img class="qimg" src="${escapeHtml(q.imageDataUrl)}" alt="">`;
  if (q.code?.trim()) {
    if (q.codeLanguage) h += `<div class="code-lang">${escapeHtml(q.codeLanguage)}</div>`;
    h += `<pre class="code">${escapeHtml(q.code)}</pre>`;
  }
  if (sec.type === "multiple-choice" && q.choices?.length) {
    const long = q.choices.some((c) => c.text.length > 38 || c.text.includes("\n"));
    h += `<div class="choices${long ? " one-col" : ""}">${q.choices
      .map((c, i) => `<div class="choice"><span class="ltr">${LETTERS[i]}.</span><span>${textHtml(c.text)}</span></div>`)
      .join("")}</div>`;
  }
  if (q.subItems?.length)
    h += `<div class="subs">${q.subItems.map((s, i) => `<div class="sub"><span class="ltr">(${LETTERS[i]})</span><span>${textHtml(s.prompt)}</span></div>`).join("")}</div>`;
  return h;
}

/** Answer space rendered as its own block so long spaces can move to the next page. */
function answerSpace(q: Question, sec: ExamSection): string | null {
  const n = Math.max(0, Math.min(40, q.answerLines ?? 0));
  if (sec.type === "multiple-choice" || sec.type === "identification" || !n) return null;
  if (sec.type === "drawing") return `<div class="ans-box" style="height:${Math.min(7.5, n * 0.3).toFixed(2)}in"></div>`;
  return `<div class="ans-lines">${Array.from({ length: n }, () => `<div class="ans-line"></div>`).join("")}</div>`;
}

function inlineKey(q: Question): string {
  const c = correctLetter(q);
  const parts = [c ? `Answer: ${c.letter}. ${c.text}` : q.answerKey ? `Answer: ${q.answerKey}` : "", q.rubric ? `Rubric: ${q.rubric}` : ""].filter(Boolean);
  return parts.length ? `<div style="margin-left:0.36in;margin-top:3px;font-size:9.5pt;border-left:2px solid #000;padding-left:6px">${textHtml(parts.join("\n"))}</div>` : "";
}

export function examFileBase(exam: Exam) {
  return [exam.courseCode, exam.term, exam.title].filter(Boolean).join(" ").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "exam";
}

export function buildExamDocument(exam: Exam, data: AppData, opts: ExamDocOptions): { spec: PageSpec; blocks: DocBlock[] } {
  const paper = EXAM_PAPERS[opts.paper ?? "a4"];
  const margin = { top: 0.6, right: 0.75, bottom: 0.8, left: 0.75 };
  const contentW = paper.w - margin.left - margin.right;
  const headerH = contentW * HEADER_RATIO;
  const isKey = opts.kind === "key";
  const footerLeft = [exam.courseCode, exam.term ? `${exam.term} Examination` : ""].filter(Boolean).join(" · ") || "Examination";
  const footerHtml = `<div class="footer" style="left:${margin.left}in;right:${margin.right}in;bottom:0.38in;"><span>${escapeHtml(footerLeft)}${
    isKey ? " · ANSWER KEY — FOR FACULTY USE ONLY" : ""
  }</span><span>Page {page} of {pages}</span></div>`;

  const spec: PageSpec = {
    className: "doc-exam",
    widthIn: paper.w,
    heightIn: paper.h,
    margin,
    css: EXAM_CSS,
    footerHtml,
    label: paper.label,
  };

  const totals = examTotals(exam);
  const items = examItems(exam);
  const bySection = new Map<string, ExamItemRef[]>();
  items.forEach((it) => bySection.set(it.sectionId, [...(bySection.get(it.sectionId) ?? []), it]));
  const blocks: DocBlock[] = [];
  const header = `<img class="hdr-img" src="/header.png" alt="Institutional header" style="height:${headerH.toFixed(3)}in">`;

  if (!isKey) {
    blocks.push({ kind: "flow", html: `${header}${examHeading(exam)}${studentLines(totals.points)}` });
    if (exam.instructions.trim())
      blocks.push({ kind: "flow", html: `<div class="gen-instr"><b>GENERAL INSTRUCTIONS</b>${textHtml(exam.instructions)}</div>` });

    exam.sections.forEach((sec, si) => {
      const secItems = bySection.get(sec.id) ?? [];
      blocks.push({ kind: "flow", html: sectionHeading(sec, si), keepWithNext: true });
      if (sec.instructions.trim()) blocks.push({ kind: "flow", html: `<div class="sec-instr">${textHtml(sec.instructions)}</div>`, keepWithNext: true });
      const uniform = sec.questions.every((q) => q.points === null || q.points === undefined);
      secItems.forEach((it) => {
        const q = it.question;
        const blankFirst = sec.type === "multiple-choice" || sec.type === "identification";
        const showPts = !uniform || !["multiple-choice", "identification"].includes(sec.type);
        const html = `<div class="q">${blankFirst ? `<span class="blank"></span>` : ""}<span class="num">${escapeHtml(printedNumber(it, exam))}.</span><div class="body">${questionBody(
          q,
          sec,
          showPts,
          it.points
        )}</div></div>${opts.includeAnswerKey ? inlineKey(q) : ""}`;
        const space = answerSpace(q, sec);
        blocks.push({ kind: "flow", html, keepWithNext: !!space });
        if (space) blocks.push({ kind: "flow", html: space });
      });
    });
    blocks.push({ kind: "flow", html: `<div class="end">— End of examination · ${totals.items} items · ${totals.points} points —</div>` });
    return { spec, blocks };
  }

  // ---------- Answer key & rubrics (faculty only) ----------
  blocks.push({
    kind: "flow",
    html: `${header}<div class="key-banner">ANSWER KEY — FOR FACULTY USE ONLY</div>${examHeading(exam)}<p style="margin-top:6px;font-size:9.5pt;text-align:center">Do not distribute to students. Sub-items (a, b, c) are part of their parent item and share its points.</p>`,
  });
  blocks.push({
    kind: "table",
    tableClass: "sum",
    colgroup: `<colgroup><col style="width:34%"><col style="width:30%"><col style="width:18%"><col style="width:18%"></colgroup>`,
    thead: `<tr><th>Section</th><th>Question type</th><th>Items</th><th>Points</th></tr>`,
    rows: [
      ...exam.sections.map((sec, si) => {
        const t = sectionTotals(sec);
        return `<tr><td>${escapeHtml(sec.title || `Test ${toRoman(si + 1)}`)}</td><td>${escapeHtml(sectionTypeLabel(sec))}</td><td class="c">${t.items}</td><td class="c">${t.points}</td></tr>`;
      }),
      `<tr><td colspan="2" style="text-align:right;font-weight:bold">TOTAL</td><td class="c"><b>${totals.items}</b></td><td class="c"><b>${totals.points}</b></td></tr>`,
    ],
  });

  const syl = exam.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  const cloCode = (id?: string) => (id && syl ? syl.clos.find((c) => c.id === id)?.code : undefined);

  exam.sections.forEach((sec, si) => {
    const secItems = bySection.get(sec.id) ?? [];
    blocks.push({ kind: "flow", html: sectionHeading(sec, si), keepWithNext: true });
    if (!secItems.length) {
      blocks.push({ kind: "flow", html: `<p style="font-style:italic;font-size:10pt;margin-top:4px">No items in this section.</p>` });
      return;
    }
    blocks.push({
      kind: "table",
      tableClass: "key",
      colgroup: `<colgroup><col style="width:9%"><col style="width:41%"><col style="width:41%"><col style="width:9%"></colgroup>`,
      thead: `<tr><th>Item</th><th>Question</th><th>Answer key / rubric</th><th>Pts</th></tr>`,
      rows: secItems.map((it) => {
        const q = it.question;
        const c = correctLetter(q);
        const ans = c ? `<b>${c.letter}.</b> ${textHtml(c.text)}` : q.answerKey?.trim() ? textHtml(q.answerKey) : `<i>No answer key entered</i>`;
        const rub = q.rubric?.trim() ? `<div class="rub" style="margin-top:3px"><b>Rubric:</b>\n${escapeHtml(q.rubric)}</div>` : "";
        const tags = [q.topic ? `Topic: ${q.topic}` : "", cloCode(q.cloId) ? cloCode(q.cloId) : "", q.cognitiveLevel ?? ""].filter(Boolean).join(" · ");
        const prompt = q.prompt.length > 260 ? `${q.prompt.slice(0, 257)}…` : q.prompt;
        const subs = q.subItems?.length ? `<div class="tag">Sub-items: ${q.subItems.map((_, i) => `(${LETTERS[i]})`).join(" ")}</div>` : "";
        return `<tr><td class="c">${escapeHtml(it.label)}</td><td>${textHtml(prompt)}${subs}${tags ? `<div class="tag">${escapeHtml(tags)}</div>` : ""}</td><td>${ans}${rub}</td><td class="c">${it.points}</td></tr>`;
      }),
    });
  });
  return { spec, blocks };
}
