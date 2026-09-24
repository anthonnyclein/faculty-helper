// Syllabus document builder: turns a saved Syllabus into a PageSpec + DocBlocks that
// reproduce the uploaded reference ("Syllabus Template.docx.pdf") as closely as possible.
// Never invents content: missing required inputs are printed as grey "[Field]" placeholders
// (and reported in `missing`), optional blanks are printed as empty lines like the template.

import { dimensionTotals, gradingTotal, orderedPOs, poNumbers, splitOrdinal } from "../calc";
import { formatReferenceHtml } from "../citations";
import type { AppData, CitationStyle, POCategory, ReferenceEntry, SignatoryRef, Syllabus, SyllabusPaper } from "../types";
import { PX_PER_IN, escapeHtml, lines, textHtml, type DocBlock, type PageSpec } from "./paginate";
import { files } from "@/assets/files";

/* ------------------------------------------------------------------ */
/* Paper                                                               */
/* ------------------------------------------------------------------ */

export const SYLLABUS_PAPERS: Record<SyllabusPaper, { widthIn: number; heightIn: number; label: string; description: string }> = {
  "custom-13x11": {
    widthIn: 13,
    heightIn: 11,
    label: "Custom 13 × 11 in (landscape)",
    description: "13 in wide × 11 in high, landscape — size requested in the requirements",
  },
  "legal-14x8.5": {
    widthIn: 14,
    heightIn: 8.5,
    label: "Legal 14 × 8.5 in (landscape) — matches template",
    description: "14 in wide × 8.5 in high, landscape — size of the uploaded reference template",
  },
};

export function syllabusPaper(paper: SyllabusPaper | undefined) {
  return SYLLABUS_PAPERS[paper ?? "custom-13x11"] ?? SYLLABUS_PAPERS["custom-13x11"];
}

// Measured on the reference (14 in wide page).
const HEADER_WIDTH_RATIO = 0.943; // header image width / page width
const FOOTER_WIDTH_RATIO = 0.94;
const IMG_RATIO = 452 / 3585; // header/footer PNG height / width
const HEADER_TOP_IN = 0.08;
const HEADER_RULE_FRACTION = 0.895; // navy/gold rule bottom, as a fraction of header image height
const FOOTER_TOP_FROM_BOTTOM_IN = 0.73; // at 14 in page width
const FOOTER_RULE_FRACTION = 0.06; // footer rule top, fraction of footer image height

export function syllabusPageGeometry(widthIn: number, heightIn: number) {
  const hw = widthIn * HEADER_WIDTH_RATIO;
  const hh = hw * IMG_RATIO;
  const headerRule = HEADER_TOP_IN + hh * HEADER_RULE_FRACTION;
  const fw = widthIn * FOOTER_WIDTH_RATIO;
  const fh = fw * IMG_RATIO;
  const scale = widthIn / 14;
  const footerTop = heightIn - FOOTER_TOP_FROM_BOTTOM_IN * scale;
  const footerRule = footerTop + fh * FOOTER_RULE_FRACTION;
  return {
    header: { left: 0, top: HEADER_TOP_IN, width: hw, height: hh, ruleBottom: headerRule },
    footer: { left: 0, top: footerTop, width: fw, height: fh, ruleTop: footerRule },
    margin: {
      top: +(headerRule + 0.17).toFixed(3),
      right: 0.6,
      bottom: +(heightIn - footerRule + 0.18).toFixed(3),
      left: 1.0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

const CLS = "doc-syl";
const FONT_BODY = `"Book Antiqua","Palatino Linotype",Palatino,"URW Palladio L","P052",Georgia,serif`;
const FONT_CORSIVA = `"Monotype Corsiva","Corsiva","URW Chancery L","Apple Chancery",cursive`;
const FONT_ARIAL = `Arial,Arimo,"Liberation Sans",Helvetica,sans-serif`;
const B = "0.75pt solid #000";

const SYL_CSS = `
.${CLS}{font-family:${FONT_BODY};font-size:10pt;line-height:1.22;color:#000;}
.${CLS} .fah-page-content, .${CLS}.fah-measure{font-family:${FONT_BODY};font-size:10pt;line-height:1.22;}
.${CLS} .syl-hdr, .${CLS} .syl-ftr{position:absolute;display:block;max-width:none;}
.${CLS} b, .${CLS} strong{font-weight:bold;}
.${CLS} i, .${CLS} em{font-style:italic;}
.${CLS} sup{font-size:0.62em;vertical-align:super;line-height:0;}
.${CLS} .ph{color:#9aa1ad;font-style:italic;font-weight:normal;}
.${CLS} .bold .ph, .${CLS} b .ph{font-weight:bold;}
.${CLS} .j{text-align:justify;}
.${CLS} .c{text-align:center;}
.${CLS} .r{text-align:right;}
.${CLS} .sp{height:10pt;}
.${CLS} .spl{height:22pt;}
/* Title */
.${CLS} .syl-top{display:flex;justify-content:space-between;align-items:flex-start;margin-top:4pt;}
.${CLS} .college{font-family:${FONT_CORSIVA};font-style:italic;font-size:16pt;line-height:1.15;padding-top:6pt;}
.${CLS} .sylcode{font-family:${FONT_ARIAL};font-style:italic;font-size:6pt;line-height:1.2;margin-right:0.95in;padding-top:0;}
.${CLS} .syl-title{text-align:center;font-weight:bold;font-size:10pt;margin:13pt 0 16pt;}
/* Generic bordered tables */
.${CLS} table.bt{border-collapse:collapse;}
.${CLS} table.bt > * > tr > td, .${CLS} table.bt > * > tr > th{border:${B};padding:1.5pt 4pt;vertical-align:top;}
.${CLS} table.info{width:89.5%;margin-left:4.4%;font-weight:bold;font-size:11pt;line-height:1.15;}
.${CLS} table.info td{font-weight:bold;padding:0.5pt 5pt;}
.${CLS} table.vmgc{width:89.5%;margin-left:4.4%;margin-top:14pt;}
.${CLS} table.vmgc td{text-align:justify;}
.${CLS} table.vmgc .hd{font-weight:bold;text-align:left;}
.${CLS} table.vmgc .goal + .goal{margin-top:12.2pt;}
/* PEOs */
.${CLS} .peo{margin-top:12pt;}
.${CLS} .nl{position:relative;padding-left:0.3in;}
.${CLS} .nl > .n{position:absolute;left:0;top:0;width:0.25in;}
.${CLS} .peo .items{margin-left:0.25in;}
.${CLS} .peo .n{font-weight:bold;}
/* PO table */
.${CLS} table.po{width:88.7%;}
.${CLS} table.po th{font-weight:bold;text-align:center;}
.${CLS} table.po td.num{text-align:center;}
.${CLS} table.po td.cat{font-weight:bold;}
.${CLS} table.po td.cat2{font-size:11pt;}
/* Course description + CLOs */
.${CLS} table.cd{width:100%;}
.${CLS} table.cd td.desc{padding:3pt 5pt 12pt;}
.${CLS} table.cd td.desc .txt{padding-left:3pt;}
.${CLS} table.cd .nl{padding-left:0.24in;}
.${CLS} table.cd .nl > .n{width:0.22in;}
/* Learning plan */
.${CLS} .plan-h{font-weight:bold;margin:14pt 0 12pt;}
.${CLS} table.lp{width:100%;}
.${CLS} table.lp th{background:#d9e2f3;font-weight:bold;text-align:center;vertical-align:top;padding:4pt 4pt;overflow-wrap:anywhere;}
.${CLS} table.lp tr.h2 th{height:30pt;}
.${CLS} table.lp td{padding:3pt 5pt 14pt;}
.${CLS} table.lp td.wk{text-align:center;}
.${CLS} table.lp td.clo{text-align:center;}
.${CLS} table.lp td.exam{text-align:center;font-weight:bold;padding:2pt 4pt 6pt;}
.${CLS} .bl{position:relative;padding-left:0.17in;}
.${CLS} .bl > .n{position:absolute;left:0;top:0;}
.${CLS} table.lp .nl{padding-left:0.25in;}
.${CLS} table.lp .nl > .n{left:0.04in;}
/* After plan */
.${CLS} .note{margin-top:3pt;}
.${CLS} .refs-h{font-weight:bold;margin:12pt 0 14pt 0.08in;}
.${CLS} .ref{margin-left:0.25in;padding-left:0.3in;text-indent:-0.3in;}
.${CLS} .cp-h{font-weight:bold;margin:14pt 0 10pt;}
/* Policies box */
.${CLS} table.pol{width:88.7%;border-collapse:collapse;}
.${CLS} table.pol > tbody > tr > td{border-left:${B};border-right:${B};border-top:0;border-bottom:0;padding:3pt 5pt 6pt;vertical-align:top;}
.${CLS} table.pol > tbody > tr:first-child > td{border-top:${B};}
.${CLS} table.pol > tbody > tr.first > td{padding-top:14pt;}
.${CLS} table.pol > tbody > tr:last-child > td{border-bottom:${B};}
.${CLS} table.pol .hd{font-weight:bold;margin-bottom:12.2pt;}
.${CLS} table.pol .hd2{font-weight:bold;}
.${CLS} table.pol .sec + .sec{margin-top:12.2pt;}
.${CLS} .req{margin-left:0.22in;}
.${CLS} .req .nl{font-weight:bold;padding-left:0.25in;margin-bottom:12.2pt;}
.${CLS} .pl{margin-left:0.05in;}
.${CLS} .pl .li{position:relative;padding-left:0.46in;text-align:justify;margin-bottom:12.2pt;}
.${CLS} .pl .li > .n{position:absolute;left:0.05in;top:0;}
.${CLS} .pl .li p + p{margin-top:12.2pt;}
.${CLS} .grade-lines{margin-top:12.2pt;}
.${CLS} table.dim{width:80%;border-collapse:collapse;font-weight:bold;margin-bottom:34pt;}
.${CLS} table.dim td{border:${B};padding:0 5pt;font-weight:bold;}
.${CLS} .fg{font-weight:bold;text-align:justify;}
.${CLS} table.crit{width:97%;border-collapse:collapse;}
.${CLS} table.crit > tbody > tr > td{border:${B};padding:3pt 5pt 10pt;}
.${CLS} table.crit .crit-p{text-align:justify;margin-top:30pt;}
.${CLS} table.crit .crit-p + .crit-p{margin-top:30pt;}
.${CLS} table.tr{width:100%;border-collapse:collapse;margin-top:30pt;}
.${CLS} table.tr td{border:0;padding:0 2pt;font-weight:bold;line-height:1.18;}
.${CLS} table.tr tr.th td{padding-bottom:14pt;}
.${CLS} .fgbox{border:${B};padding:10pt 5pt 10pt;width:97%;text-align:justify;margin-top:22pt;}
.${CLS} .gad .gi{padding-left:0;}
/* Signatures */
.${CLS} table.sig{width:92%;border-collapse:collapse;margin-top:14pt;}
.${CLS} table.sig > tbody > tr > td{border:${B};padding:18pt 6pt 30pt;vertical-align:top;}
.${CLS} .sg{margin-top:28pt;}
.${CLS} .sg + .sg{margin-top:34pt;}
.${CLS} .sg .nm{text-align:center;font-weight:bold;text-decoration:underline;text-transform:uppercase;}
.${CLS} .sg .tt{text-align:center;}
.${CLS} .sg .dt{margin-top:18pt;white-space:nowrap;}
.${CLS} .sg .dt .line{min-width:1.1in;}
.${CLS} .line{display:inline-block;min-width:1.5in;border-bottom:0.75pt solid #000;height:1em;vertical-align:baseline;}
.${CLS} .uline{text-decoration:underline;}
.${CLS} table.rev{width:100%;border-collapse:collapse;margin-top:12pt;}
.${CLS} table.rev td{border:0;padding:0 0 18pt;}
.${CLS} table.rev td.v{width:52%;}
.${CLS} table.rev .line{min-width:100%;}
/* Learning Commitment Agreement */
.${CLS} .lca-h{font-weight:bold;margin:18pt 0 16pt;}
.${CLS} .lca{text-align:justify;}
.${CLS} .lca-sig{width:2.8in;margin:44pt 1.35in 0 auto;text-align:center;}
.${CLS} .lca-sig .ln{border-top:0.75pt solid #000;}
.${CLS} .lca-sig + .lca-sig{margin-top:44pt;width:2.98in;}
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = escapeHtml;

function ordinalHtml(s: string): string {
  const o = splitOrdinal(s);
  if (!o) return esc(s);
  return `${esc(o.before)}<sup>${esc(o.sup)}</sup>${esc(o.after)}`;
}

/** Numbered list with hanging labels ("1."). */
function numList(items: string[], start = 1): string {
  return items.map((t, i) => `<div class="nl"><span class="n">${start + i}.</span>${textHtml(t)}</div>`).join("");
}

function bulletList(items: string[], bullet = "•"): string {
  return items.map((t) => `<div class="bl"><span class="n">${bullet}</span>${textHtml(t)}</div>`).join("");
}

export function referenceHtml(ref: ReferenceEntry, style: CitationStyle): string {
  return formatReferenceHtml(ref, style);
}

function signatoryDateHtml(v: string): string {
  const t = (v ?? "").trim();
  if (!t) return `<span class="line"></span>`;
  let shown = t;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t.length === 10 ? `${t}T00:00:00` : t);
    if (!Number.isNaN(d.getTime())) shown = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return `<span class="uline">${esc(shown)}</span>`;
}

function unitsText(s: Syllabus, showHours: boolean): string | null {
  if (s.units === null || s.units === undefined) return null;
  let t = `${s.units} ${s.units === 1 ? "unit" : "units"}`;
  if (showHours) {
    const parts: string[] = [];
    if (s.lectureHours !== null && s.lectureHours !== undefined) parts.push(`${s.lectureHours} hrs lecture`);
    if (s.labHours !== null && s.labHours !== undefined) parts.push(`${s.labHours} hrs laboratory`);
    if (parts.length) t += ` (${parts.join(", ")})`;
  }
  return t;
}

export interface SyllabusDocument {
  spec: PageSpec;
  blocks: DocBlock[];
  /** Required template inputs that are missing and printed as placeholders. */
  missing: string[];
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export function buildSyllabusDocument(s: Syllabus, data: AppData): SyllabusDocument {
  const settings = data.settings;
  const inst = data.institutional;
  const paper = syllabusPaper(settings.syllabusPaper);
  const geo = syllabusPageGeometry(paper.widthIn, paper.heightIn);
  const missing: string[] = [];
  const px = (inches: number) => Math.round(inches * PX_PER_IN * 100) / 100;

  /** Value or a visible placeholder (recorded in `missing`). */
  const req = (v: string | null | undefined, label: string, html = false): string => {
    const t = (v ?? "").toString().trim();
    if (t) return html ? t : esc(t);
    if (!missing.includes(label)) missing.push(label);
    return `<span class="ph">[${esc(label)}]</span>`;
  };

  const spec: PageSpec = {
    className: CLS,
    widthIn: paper.widthIn,
    heightIn: paper.heightIn,
    margin: geo.margin,
    css: SYL_CSS,
    label: paper.label,
    headerHtml: `<img class="syl-hdr" alt="" src="${files.syllabusHeader.url}" style="left:${px(geo.header.left)}px;top:${px(geo.header.top)}px;width:${px(
      geo.header.width
    )}px;height:${px(geo.header.height)}px;">`,
    footerHtml: `<img class="syl-ftr" alt="" src="${files.syllabusFooter.url}" style="left:${px(geo.footer.left)}px;top:${px(geo.footer.top)}px;width:${px(
      geo.footer.width
    )}px;height:${px(geo.footer.height)}px;">`,
  };

  const blocks: DocBlock[] = [];
  const courseCode = req(s.courseCode, "Course Code");

  /* ---------- Title ---------- */
  blocks.push({
    kind: "flow",
    html: `<div class="syl-top"><div class="college">${req(s.collegeName, "College Name")}</div><div class="sylcode">${req(
      s.syllabusCode,
      "Syllabus Code"
    )}</div></div><div class="syl-title">COURSE SYLLABUS IN ${courseCode}</div>`,
  });

  /* ---------- Course information ---------- */
  const units = unitsText(s, settings.showHoursInUnits);
  const semAy =
    s.semester.trim() || s.academicYear.trim()
      ? `${s.semester.trim() ? esc(s.semester.trim()) : req("", "Semester")} AY ${req(s.academicYear, "Academic Year")}`
      : `${req("", "Semester")} AY ${req("", "Academic Year")}`;
  blocks.push({
    kind: "flow",
    html: `<table class="bt info"><colgroup><col style="width:33.9%"><col style="width:30.8%"><col style="width:35.3%"></colgroup><tbody>
<tr><td>Course Code:&nbsp; ${courseCode}</td><td>Pre-requisite:&nbsp; ${esc(s.prerequisite)}</td><td>No. of Units: ${units ? esc(units) : req("", "No. of Units")}</td></tr>
<tr><td>Descriptive Title: ${req(s.descriptiveTitle ? s.descriptiveTitle.toUpperCase() : "", "Descriptive Title")}</td><td>Co-requisite: ${esc(
      s.corequisite
    )}</td><td>Semester, AY: ${semAy}</td></tr></tbody></table>`,
  });

  /* ---------- VMGC ---------- */
  const si = s.institutional;
  blocks.push({
    kind: "flow",
    html: `<table class="bt vmgc"><colgroup><col style="width:27.5%"><col style="width:24%"><col style="width:32.8%"><col style="width:15.7%"></colgroup><tbody>
<tr><td><div class="hd">VISION</div>${req(si.vision, "Vision")}</td><td><div class="hd">MISSION</div>${req(si.mission, "Mission")}</td><td><div class="hd">GOALS</div>${
      si.goals.length ? si.goals.map((g, i) => `<div class="goal">${i + 1}. ${esc(g)}</div>`).join("") : req("", "Goals")
    }</td><td><div class="hd">CORE VALUES</div>${si.coreValues.map((c) => `<div style="text-align:left">${esc(c)}</div>`).join("")}</td></tr></tbody></table>`,
  });

  /* ---------- PEOs ---------- */
  blocks.push({
    kind: "flow",
    html: `<div class="peo"><b>Program Educational Objectives (PEOs)</b><div>${esc(si.peoIntro)}</div><div class="items">${si.peos
      .map((p, i) => `<div class="nl"><span class="n">${i + 1}.</span>${esc(p.description)}</div>`)
      .join("")}</div></div>`,
  });
  blocks.push({ kind: "flow", html: `<div class="sp"></div>` });

  /* ---------- Program Outcomes ---------- */
  const nums = poNumbers(s);
  const pos = orderedPOs(s);
  const cats: POCategory[] = [1, 2, 3, 4, 5];
  const poRows: string[] = [];
  cats.forEach((c) => {
    const list = pos.filter((p) => p.category === c);
    const title = inst.poCategoryTitles?.[c] ?? "";
    const intro = inst.poCategoryIntros?.[c];
    let head = `<tr><td colspan="2" class="cat${c === 2 ? " cat2" : ""}">${esc(title)}</td><td></td></tr>`;
    if (intro) head += `<tr><td colspan="2">${esc(intro)}</td><td></td></tr>`;
    const poRow = (p: (typeof pos)[number]) =>
      `<tr><td class="num">${nums.get(p.id) ?? ""}</td><td>${esc(p.description)}</td><td>${esc(p.peos.join(", "))}</td></tr>`;
    if (!list.length) {
      const placeholder =
        c === 2 || c === 3
          ? `<tr><td class="num"></td><td>${req("", c === 2 ? "Outcomes common to the discipline" : "Outcomes specific to the IT program")}</td><td></td></tr>`
          : "";
      poRows.push(head + placeholder);
      return;
    }
    poRows.push(head + poRow(list[0]));
    list.slice(1).forEach((p) => poRows.push(poRow(p)));
  });
  blocks.push({
    kind: "table",
    tableClass: "bt po",
    colgroup: `<colgroup><col style="width:3.9%"><col style="width:79.1%"><col style="width:17%"></colgroup>`,
    thead: `<tr><th colspan="2">Program Outcomes</th><th>MSU-N PEOs</th></tr>`,
    rows: poRows,
    repeatHeader: true,
  });
  blocks.push({ kind: "flow", html: `<div class="spl"></div>` });

  /* ---------- Course description + CLOs ---------- */
  const cdRows: string[] = [];
  cdRows.push(
    `<tr><td colspan="2" class="desc"><b>Course Description:</b><div class="txt">${
      s.courseDescription.trim() ? textHtml(s.courseDescription.trim()) : req("", "Course Description")
    }</div></td></tr>`
  );
  const cloHead = `<tr><td><b>Course Learning Outcomes<br>At the end of the course, the students are expected to:</b></td><td class="c"><b>Program Outcomes</b><br>(refer to Program Outcomes)</td></tr>`;
  const cloRow = (c: Syllabus["clos"][number], i: number) => {
    const poList = c.poIds
      .map((id) => nums.get(id))
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b)
      .map((n) => `PO ${n}`)
      .join(", ");
    return `<tr><td><div class="nl"><span class="n">${i + 1}.</span>${c.statement.trim() ? textHtml(c.statement) : req("", `CLO ${i + 1} statement`)}</div></td><td>${esc(
      poList
    )}</td></tr>`;
  };
  if (s.clos.length) {
    cdRows.push(cloHead + cloRow(s.clos[0], 0));
    s.clos.slice(1).forEach((c, i) => cdRows.push(cloRow(c, i + 1)));
  } else {
    cdRows.push(cloHead + `<tr><td>${req("", "Course Learning Outcomes")}</td><td></td></tr>`);
  }
  blocks.push({
    kind: "table",
    tableClass: "bt cd",
    colgroup: `<colgroup><col style="width:70.8%"><col style="width:29.2%"></colgroup>`,
    rows: cdRows,
  });

  /* ---------- Course Learning Plan ---------- */
  blocks.push({ kind: "flow", html: `<div class="plan-h">Course Learning Plan</div>`, keepWithNext: true });

  type Col = { key: string; title: string; w: number };
  const cols: Col[] = [
    { key: "wk", title: "Timeline", w: 6.5 },
    { key: "content", title: "Learning Content", w: 13.6 },
    { key: "silo", title: "Specific Intended Learning Outcomes", w: settings.showCloColumn ? 22.2 : 27.2 },
  ];
  if (settings.showCloColumn) cols.push({ key: "clo", title: "Corresponding CLOs", w: 9 });
  cols.push({ key: "tla", title: "Teaching and Learning Activities", w: 20.9 }, { key: "assess", title: "Assessment", w: 18.9 });
  if (settings.showMaterialsColumn) cols.push({ key: "mat", title: "Instructional Material References", w: 12.9 });
  const wSum = cols.reduce((a, c) => a + c.w, 0);
  const colgroup = `<colgroup>${cols.map((c) => `<col style="width:${((c.w / wSum) * 100).toFixed(2)}%">`).join("")}</colgroup>`;
  const thead =
    `<tr>${cols.map((c) => (c.key === "tla" ? `<th>${esc(c.title)}</th>` : `<th rowspan="2">${esc(c.title)}</th>`)).join("")}</tr>` +
    `<tr class="h2"><th>Lecture</th></tr>`;

  const cloCode = new Map(s.clos.map((c, i) => [c.id, c.code?.trim() || `CLO ${i + 1}`]));
  const plan = [...s.learningPlan].sort((a, b) => a.weekStart - b.weekStart || (a.kind === "exam" ? 1 : 0) - (b.kind === "exam" ? 1 : 0));
  const planRows: string[] = [];
  plan.forEach((it) => {
    if (it.kind === "exam") {
      planRows.push(
        `<tr><td colspan="${cols.length}" class="exam">Week ${it.weekStart}${it.weekEnd && it.weekEnd > it.weekStart ? `-${it.weekEnd}` : ""}: ${esc(
          (it.examLabel || "EXAMINATIONS").toUpperCase()
        )}</td></tr>`
      );
      return;
    }
    const multi = it.weekEnd && it.weekEnd > it.weekStart;
    const wk = multi ? `Weeks<br>${it.weekStart}-${it.weekEnd}` : `Week<br>${it.weekStart}`;
    const cell = (key: string) => {
      switch (key) {
        case "wk":
          return `<td class="wk">${wk}</td>`;
        case "content":
          return `<td>${textHtml(it.content.trim())}</td>`;
        case "silo":
          return `<td>${numList(lines(it.silos))}</td>`;
        case "clo":
          return `<td class="clo">${esc(it.cloIds.map((id) => cloCode.get(id)).filter(Boolean).join(", "))}</td>`;
        case "tla":
          return `<td>${bulletList(lines(it.activities))}</td>`;
        case "assess":
          return `<td>${bulletList(lines(it.assessment))}</td>`;
        case "mat":
          return `<td>${lines(it.materials).map((l) => `<div>${esc(l)}</div>`).join("")}</td>`;
        default:
          return `<td></td>`;
      }
    };
    planRows.push(`<tr>${cols.map((c) => cell(c.key)).join("")}</tr>`);
  });
  if (!plan.some((p) => p.kind === "lesson")) {
    planRows.unshift(`<tr><td colspan="${cols.length}" class="c">${req("", "Learning plan items")}</td></tr>`);
  }
  blocks.push({ kind: "table", tableClass: "bt lp", colgroup, thead, rows: planRows, repeatHeader: true });

  blocks.push({ kind: "flow", html: `<div class="note">Note: <i>${esc(inst.scheduleNote)}</i></div>` });

  /* ---------- References ---------- */
  blocks.push({ kind: "flow", html: `<div class="refs-h">Suggested References:</div>`, keepWithNext: true });
  if (s.references.length) {
    for (let i = 0; i < s.references.length; i += 3) {
      blocks.push({
        kind: "flow",
        html: s.references
          .slice(i, i + 3)
          .map((r) => `<div class="ref">${referenceHtml(r, s.citationStyle)}</div>`)
          .join(""),
      });
    }
  } else {
    blocks.push({ kind: "flow", html: `<div class="ref">${req("", "References")}</div>` });
  }

  /* ---------- Class policies & evaluation (2-column box) ---------- */
  blocks.push({ kind: "flow", html: `<div class="cp-h">CLASS POLICIES AND EVALUATION DETAILS</div>`, keepWithNext: true });

  const letter = (i: number) => String.fromCharCode(97 + (i % 26));
  const gTotal = gradingTotal(s.grading.rows);
  const policyHtml = (p: Syllabus["classPolicies"][number], i: number) => {
    if (p.kind === "grading") {
      const rows = s.grading.rows.map((g) => `<div>${esc(g.component)} - ${g.weight ?? ""}%</div>`).join("");
      return `<div class="li"><span class="n">${letter(i)}.</span>${esc(p.text || "Grading System:")}<div class="grade-lines">${rows}</div><div class="grade-lines">Total: ${gTotal}%</div>${
        s.grading.passingRate.trim() ? `<div class="grade-lines">${esc(s.grading.passingRate)}</div>` : ""
      }</div>`;
    }
    const paras = p.text.split(/\n\s*\n/).map((t) => `<p>${textHtml(t.trim())}</p>`).join("");
    return `<div class="li"><span class="n">${letter(i)}.</span>${paras}</div>`;
  };
  const pols = s.classPolicies;
  const polChunk = (a: number, b: number) =>
    pols.length > a ? `<div class="pl">${pols.slice(a, b).map((p, k) => policyHtml(p, a + k)).join("")}</div>` : "";

  const dt = dimensionTotals(s.dimensionEvaluation);
  const pct = (v: number | null) => (v === null || v === undefined ? "" : `${v}%`);
  const dimTable = `<table class="dim"><colgroup><col style="width:28%"><col style="width:24%"><col style="width:26%"><col style="width:22%"></colgroup><tbody>
<tr><td>Cognitive Learning Domain</td><td>Prelim</td><td>Midterm</td><td>Finals</td></tr>
${s.dimensionEvaluation.map((d) => `<tr><td>${esc(d.level)}</td><td>${pct(d.prelim)}</td><td>${pct(d.midterm)}</td><td>${pct(d.finals)}</td></tr>`).join("")}
<tr><td>Total</td><td>${dt.prelim}%</td><td>${dt.midterm}%</td><td>${dt.finals}%</td></tr></tbody></table>`;

  const critTable = `<table class="crit"><colgroup><col style="width:48.5%"><col style="width:51.5%"></colgroup><tbody><tr>
<td><b>Criteria for Grading</b>${inst.criteriaForGrading.map((c) => `<div class="crit-p">${esc(c)}</div>`).join("")}</td>
<td><b>Transmutation Table</b><table class="tr"><colgroup><col style="width:38%"><col style="width:62%"></colgroup><tbody>
<tr class="th"><td class="c">Final Grade</td><td class="c">Total Percentage<br>Score Range</td></tr>
${inst.transmutation.map((t) => `<tr><td class="c">${esc(t.grade)}</td><td class="c">${esc(t.range)}</td></tr>`).join("")}
</tbody></table></td></tr></tbody></table>`;

  const reqList = `<div class="req">${s.requirements.map((r, i) => `<div class="nl"><span class="n">${i + 1}.</span>${esc(r.text)}</div>`).join("")}</div>`;
  const polRow = (left: string, right: string, cls = "") => `<tr class="${cls}"><td>${left}</td><td>${right}</td></tr>`;
  // Fine-grained row groups (one policy item / section per row) so the box can break between items like the template.
  const leftChunks: string[] = [
    `<div class="hd">Course Management and Class Policies</div><div class="hd">Requirements</div>${reqList}${polChunk(0, 1)}`,
    ...pols.slice(1).map((_, k) => polChunk(k + 1, k + 2)),
    `<div class="sec"><div class="hd2">Circulating or Selling Class Materials</div><div class="j">${textHtml(s.policySections.circulatingMaterials)}</div></div>`,
    `<div class="sec"><div class="hd2">Accommodation for Students with Disabilities (SWD)</div><div class="j">${textHtml(s.policySections.swdStatement).replace(
      /SWD\/PWD/g,
      "<i>SWD/PWD</i>"
    )}</div></div>`,
    `<div class="sec"><div class="hd2">Attendance and Absences</div><div>${textHtml(s.policySections.attendanceStatement)}</div></div>`,
    `<div class="sec gad"><div class="hd2">GAD Themes</div>${s.policySections.gadThemes.map((g) => `<div class="gi">● ${esc(g)}</div>`).join("")}</div>`,
  ];
  const rightChunks: string[] = [
    `<div class="hd">Dimension Evaluation</div><div class="hd">${esc(inst.dimensionEvaluationSubtitle || "Example")}</div>${dimTable}<div class="fg">${esc(inst.finalGradeStatement)}</div>`,
    `<div style="height:20pt"></div>${critTable}`,
    `<div class="fgbox">${esc(inst.finalGradeStatement)}</div>`,
  ];
  const polRows: string[] = leftChunks.map((l, i) => polRow(l, rightChunks[i] ?? "", i === 0 ? "first" : ""));
  blocks.push({
    kind: "table",
    tableClass: "pol",
    colgroup: `<colgroup><col style="width:50%"><col style="width:50%"></colgroup>`,
    rows: polRows,
  });

  /* ---------- Signatures ---------- */
  const sigHtml = (p: SignatoryRef, fallbackTitle: string, label: string) =>
    `<div class="sg"><div class="nm">${req(p?.name, label)}</div><div class="tt">${esc(p?.title?.trim() || fallbackTitle)}</div><div class="dt">Date Signed: ${signatoryDateHtml(
      p?.dateSigned
    )}</div></div>`;
  const prepared = s.preparedBy.length ? s.preparedBy : [{ name: "", title: "Faculty", dateSigned: "" }];
  const revVal = (v: string) => (v?.trim() ? `<span class="uline">${esc(v.trim())}</span>` : `<span class="line"></span>`);
  blocks.push({
    kind: "flow",
    html: `<table class="sig"><colgroup><col style="width:25%"><col style="width:27.8%"><col style="width:22.2%"><col style="width:25%"></colgroup><tbody><tr>
<td>Prepared by:${prepared.map((p) => sigHtml(p, "Faculty", "Faculty name")).join("")}</td>
<td>Reviewed by:${sigHtml(s.reviewedBy, "Department Chairperson", "Department Chairperson")}</td>
<td>Approved by:${sigHtml(s.approvedBy, "Dean", "Dean")}</td>
<td><table class="rev"><tbody>
<tr><td>Revision Number:</td><td class="v">${revVal(s.revision.number)}</td></tr>
<tr><td>Date Revised:</td><td class="v">${revVal(s.revision.dateRevised)}</td></tr>
<tr><td>Effectivity:</td><td class="v">${revVal(s.revision.effectivity)}</td></tr>
</tbody></table></td></tr></tbody></table>`,
  });

  /* ---------- Learning Commitment Agreement ---------- */
  const semHtml = s.semester.trim() ? ordinalHtml(s.semester.trim()) : req("", "Semester");
  const ayHtml = req(s.academicYear, "Academic Year");
  let lca = esc(inst.learningCommitmentAgreement);
  lca = lca.replace(/\{semester\}(.*?)\{academicYear\}(\.?)/, (_m, mid: string, dot: string) => `<b>${semHtml}${mid}${ayHtml}${dot}</b>`);
  lca = lca
    .replace(/\{courseCode\}/g, `<b>${courseCode}</b>`)
    .replace(/\{semester\}/g, `<b>${semHtml}</b>`)
    .replace(/\{academicYear\}/g, `<b>${ayHtml}</b>`);
  blocks.push({
    kind: "flow",
    breakBefore: true,
    html: `<div class="lca-h">LEARNING COMMITMENT AGREEMENT</div><div class="lca">${lca}</div>
<div class="lca-sig"><div class="ln"></div>Printed name and signature</div><div class="lca-sig"><div class="ln"></div>Date</div>`,
  });

  console.log(
    `[syllabus-doc] ${s.courseCode || s.id}: ${blocks.length} blocks (PO groups ${poRows.length}, plan groups ${planRows.length}, policy groups ${polRows.length}), paper ${paper.widthIn}×${paper.heightIn} in, margins`,
    geo.margin,
    missing.length ? `missing: ${missing.join(", ")}` : ""
  );
  return { spec, blocks, missing };
}
