"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { examIssues, examTotals, sectionTotals, sectionTypeLabel, toRoman } from "@/lib/fah/calc";
import type { Exam } from "@/lib/fah/types";
import { cn } from "@/lib/utils";

/** Auto-calculated totals, per-section totals and planned-vs-actual warnings. */
export function ExamSummaryBar({ exam }: { exam: Exam }) {
  const [showIssues, setShowIssues] = useState(false);
  const t = examTotals(exam);
  const issues = examIssues(exam);
  return (
    <section aria-label="Exam summary" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-stretch gap-3">
        <Stat label="Total items" value={t.items} />
        <Stat label="Total points" value={t.points} accent />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {exam.sections.map((s, i) => {
            const st = sectionTotals(s);
            const off = s.plannedItems !== null && s.plannedItems !== undefined && s.plannedItems !== st.items;
            return (
              <a
                key={s.id}
                href={`#sec-${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-[#1b2466]/50",
                  off ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-700"
                )}
                title={off ? `Planned ${s.plannedItems} items, has ${st.items}` : undefined}
              >
                <span className="font-semibold">{s.title || `Test ${toRoman(i + 1)}`}</span> · {sectionTypeLabel(s)}
                <span className="ml-1 tabular-nums">
                  {st.items}
                  {s.plannedItems !== null && s.plannedItems !== undefined ? `/${s.plannedItems}` : ""} items · {st.points} pts
                </span>
              </a>
            );
          })}
          {!exam.sections.length && <span className="text-xs italic text-slate-400">No sections yet</span>}
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Sub-items (a, b, c) are part of their parent item: counted as one item, scored with the parent’s points. Totals update automatically.
      </p>
      {issues.length > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium" aria-expanded={showIssues} onClick={() => setShowIssues((v) => !v)}>
            <AlertTriangle className="size-4 shrink-0" /> {issues.length} item{issues.length === 1 ? "" : "s"} to review before export
            <ChevronDown className={cn("ml-auto size-4 transition", showIssues && "rotate-180")} />
          </button>
          {showIssues && (
            <ul className="list-disc space-y-0.5 px-3 pb-2 pl-8 text-xs">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="size-3.5" /> No issues — planned and actual item counts match.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("min-w-[7rem] rounded-xl px-4 py-2", accent ? "bg-[#1b2466] text-white" : "bg-amber-50 text-amber-950")}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-amber-300" : "text-amber-800")}>{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
