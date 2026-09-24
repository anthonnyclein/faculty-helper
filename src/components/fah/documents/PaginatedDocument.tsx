"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Loader2, Printer, ZoomIn, ZoomOut, Maximize2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BASE_DOC_CSS, PX_PER_IN, pageHtml, paginate, type DocBlock, type PageSpec } from "@/lib/fah/documents/paginate";
import { exportPagesToPdf, printPages } from "@/lib/fah/documents/export";

interface Props {
  spec: PageSpec;
  blocks: DocBlock[];
  fileName: string;
  title: string;
  /** Extra toolbar content (e.g. document switchers). */
  actions?: ReactNode;
  /** Rendered above the pages (e.g. compliance notices). */
  notice?: ReactNode;
  /** Disable export with a reason (e.g. unresolved paper size). */
  exportBlockedReason?: string;
}

/**
 * Paginated print preview. The page markup rendered here is exactly what the PDF export
 * rasterizes and what the print window receives.
 */
export function PaginatedDocument({ spec, blocks, fileName, title, actions, notice, exportBlockedReason }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(0.6);
  const [exporting, setExporting] = useState<string | null>(null);

  const pageW = spec.widthIn * PX_PER_IN;
  const pageH = spec.heightIn * PX_PER_IN;

  // Re-paginate (debounced) whenever content or page settings change.
  const signature = useMemo(() => JSON.stringify([spec, blocks]), [spec, blocks]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(async () => {
      if (!measureRef.current) return;
      try {
        const res = await paginate(blocks, spec, measureRef.current);
        if (cancelled) return;
        setPages(res.pages.map((chunks, i) => pageHtml(spec, chunks, i, res.pages.length)));
        setWarnings(res.warnings);
        console.log(`[preview] ${title}: ${res.pages.length} page(s)`);
      } catch (e) {
        console.error("[preview] pagination failed", e);
        setWarnings([`Preview failed: ${e instanceof Error ? e.message : String(e)}`]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Fit-to-width scale.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 32;
      setFitScale(Math.max(0.2, Math.min(1.25, w / pageW)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);

  const scale = zoom === "fit" ? fitScale : zoom;

  const doExport = async () => {
    if (exportBlockedReason) return toast.error(exportBlockedReason);
    setExporting("Preparing…");
    try {
      await exportPagesToPdf(pages, spec, fileName, (p) => setExporting(`Rendering page ${p.page} of ${p.pages}…`));
      toast.success("PDF downloaded", { description: `${pages.length} page(s), ${spec.label}` });
    } catch (e) {
      toast.error("PDF export failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(null);
    }
  };

  const doPrint = () => {
    if (exportBlockedReason) return toast.error(exportBlockedReason);
    try {
      printPages(pages, spec, title);
    } catch (e) {
      toast.error("Could not open print window", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <style>{BASE_DOC_CSS + spec.css}</style>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white/80 px-3 py-2 shadow-sm">
        <div className="mr-auto flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-slate-800">{title}</span>
          <span className="text-xs text-slate-500">
            {busy ? "Paginating…" : `${pages.length} page${pages.length === 1 ? "" : "s"}`} · {spec.label} ({spec.widthIn} in wide × {spec.heightIn} in high)
          </span>
        </div>
        {actions}
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.25, +(scale - 0.1).toFixed(2)))}>
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-slate-600">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(Math.min(2, +(scale + 0.1).toFixed(2)))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Fit to width" onClick={() => setZoom("fit")}>
            <Maximize2 className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={doPrint} disabled={busy || !!exporting || !pages.length}>
          <Printer className="size-4" /> Print
        </Button>
        <Button size="sm" onClick={doExport} disabled={busy || !!exporting || !pages.length}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ?? "Download PDF"}
        </Button>
      </div>

      {notice}
      {warnings.length > 0 && (
        <div role="status" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-0.5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div ref={viewportRef} className="relative overflow-auto rounded-xl border bg-slate-200/70 p-4" style={{ maxHeight: "78vh" }}>
        {busy && (
          <div className="absolute inset-x-0 top-3 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow">
            <Loader2 className="size-3 animate-spin" /> Updating preview…
          </div>
        )}
        <div className="flex flex-col items-center gap-4">
          {pages.map((html, i) => (
            <div key={i} className="relative shrink-0 shadow-lg ring-1 ring-black/10" style={{ width: pageW * scale, height: pageH * scale }} aria-label={`Page ${i + 1}`}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: pageW, height: pageH }} dangerouslySetInnerHTML={{ __html: html }} />
              <span className="absolute -right-1 bottom-1 translate-x-full pl-2 text-[10px] text-slate-500">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <div ref={measureRef} aria-hidden />
    </div>
  );
}
