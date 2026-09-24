// Reference formatting. Never fabricates missing data: missing fields are reported, not invented.
// Styles: APA 7 (template default — "Gaciu, N. (2021). Understanding quantitative data in educational research. SAGE Publications."),
// IEEE, MLA 9 and Chicago (author-date). Plain-text output wraps titles in *asterisks* for italics;
// formatReferenceHtml() returns escaped HTML with <i> for titles (used by the document renderer).
import type { CitationStyle, ReferenceEntry } from "./types";

const clean = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** Adds a terminal period unless the text already ends with sentence punctuation. */
function endPeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** "5" → "5th ed.", "2nd" → "2nd ed.", "Revised edition" → "Revised ed.", "3rd ed." unchanged. */
export function formatEdition(edition?: string): string {
  const e = clean(edition);
  if (!e) return "";
  if (/\bed\.?$/i.test(e)) return e.endsWith(".") ? e : `${e}.`;
  const n = e.match(/^(\d+)(st|nd|rd|th)?(\s*(edition|ed))?\.?$/i);
  if (n) {
    const num = Number(n[1]);
    const suffix = n[2] ? n[2].toLowerCase() : ordinalSuffix(num);
    return `${num}${suffix} ed.`;
  }
  return `${e.replace(/\s*edition\.?$/i, "")} ed.`;
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}

/** Normalizes a DOI to a resolvable https://doi.org/… link (never invents one). */
export function doiLink(doi?: string): string {
  const d = clean(doi);
  if (!d) return "";
  if (/^https?:\/\//i.test(d)) return d;
  return `https://doi.org/${d.replace(/^doi:\s*/i, "")}`;
}

function title(ref: ReferenceEntry): string {
  const t = clean(ref.title);
  return t ? `*${t}*` : "";
}

function link(ref: ReferenceEntry): string {
  return doiLink(ref.doi) || clean(ref.url);
}

function apa(ref: ReferenceEntry): string {
  const parts: string[] = [];
  const authors = clean(ref.authors);
  const year = clean(ref.year);
  if (authors && year) parts.push(`${authors} (${year}).`);
  else if (authors) parts.push(endPeriod(authors));
  else if (year) parts.push(`(${year}).`);
  const t = title(ref);
  const ed = formatEdition(ref.edition);
  if (t) parts.push(ed ? `${t} (${ed}).` : endPeriod(t));
  else if (ed) parts.push(`(${ed}).`);
  const pub = clean(ref.publisher);
  if (pub) parts.push(endPeriod(pub));
  const l = link(ref);
  if (l) {
    const accessed = clean(ref.accessed);
    parts.push(accessed && !ref.doi ? `Retrieved ${accessed}, from ${l}` : l);
  }
  return parts.join(" ");
}

function ieee(ref: ReferenceEntry): string {
  const segs: string[] = [];
  const authors = clean(ref.authors);
  if (authors) segs.push(authors);
  const t = title(ref);
  if (t) segs.push(t);
  let head = segs.join(", ");
  const ed = formatEdition(ref.edition);
  const tail: string[] = [];
  const pub = clean(ref.publisher);
  const year = clean(ref.year);
  if (pub) tail.push(pub);
  if (year) tail.push(year);
  if (ed) head = head ? `${head}, ${ed}` : ed;
  let out = head;
  if (tail.length) out = out ? `${out} ${tail.join(", ")}` : tail.join(", ");
  out = endPeriod(out);
  const doi = doiLink(ref.doi);
  const url = clean(ref.url);
  if (doi) out += ` doi: ${clean(ref.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "")}.`;
  else if (url) {
    const accessed = clean(ref.accessed);
    out += ` [Online]. Available: ${url}${accessed ? ` (accessed ${accessed})` : ""}`;
  }
  return out.trim();
}

function mla(ref: ReferenceEntry): string {
  const parts: string[] = [];
  const authors = clean(ref.authors);
  if (authors) parts.push(endPeriod(authors));
  const t = title(ref);
  if (t) parts.push(endPeriod(t));
  const container: string[] = [];
  const ed = formatEdition(ref.edition);
  if (ed) container.push(ed);
  const pub = clean(ref.publisher);
  if (pub) container.push(pub);
  const year = clean(ref.year);
  if (year) container.push(year);
  if (container.length) parts.push(endPeriod(container.join(", ")));
  const l = link(ref);
  if (l) parts.push(endPeriod(l.replace(/^https?:\/\//i, "")));
  const accessed = clean(ref.accessed);
  if (accessed && clean(ref.url)) parts.push(`Accessed ${endPeriod(accessed)}`);
  return parts.join(" ");
}

function chicago(ref: ReferenceEntry): string {
  const parts: string[] = [];
  const authors = clean(ref.authors);
  const year = clean(ref.year);
  if (authors) parts.push(endPeriod(authors));
  if (year) parts.push(`${year}.`);
  const t = title(ref);
  if (t) parts.push(endPeriod(t));
  const ed = formatEdition(ref.edition);
  if (ed) parts.push(ed);
  const pub = clean(ref.publisher);
  if (pub) parts.push(endPeriod(pub));
  const accessed = clean(ref.accessed);
  if (accessed && clean(ref.url) && !ref.doi) parts.push(`Accessed ${endPeriod(accessed)}`);
  const l = link(ref);
  if (l) parts.push(endPeriod(l));
  return parts.join(" ");
}

/** Returns the printed citation (plain text; titles may be wrapped in *asterisks* for italics). */
export function formatReference(ref: ReferenceEntry, style: CitationStyle): string {
  if (ref.manualText?.trim()) return ref.manualText.trim();
  switch (style) {
    case "IEEE":
      return ieee(ref);
    case "MLA 9":
      return mla(ref);
    case "Chicago":
      return chicago(ref);
    case "APA 7":
    default:
      return apa(ref);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Escaped HTML version of formatReference with <i> for italic (asterisk-wrapped) titles. */
export function formatReferenceHtml(ref: ReferenceEntry, style: CitationStyle): string {
  const text = formatReference(ref, style);
  return escapeHtml(text).replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
}

/** Splits a formatted citation into plain / italic runs (for React rendering). */
export function citationRuns(text: string): { text: string; italic: boolean }[] {
  const out: { text: string; italic: boolean }[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), italic: false });
    out.push({ text: m[1], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), italic: false });
  return out;
}

/** Lists bibliographic fields that are missing and must be completed by the user. */
export function missingReferenceFields(ref: ReferenceEntry): string[] {
  if (ref.manualText?.trim()) return [];
  const out: string[] = [];
  if (!ref.authors?.trim()) out.push("author");
  if (!ref.year?.trim()) out.push("year");
  if (!ref.title?.trim()) out.push("title");
  if (!ref.publisher?.trim() && !ref.url?.trim() && !ref.doi?.trim()) out.push("publisher, DOI or URL");
  return out;
}
