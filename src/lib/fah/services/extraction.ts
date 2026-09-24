"use client";
// Client-side resource processing: extracts readable text from PDF / DOCX / text files and web links.
// Nothing is invented: when no readable text can be obtained the resource gets an explicit status
// (needs-ocr, failed, inaccessible, metadata-only) and an explanation.

import { api } from "@/lib/api";
import type { ResourceStatus } from "../types";

export const MAX_CONTENT_CHARS = 600_000;
const MIN_PDF_CHARS_PER_PAGE = 40;
const MIN_URL_TEXT_CHARS = 200;

export interface ExtractionResult {
  status: ResourceStatus;
  statusMessage: string;
  content: string;
  wordCount: number;
  pageCount?: number;
  truncated?: boolean;
  /** Metadata found in the file itself (never guessed). Only used to prefill empty fields. */
  meta?: { title?: string; authors?: string };
}

export function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cap stored content and describe the result. */
export function finalizeText(raw: string, baseMessage: string, pageCount?: number): ExtractionResult {
  let content = normalize(raw);
  let truncated = false;
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.slice(0, MAX_CONTENT_CHARS);
    truncated = true;
  }
  const wordCount = countWords(content);
  const msg = truncated
    ? `${baseMessage} The text was longer than ${MAX_CONTENT_CHARS.toLocaleString()} characters and was shortened; later parts are not stored.`
    : baseMessage;
  return { status: "extracted", statusMessage: msg, content, wordCount, pageCount, truncated };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export async function extractPdf(file: File): Promise<ExtractionResult> {
  console.log("[extraction] PDF start", file.name, file.size);
  try {
    const pdfjs: any = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let line = "";
      const out: string[] = [];
      for (const it of tc.items as any[]) {
        if (typeof it.str !== "string") continue;
        line += it.str;
        if (it.hasEOL) {
          out.push(line);
          line = "";
        } else if (it.str && !it.str.endsWith(" ")) line += " ";
      }
      if (line) out.push(line);
      pages.push(out.join("\n"));
    }
    let meta: ExtractionResult["meta"] = undefined;
    try {
      const md = await doc.getMetadata();
      const info = (md?.info ?? {}) as { Title?: string; Author?: string };
      const title = typeof info.Title === "string" ? info.Title.trim() : "";
      const authors = typeof info.Author === "string" ? info.Author.trim() : "";
      if (title || authors) meta = { title: title || undefined, authors: authors || undefined };
    } catch (e) {
      console.error("[extraction] PDF metadata could not be read (continuing without it)", e);
    }
    const total = pages.reduce((a, p) => a + p.replace(/\s/g, "").length, 0);
    const avg = doc.numPages ? total / doc.numPages : 0;
    console.log("[extraction] PDF pages", doc.numPages, "avg chars/page", Math.round(avg));
    if (avg < MIN_PDF_CHARS_PER_PAGE) {
      return {
        status: "needs-ocr",
        statusMessage: `This PDF has almost no selectable text (${Math.round(avg)} characters per page on average across ${doc.numPages} page(s)). It is probably a scanned document and requires OCR, which this app does not perform. Enter the text manually or upload a text-based version.`,
        content: "",
        wordCount: 0,
        pageCount: doc.numPages,
        meta,
      };
    }
    const r = finalizeText(pages.join("\n\n"), `Text extracted from ${doc.numPages} page(s).`, doc.numPages);
    return { ...r, meta };
  } catch (e) {
    console.error("[extraction] PDF failed", e);
    const m = errMsg(e);
    const pw = /password/i.test(m);
    return {
      status: "failed",
      statusMessage: pw
        ? "The PDF is password-protected and could not be opened. Upload an unprotected copy or enter the text manually."
        : `The PDF could not be read (${m}). The file may be damaged. Try another copy or enter the text manually.`,
      content: "",
      wordCount: 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/* DOCX                                                                */
/* ------------------------------------------------------------------ */

export async function extractDocx(file: File): Promise<ExtractionResult> {
  console.log("[extraction] DOCX start", file.name, file.size);
  try {
    const mod: any = await import("mammoth/mammoth.browser");
    const mammoth = mod.default ?? mod;
    const arrayBuffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer });
    const text: string = res?.value ?? "";
    if (!text.trim()) {
      return {
        status: "failed",
        statusMessage: "The Word document contains no readable text (it may contain only images). Enter the text manually.",
        content: "",
        wordCount: 0,
      };
    }
    return finalizeText(text, "Text extracted from the Word document (formatting, images and tables are not preserved).");
  } catch (e) {
    console.error("[extraction] DOCX failed", e);
    return {
      status: "failed",
      statusMessage: `The Word document could not be read (${errMsg(e)}). Only .docx files are supported — save older .doc files as .docx, or enter the text manually.`,
      content: "",
      wordCount: 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

export async function extractTextFile(file: File): Promise<ExtractionResult> {
  console.log("[extraction] text file start", file.name, file.size);
  try {
    const text = await file.text();
    if (!text.trim()) {
      return { status: "failed", statusMessage: "The file is empty.", content: "", wordCount: 0 };
    }
    return finalizeText(text, "Text read from the uploaded file.");
  } catch (e) {
    console.error("[extraction] text file failed", e);
    return { status: "failed", statusMessage: `The file could not be read (${errMsg(e)}).`, content: "", wordCount: 0 };
  }
}

export function fromPastedText(text: string, message = "Text pasted by the user."): ExtractionResult {
  if (!text.trim()) return { status: "failed", statusMessage: "No text was entered.", content: "", wordCount: 0 };
  return finalizeText(text, message);
}

/* ------------------------------------------------------------------ */
/* Website link                                                        */
/* ------------------------------------------------------------------ */

export async function extractUrl(url: string): Promise<ExtractionResult & { pageTitle?: string }> {
  console.log("[extraction] URL start", url);
  const r = await api.post<{ title: string; text: string; contentType: string }>("/api/resources/fetch-url", { url });
  if (r.ok === true && r.data) {
    const text = r.data.text ?? "";
    if (text.trim().length < MIN_URL_TEXT_CHARS) {
      return {
        status: "inaccessible",
        statusMessage: `Only ${text.trim().length} characters of readable text were found. The page may be built with JavaScript, require sign-in, or contain mostly images or video. Open it in your browser and paste the relevant text manually.`,
        content: "",
        wordCount: 0,
        pageTitle: r.data.title || undefined,
      };
    }
    const res = finalizeText(text, "Readable text retrieved from the web page (navigation, scripts and styling removed). Check that it contains the intended material.");
    return { ...res, pageTitle: r.data.title || undefined, meta: r.data.title ? { title: r.data.title } : undefined };
  }
  const error = typeof (r as { error?: unknown }).error === "string" ? String((r as { error?: unknown }).error) : "The link could not be retrieved.";
  console.error("[extraction] URL failed", error);
  return {
    status: "inaccessible",
    statusMessage: `${error} You can download the material and upload the file, or paste the text manually.`,
    content: "",
    wordCount: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Status explanations                                                 */
/* ------------------------------------------------------------------ */

export const STATUS_INFO: Record<ResourceStatus, { label: string; explanation: string; readable: boolean }> = {
  processing: { label: "Processing", explanation: "The file is being read in your browser.", readable: false },
  extracted: { label: "Text extracted", explanation: "Readable content is available and can be used as an AI source.", readable: true },
  "metadata-only": {
    label: "Bibliographic only",
    explanation: "Bibliographic information only — not analyzed source material. Add text to enable AI use.",
    readable: false,
  },
  "needs-ocr": {
    label: "Needs OCR",
    explanation: "Scanned file without a text layer. It requires OCR, which this app does not perform. Enter the text manually to use it.",
    readable: false,
  },
  failed: { label: "Extraction failed", explanation: "The file could not be read. Try another copy or enter the text manually.", readable: false },
  inaccessible: {
    label: "Link inaccessible",
    explanation: "The link could not be read (blocked, sign-in required, not HTML, or built with JavaScript). Upload the file or paste the text manually.",
    readable: false,
  },
};
