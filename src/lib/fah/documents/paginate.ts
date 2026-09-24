"use client";
// Document pagination engine. Content is described as blocks; blocks are measured in an
// off-screen container at the exact printable width and packed into fixed-size pages.
// Tables are split between row groups and repeat their header on every page.
// The same page markup feeds the on-screen preview, the PDF export and browser printing.

export const PX_PER_IN = 96;

export interface PageSpec {
  /** Root class applied to every page and to the measurer — scope your CSS with it. */
  className: string;
  widthIn: number;
  heightIn: number;
  margin: { top: number; right: number; bottom: number; left: number };
  /** Scoped CSS for this document type. */
  css: string;
  /** HTML positioned absolutely relative to the page (full-page coordinates). Repeated on every page. */
  headerHtml?: string;
  footerHtml?: string;
  label: string; // e.g. "Custom 13 × 11 in, landscape"
}

export type DocBlock =
  | { kind: "flow"; html: string; keepWithNext?: boolean; breakBefore?: boolean }
  | {
      kind: "table";
      tableClass?: string;
      colgroup?: string;
      thead?: string; // "<tr>…</tr>" rows for <thead>
      /** Each entry is one or more <tr> that must stay on the same page. */
      rows: string[];
      repeatHeader?: boolean; // default true
      keepWithNext?: boolean;
      breakBefore?: boolean;
    };

export interface PageChunk {
  html: string;
}

export interface PaginationResult {
  pages: PageChunk[][];
  warnings: string[];
}

export function contentBox(spec: PageSpec) {
  return {
    width: Math.floor((spec.widthIn - spec.margin.left - spec.margin.right) * PX_PER_IN),
    height: Math.floor((spec.heightIn - spec.margin.top - spec.margin.bottom) * PX_PER_IN),
  };
}

function tableHtml(b: Extract<DocBlock, { kind: "table" }>, rows: string[], withHead: boolean, measuring = false): string {
  const head = withHead && b.thead ? `<thead>${b.thead}</thead>` : "";
  const bodies = measuring
    ? rows.map((r, i) => `<tbody data-g="${i}">${r}</tbody>`).join("")
    : `<tbody>${rows.join("")}</tbody>`;
  return `<div class="fah-flow"><table class="${b.tableClass ?? ""}">${b.colgroup ?? ""}${head}${bodies}</table></div>`;
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          })
    )
  );
}

interface Measured {
  block: DocBlock;
  height: number; // flow: full height; table: height of table wrapper without rows
  theadH: number;
  groupH: number[];
  extra: number; // table borders/margins not attributable to rows or header
}

/** Measures and paginates. `host` must be attached to the document (it is emptied afterwards). */
export async function paginate(blocks: DocBlock[], spec: PageSpec, host: HTMLElement): Promise<PaginationResult> {
  const box = contentBox(spec);
  const warnings: string[] = [];
  host.innerHTML = "";
  host.className = `${spec.className} fah-measure`;
  host.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;width:${box.width}px;`;

  // Render everything once for measurement.
  const wrappers: HTMLElement[] = blocks.map((b) => {
    const w = document.createElement("div");
    w.innerHTML = b.kind === "flow" ? `<div class="fah-flow">${b.html}</div>` : tableHtml(b, b.rows, true, true);
    host.appendChild(w);
    return w;
  });
  if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
  await waitForImages(host);

  const measured: Measured[] = blocks.map((b, i) => {
    const w = wrappers[i].firstElementChild as HTMLElement;
    const total = w.getBoundingClientRect().height;
    if (b.kind === "flow") return { block: b, height: total, theadH: 0, groupH: [], extra: 0 };
    const thead = w.querySelector("thead");
    const theadH = thead ? thead.getBoundingClientRect().height : 0;
    const groupH = Array.from(w.querySelectorAll("tbody[data-g]")).map((tb) => tb.getBoundingClientRect().height);
    const extra = Math.max(0, total - theadH - groupH.reduce((a, h) => a + h, 0));
    return { block: b, height: total, theadH, groupH, extra };
  });
  host.innerHTML = "";

  const pages: PageChunk[][] = [[]];
  let remaining = box.height;
  const TOL = 0.5;
  const cur = () => pages[pages.length - 1];
  const newPage = () => {
    pages.push([]);
    remaining = box.height;
  };

  const firstUnit = (m: Measured | undefined) => {
    if (!m) return 0;
    if (m.block.kind === "flow") return m.height;
    return m.theadH + (m.groupH[0] ?? 0) + m.extra;
  };

  measured.forEach((m, idx) => {
    const b = m.block;
    if (b.breakBefore && cur().length) newPage();
    if (b.keepWithNext && cur().length) {
      const need = (b.kind === "flow" ? m.height : firstUnit(m)) + firstUnit(measured[idx + 1]);
      if (need > remaining + TOL && need <= box.height) newPage();
    }

    if (b.kind === "flow") {
      if (m.height > remaining + TOL && cur().length) newPage();
      if (m.height > box.height + TOL) warnings.push("A text block is taller than one page; part of it may be cut off. Split it into shorter paragraphs.");
      cur().push({ html: `<div class="fah-flow">${b.html}</div>` });
      remaining -= m.height;
      return;
    }

    const repeat = b.repeatHeader !== false;
    let i = 0;
    let first = true;
    if (!b.rows.length) {
      if (m.height > remaining + TOL && cur().length) newPage();
      cur().push({ html: tableHtml(b, [], true) });
      remaining -= m.height;
      return;
    }
    while (i < b.rows.length) {
      const headH = first || repeat ? m.theadH : 0;
      const avail = remaining - headH - m.extra;
      let j = i;
      let used = 0;
      while (j < b.rows.length && used + m.groupH[j] <= avail + TOL) {
        used += m.groupH[j];
        j++;
      }
      if (j === i) {
        if (cur().length) {
          newPage();
          continue;
        }
        j = i + 1;
        used = m.groupH[i];
        warnings.push("A table row is taller than a full page and may be clipped. Shorten that row’s text.");
      }
      cur().push({ html: tableHtml(b, b.rows.slice(i, j), first || repeat) });
      remaining -= used + headH + m.extra;
      i = j;
      first = false;
      if (i < b.rows.length) newPage();
    }
  });

  if (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();
  return { pages, warnings: [...new Set(warnings)] };
}

export function pageHtml(spec: PageSpec, chunks: PageChunk[], pageIndex: number, pageCount: number): string {
  const box = contentBox(spec);
  const W = Math.round(spec.widthIn * PX_PER_IN);
  const H = Math.round(spec.heightIn * PX_PER_IN);
  const sub = (s: string) => s.replace(/\{page\}/g, String(pageIndex + 1)).replace(/\{pages\}/g, String(pageCount));
  return `<div class="fah-page ${spec.className}" style="width:${W}px;height:${H}px;">${spec.headerHtml ? sub(spec.headerHtml) : ""}${
    spec.footerHtml ? sub(spec.footerHtml) : ""
  }<div class="fah-page-content" style="left:${Math.round(spec.margin.left * PX_PER_IN)}px;top:${Math.round(spec.margin.top * PX_PER_IN)}px;width:${box.width}px;height:${box.height}px;">${chunks
    .map((c) => c.html)
    .join("")}</div></div>`;
}

/** Base reset so application styles (Tailwind preflight) never leak into documents. */
export const BASE_DOC_CSS = `
.fah-page{position:relative;overflow:hidden;background:#fff;color:#000;box-sizing:border-box;}
.fah-page *, .fah-measure *{box-sizing:border-box;}
.fah-page-content{position:absolute;overflow:hidden;}
.fah-flow{display:flow-root;}
.fah-page table, .fah-measure table{border-collapse:collapse;width:100%;table-layout:fixed;}
.fah-page td, .fah-page th, .fah-measure td, .fah-measure th{vertical-align:top;text-align:left;font-weight:normal;}
.fah-page p, .fah-measure p{margin:0;}
.fah-page ol, .fah-page ul, .fah-measure ol, .fah-measure ul{margin:0;padding-left:1.4em;}
.fah-page ol{list-style:decimal;} .fah-measure ol{list-style:decimal;}
.fah-page ul{list-style:disc;} .fah-measure ul{list-style:disc;}
.fah-page img, .fah-measure img{display:inline-block;max-width:none;}
.fah-page b, .fah-page strong, .fah-measure b, .fah-measure strong{font-weight:bold;}
.fah-page pre, .fah-measure pre{white-space:pre-wrap;margin:0;}
`;

export function escapeHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes and converts newlines to <br>. */
export function textHtml(s: string | null | undefined): string {
  return escapeHtml(s ?? "").replace(/\n/g, "<br>");
}

/** Splits multi-line text into non-empty lines. */
export function lines(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[•\-*]|\d+[.)]|[a-z][.)])\s+/i, "").trim())
    .filter(Boolean);
}
