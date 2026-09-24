// Table of Specifications document (Horizontal / Vertical Item Placement).
// Layout reproduces the institutional TOS references (US Letter) on A4 portrait as requested.
import type { AppData, Exam, Tos } from "../types";
import { computeTos, fmtPct, formatItemLabels, formatNumberList, round2, cellKey, type TosComputed } from "../calc";
import { EXAM_TERM_TO_TOS_PERIOD } from "../template";
import { escapeHtml, textHtml, type DocBlock, type PageSpec } from "./paginate";

export type TosLayout = "horizontal" | "vertical";

export const TOS_LAYOUT_TITLE: Record<TosLayout, string> = {
  horizontal: "Horizontal Item Placement",
  vertical: "Vertical Item Placement",
};

export const TOS_CODE_PLACEHOLDER = "MSUN-CESS-TOS______-2025-REV00";
export const TOS_PAGE_LABEL = "A4 portrait (8.27 × 11.69 in)";

const CAL = `"Calibri","Carlito",sans-serif`;
const ARIAL = `"Arial","Arimo",sans-serif`;
const NARROW = `"Arial Narrow","Arimo",sans-serif`;

const TOS_CSS = `
.doc-tos{font-family:${CAL};color:#000;font-size:10pt;line-height:1.15;}
.doc-tos .tos-head{text-align:center;}
.doc-tos .tos-head img{width:100%;height:auto;display:block;}
.doc-tos .tos-code{font-family:${ARIAL};font-style:italic;color:#e00000;font-size:6.6pt;text-align:right;margin-top:3pt;padding-right:1pt;}
.doc-tos .tos-title{font-family:${ARIAL};font-weight:bold;font-size:15pt;text-align:center;margin:12pt 0 8pt;letter-spacing:0.2px;}
.doc-tos table.tos-info{border:2pt solid #000;margin-bottom:6pt;}
.doc-tos table.tos-info td{border:0.75pt solid #000;padding:1pt 2pt;font-size:9.5pt;vertical-align:middle;}
.doc-tos table.tos-info td.l{background:#d9d9d9;}
.doc-tos table.tos-info td.v{font-weight:bold;font-size:10.5pt;}
.doc-tos table.tos-info tr.per td{height:24pt;}
.doc-tos table.tos-info tr.per td.l{vertical-align:top;}
.doc-tos .per-opts{display:flex;width:100%;}
.doc-tos .per-opt{width:33.3%;padding-left:6%;white-space:nowrap;}
.doc-tos .per-mark{display:inline-block;width:7pt;height:7pt;background:#000;margin-right:5pt;vertical-align:0;}
.doc-tos .per-gap{display:inline-block;width:12pt;}
.doc-tos table.tos-main{border:2pt solid #000;}
.doc-tos table.tos-main th, .doc-tos table.tos-main td{border:0.75pt solid #000;padding:1pt 2pt;}
.doc-tos table.tos-main th{background:#d9d9d9;font-weight:bold;text-align:center;vertical-align:middle;font-size:9pt;}
.doc-tos table.tos-main th.lv{font-size:8.5pt;padding:2pt 1pt;}
.doc-tos table.tos-main th.big{font-size:10pt;}
.doc-tos td.obj{font-family:${NARROW};font-size:8.5pt;letter-spacing:-0.2px;line-height:1.25;}
.doc-tos td.types{font-family:${NARROW};font-size:8.5pt;letter-spacing:-0.2px;line-height:1.25;}
.doc-tos td.c{text-align:center !important;vertical-align:middle !important;font-size:11pt;height:40pt;}
.doc-tos td.rt{text-align:center !important;vertical-align:middle !important;font-size:11pt;font-weight:bold;}
.doc-tos td.p{text-align:center !important;vertical-align:middle !important;font-style:italic;font-size:8pt;height:14pt;}
.doc-tos tr.sum td{border-top:2pt solid #000;}
.doc-tos td.lab{background:#d9d9d9;font-weight:bold;font-size:9pt;vertical-align:top;}
.doc-tos tr.sub td.n{text-align:center !important;vertical-align:middle !important;font-weight:bold;font-size:9.5pt;height:30pt;}
.doc-tos tr.pct td.n{text-align:center !important;font-weight:bold;font-size:9pt;padding-top:3pt;}
.doc-tos td.g{text-align:center !important;font-weight:bold;font-size:12pt;padding:0 2pt;}
.doc-tos tr.spi td.n{text-align:center !important;font-size:7.5pt;vertical-align:middle;}
.doc-tos tr.tsp td.n{text-align:center !important;font-size:7.5pt;vertical-align:middle;}
.doc-tos td.gl{border-left:2pt solid #000 !important;}
.doc-tos td.gt{border-left:2pt solid #000 !important;}
.doc-tos .tos-sig-wrap{margin-top:12pt;}
.doc-tos table.tos-sig{border:2pt solid #000;}
.doc-tos table.tos-sig td{border:0.75pt solid #000;padding:0 2pt;font-size:9pt;}
.doc-tos table.tos-sig tr.hdr td{background:#d9d9d9;border-bottom:none;height:12pt;}
.doc-tos table.tos-sig tr.space td{border-top:none;border-bottom:none;height:40pt;text-align:center !important;vertical-align:bottom;font-weight:bold;font-size:10pt;padding-bottom:2pt;}
.doc-tos table.tos-sig tr.role td{text-align:center !important;font-size:8pt;border-top:0.75pt solid #000;}
.doc-tos table.tos-sig td.dl{background:#d9d9d9;}
.doc-tos table.tos-sig td.dv{font-size:9pt;}
.doc-tos table.tos-sig td.sep{border-left:2pt solid #000;}
`;

export function tosPageSpec(): PageSpec {
  return {
    className: "doc-tos",
    widthIn: 8.27,
    heightIn: 11.69,
    // Reference: left ≈0.9 in, right ≈0.55 in, top ≈0.5 in.
    margin: { top: 0.5, right: 0.55, bottom: 0.6, left: 0.85 },
    css: TOS_CSS,
    label: TOS_PAGE_LABEL,
  };
}

function pctGroup(n: number): string {
  return `${round2(n)}%`;
}

/** Text shown in a placement cell for the chosen layout + numbering mode. */
export function placementText(tos: Tos, exam: Exam | undefined, comp: TosComputed, objectiveId: string, level: string, layout: TosLayout): string {
  const c = comp.cells.get(cellKey(objectiveId, level));
  if (!c || !c.items.length) return "";
  if (tos.numbering === "exam" && exam) return formatItemLabels(c.items, exam);
  return formatNumberList(layout === "horizontal" ? c.horizontalNumbers : c.verticalNumbers);
}

export function buildTosDocument(
  tos: Tos,
  exam: Exam | undefined,
  data: AppData,
  layout: TosLayout
): { spec: PageSpec; blocks: DocBlock[]; computed: TosComputed; title: string } {
  const comp = computeTos(tos, exam, data.institutional.tosLowerOrderCount);
  const levels = tos.levels;
  const N = Math.max(1, levels.length);
  const lower = Math.min(N, Math.max(0, data.institutional.tosLowerOrderCount));
  const blocks: DocBlock[] = [];

  // Header (letterhead + code + title)
  const period = EXAM_TERM_TO_TOS_PERIOD[tos.period] ?? "Prelim";
  blocks.push({
    kind: "flow",
    keepWithNext: true,
    html: `<div class="tos-head"><img src="/header.png" alt="Republic of the Philippines — Mindanao State University at Naawan"></div>
<div class="tos-code">${escapeHtml(tos.tosCode.trim() || TOS_CODE_PLACEHOLDER)}</div>
<div class="tos-title">TABLE OF SPECIFICATION</div>`,
  });

  // Info table
  const opts = (["Prelim", "Midterm", "Final"] as const)
    .map((p) => `<span class="per-opt">${p === period ? `<span class="per-mark"></span>` : `<span class="per-gap"></span>`}${p}</span>`)
    .join("");
  const info: [string, string][] = [
    ["College", escapeHtml(tos.college)],
    ["Department", escapeHtml(tos.department)],
    ["Subject Code", escapeHtml(tos.subjectCode)],
    ["Descriptive Title", escapeHtml(tos.descriptiveTitle)],
  ];
  const after: [string, string][] = [
    ["Semester", escapeHtml(tos.semester)],
    ["Academic Year", escapeHtml(tos.academicYear)],
  ];
  const infoRow = ([l, v]: [string, string]) => `<tr><td class="l">${l}</td><td class="v">${v || "&nbsp;"}</td></tr>`;
  blocks.push({
    kind: "flow",
    keepWithNext: true,
    html: `<table class="tos-info"><colgroup><col style="width:18.8%"><col></colgroup><tbody>${info.map(infoRow).join("")}<tr class="per"><td class="l">Period of Examination</td><td class="v"><div class="per-opts">${opts}</div></td></tr>${after
      .map(infoRow)
      .join("")}</tbody></table>`,
  });

  // Main table
  const lvW = 62.6 / N;
  const colgroup = `<colgroup><col style="width:18.8%"><col style="width:9.3%">${levels.map(() => `<col style="width:${lvW}%">`).join("")}<col style="width:9.3%"></colgroup>`;
  const thead = `<tr><th rowspan="2" class="big">Test Objectives</th><th rowspan="2" class="big">Test Types</th><th colspan="${N}" class="big">Levels of Thinking</th><th rowspan="2" class="big">TOTAL</th></tr><tr>${levels
    .map((l) => `<th class="lv">${escapeHtml(l)}</th>`)
    .join("")}</tr>`;

  const gcls = (i: number) => (i === 0 ? " gt" : i === lower ? " gl" : "");
  const rows: string[] = [];
  const objectives = tos.objectives.length ? tos.objectives : [{ id: "__blank", label: "" }];
  objectives.forEach((o) => {
    const rt = comp.rowTotals.get(o.id);
    const types = (rt?.testTypes ?? []).map((t) => escapeHtml(t)).join("<br>");
    const counts = levels
      .map((l) => {
        const c = comp.cells.get(cellKey(o.id, l));
        return `<td class="c">${c && c.count ? c.count : ""}</td>`;
      })
      .join("");
    const nums = levels.map((l) => `<td class="p">${escapeHtml(placementText(tos, exam, comp, o.id, l, layout))}</td>`).join("");
    rows.push(
      `<tr><td rowspan="2" class="obj">${textHtml(o.label)}</td><td rowspan="2" class="types">${types}</td>${counts}<td class="rt">${
        o.id === "__blank" ? "" : rt?.count ?? 0
      }</td></tr><tr>${nums}<td class="p"></td></tr>`
    );
  });

  const col = (l: string) => comp.colTotals.get(l);
  const has = comp.totalCount > 0;
  const higherCount = N - lower;
  const lowerPct = comp.groupPercents[0]?.percent ?? 0;
  const higherPct = comp.groupPercents[1]?.percent ?? 0;
  const groupCells =
    lower === 0 || higherCount === 0
      ? `<td colspan="${N}" class="g gt">${has ? "100%" : ""}</td>`
      : `<td colspan="${lower}" class="g gt">${has ? pctGroup(lowerPct) : ""}</td><td colspan="${higherCount}" class="g gl">${has ? pctGroup(higherPct) : ""}</td>`;
  const summary = [
    `<tr class="sum sub"><td colspan="2" class="lab">Subtotal Based on Taxonomy Marks</td>${levels
      .map((l, i) => `<td class="n${gcls(i)}">${col(l)?.count ?? 0}</td>`)
      .join("")}<td class="rt gt">${comp.totalCount}</td></tr>`,
    `<tr class="sum pct"><td colspan="2" rowspan="2" class="lab">Percentage Distribution</td>${levels
      .map((l, i) => `<td class="n${gcls(i)}">${has ? fmtPct(col(l)?.percent ?? 0) : ""}</td>`)
      .join("")}<td rowspan="2" class="rt gt">${has ? "100%" : "0%"}</td></tr>`,
    `<tr>${groupCells}</tr>`,
    `<tr class="sum spi"><td colspan="2" class="lab">Scoring Points Per Item</td>${levels
      .map((l, i) => `<td class="n${gcls(i)}">${escapeHtml(col(l)?.pointsPerItem ?? "")}</td>`)
      .join("")}<td class="n gt"></td></tr>`,
    `<tr class="sum tsp"><td colspan="2" class="lab">Total Scoring Points</td>${levels
      .map((l, i) => `<td class="n${gcls(i)}">${col(l)?.count ? col(l)!.points : ""}</td>`)
      .join("")}<td class="rt gt">${comp.totalPoints}</td></tr>`,
  ].join("");
  rows.push(summary);

  blocks.push({ kind: "table", tableClass: "tos-main", colgroup, thead, rows, repeatHeader: true });

  // Signature block — kept together as one flow block.
  const sig = (s: { name: string }) => escapeHtml(s.name);
  const date = (s: { date: string }) => escapeHtml(s.date);
  blocks.push({
    kind: "flow",
    html: `<div class="tos-sig-wrap"><table class="tos-sig"><colgroup><col style="width:6.2%"><col style="width:22%"><col style="width:7.4%"><col style="width:27%"><col style="width:6.2%"><col style="width:31.2%"></colgroup><tbody>
<tr class="hdr"><td colspan="2">Prepared by:</td><td colspan="2" class="sep">Reviewed by:</td><td colspan="2" class="sep">APPROVED:</td></tr>
<tr class="space"><td colspan="2">${sig(tos.preparedBy)}</td><td colspan="2" class="sep">${sig(tos.reviewedBy)}</td><td colspan="2" class="sep">${sig(tos.approvedBy)}</td></tr>
<tr class="role"><td colspan="2">Faculty</td><td colspan="2" class="sep">Chairperson</td><td colspan="2" class="sep">Dean</td></tr>
<tr><td class="dl">Date:</td><td class="dv">${date(tos.preparedBy)}</td><td class="dl sep">Date:</td><td class="dv">${date(tos.reviewedBy)}</td><td class="dl sep">Date:</td><td class="dv">${date(tos.approvedBy)}</td></tr>
</tbody></table></div>`,
  });

  console.log(`[tos-doc] built ${layout} document for ${tos.id}: ${tos.objectives.length} objective(s), ${comp.totalCount} item(s)`);
  return { spec: tosPageSpec(), blocks, computed: comp, title: `TOS — ${TOS_LAYOUT_TITLE[layout]}` };
}
