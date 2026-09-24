"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { PaginatedDocument } from "../../documents/PaginatedDocument";
import { buildTosDocument, TOS_LAYOUT_TITLE, TOS_PAGE_LABEL, type TosLayout } from "@/lib/fah/documents/tos";
import type { AppData, Exam, Tos } from "@/lib/fah/types";
import { cn } from "@/lib/utils";

function safeName(s: string) {
  return (s || "TOS").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 60);
}

export function TosPrintPanel({ tos, exam, data, errors }: { tos: Tos; exam: Exam | undefined; data: AppData; errors: string[] }) {
  const [layout, setLayout] = useState<TosLayout>("horizontal");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Document layout" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["horizontal", "vertical"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={layout === l}
              onClick={() => setLayout(l)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                layout === l ? "bg-[#1b2466] text-white shadow-sm" : "text-slate-600 hover:text-[#1b2466]"
              )}
            >
              {TOS_LAYOUT_TITLE[l]}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Info className="size-3.5" /> Both layouts export as {TOS_PAGE_LABEL}. Reference templates are US Letter; exports use A4 as requested.
        </p>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-4" /> This TOS has validation errors
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">You can still print or download, but the document will not match the exam until these are fixed.</p>
        </div>
      )}
      {/* Separate preview panel per layout (remounted on switch). */}
      <LayoutPreview key={layout} tos={tos} exam={exam} data={data} layout={layout} />
    </div>
  );
}

function LayoutPreview({ tos, exam, data, layout }: { tos: Tos; exam: Exam | undefined; data: AppData; layout: TosLayout }) {
  const doc = useMemo(() => buildTosDocument(tos, exam, data, layout), [tos, exam, data, layout]);
  const fileName = `${safeName(tos.subjectCode || tos.title)}_TOS_${layout === "horizontal" ? "Horizontal" : "Vertical"}.pdf`;
  return <PaginatedDocument spec={doc.spec} blocks={doc.blocks} fileName={fileName} title={doc.title} />;
}
