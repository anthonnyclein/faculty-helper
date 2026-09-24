"use client";
// Replaceable document-generation service. The prototype renders PDFs in the browser from
// the exact paginated page markup shown in the preview (not from the responsive app screen).

import { BASE_DOC_CSS, PX_PER_IN, type PageSpec } from "./paginate";

export interface ExportProgress {
  page: number;
  pages: number;
}

/** Rasterizes each page (2× scale) into a PDF whose page size equals the spec exactly. */
export async function exportPagesToPdf(
  pageHtmls: string[],
  spec: PageSpec,
  fileName: string,
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
  const html2canvas = html2canvasMod.default;
  const orientation = spec.widthIn > spec.heightIn ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "in", format: [spec.widthIn, spec.heightIn], compress: true });

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;z-index:-1;";
  const style = document.createElement("style");
  style.textContent = BASE_DOC_CSS + spec.css;
  host.appendChild(style);
  document.body.appendChild(host);
  console.log(`[export] PDF ${fileName}: ${pageHtmls.length} page(s) at ${spec.widthIn}×${spec.heightIn} in`);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    for (let i = 0; i < pageHtmls.length; i++) {
      onProgress?.({ page: i + 1, pages: pageHtmls.length });
      const wrap = document.createElement("div");
      wrap.innerHTML = pageHtmls[i];
      host.appendChild(wrap);
      const pageEl = wrap.firstElementChild as HTMLElement;
      await Promise.all(
        Array.from(pageEl.querySelectorAll("img")).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r())))
        )
      );
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: Math.round(spec.widthIn * PX_PER_IN),
        height: Math.round(spec.heightIn * PX_PER_IN),
        logging: false,
      });
      const img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage([spec.widthIn, spec.heightIn], orientation);
      pdf.addImage(img, "JPEG", 0, 0, spec.widthIn, spec.heightIn);
      host.removeChild(wrap);
    }
    pdf.setProperties({ title: fileName.replace(/\.pdf$/i, ""), creator: "Faculty Academic Helper" });
    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } catch (e) {
    console.error("[export] PDF export failed", e);
    throw e;
  } finally {
    document.body.removeChild(host);
  }
}

/** Opens the paginated pages in a print window (vector text) with the exact @page size. */
export function printPages(pageHtmls: string[], spec: PageSpec, title: string): void {
  const w = window.open("", "_blank");
  if (!w) throw new Error("The browser blocked the print window. Allow pop-ups for this site and try again.");
  const appStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${appStyles}
<style>
@page { size: ${spec.widthIn}in ${spec.heightIn}in; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
.fah-page { page-break-after: always; break-after: page; }
.fah-page:last-child { page-break-after: auto; break-after: auto; }
${BASE_DOC_CSS}
${spec.css}
</style></head><body>${pageHtmls.join("")}
<script>
  window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 350); });
</script></body></html>`);
  w.document.close();
  console.log(`[export] print window opened for ${title}`);
}
