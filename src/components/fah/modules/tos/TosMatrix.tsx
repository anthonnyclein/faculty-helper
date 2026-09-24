"use client";

import { useState } from "react";
import { ArrowRightLeft, Hash, ListOrdered } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cellKey, examItems, fmtPct, round2, type ExamItemRef, type TosComputed } from "@/lib/fah/calc";
import { placementText, TOS_LAYOUT_TITLE, type TosLayout } from "@/lib/fah/documents/tos";
import type { Exam, Syllabus, Tos } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { ScrollTable } from "../../common/ui";
import { excerpt, NONE } from "./tos-utils";

export type AssignFn = (questionIds: string[], patch: { objectiveId?: string | null; level?: string | null }) => void;

/* ------------------------------------------------------------------ */
/* Numbering toggle                                                    */
/* ------------------------------------------------------------------ */

export function NumberingToggle({ value, onChange }: { value: Tos["numbering"]; onChange: (v: Tos["numbering"]) => void }) {
  const opts: { v: Tos["numbering"]; label: string; icon: React.ReactNode; hint: string }[] = [
    { v: "placement", label: "Placement numbers", icon: <ListOrdered className="size-3.5" />, hint: "Template definition: sequential placement numbers (row-wise for Horizontal, column-wise for Vertical)." },
    { v: "exam", label: "Actual exam numbers", icon: <Hash className="size-3.5" />, hint: "Shows the real exam item labels in both layouts." },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label="Item numbering" className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40",
              value === o.v ? "bg-[#1b2466] text-white shadow-sm" : "text-slate-600 hover:text-[#1b2466]"
            )}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{opts.find((o) => o.v === value)?.hint}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live matrix                                                         */
/* ------------------------------------------------------------------ */

export function TosMatrix({
  tos,
  exam,
  syllabus,
  computed,
  layout,
  lowerOrderCount,
  onAssign,
}: {
  tos: Tos;
  exam: Exam | undefined;
  syllabus?: Syllabus;
  computed: TosComputed;
  layout: TosLayout;
  lowerOrderCount: number;
  onAssign: AssignFn;
}) {
  const levels = tos.levels;
  const N = Math.max(1, levels.length);
  const lower = Math.min(N, lowerOrderCount);
  const has = computed.totalCount > 0;
  const allItems = exam ? examItems(exam) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {layout === "horizontal"
          ? "Horizontal Item Placement: placement numbers run across each objective row (left to right), then continue on the next row."
          : "Vertical Item Placement: placement numbers run down each level column (top to bottom), then continue in the next column."}{" "}
        Click a count to see its items and move them to another objective or level.
      </p>
      <ScrollTable minWidth={940}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th rowSpan={2} className="w-[20%] border border-slate-300 px-2 py-2 text-left font-semibold">
                Test Objectives
              </th>
              <th rowSpan={2} className="w-[11%] border border-slate-300 px-2 py-2 text-left font-semibold">
                Test Types
              </th>
              <th colSpan={N} className="border border-slate-300 px-2 py-1.5 text-center font-semibold">
                Levels of Thinking
              </th>
              <th rowSpan={2} className="w-[7%] border border-slate-300 px-2 py-2 text-center font-semibold">
                TOTAL
              </th>
            </tr>
            <tr className="bg-slate-50 text-xs text-slate-600">
              {levels.map((l, i) => (
                <th key={l} className={cn("border border-slate-300 px-1 py-1.5 text-center font-semibold", i === lower && "border-l-2 border-l-slate-500")}>
                  {l}
                  <span className="block text-[10px] font-normal text-slate-400">{i < lower ? "Lower-order" : "Higher-order"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tos.objectives.length === 0 && (
              <tr>
                <td colSpan={N + 3} className="border border-slate-300 px-3 py-6 text-center text-sm italic text-slate-500">
                  No objectives yet — add objectives in the Setup tab.
                </td>
              </tr>
            )}
            {tos.objectives.map((o, oi) => {
              const rt = computed.rowTotals.get(o.id);
              const clo = o.cloId ? syllabus?.clos.find((c) => c.id === o.cloId) : undefined;
              return [
                <tr key={`${o.id}-a`} className={cn(oi % 2 === 1 && "bg-slate-50/40")}>
                  <td rowSpan={2} className="border border-slate-300 px-2 py-1.5 align-top text-xs leading-snug text-slate-800">
                    {o.label.trim() || <span className="italic text-slate-400">Objective {oi + 1} (no text)</span>}
                    {clo && <span className="mt-1 block w-fit rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-900">{clo.code}</span>}
                  </td>
                  <td rowSpan={2} className="border border-slate-300 px-2 py-1.5 align-top text-xs text-slate-600">
                    {(rt?.testTypes ?? []).map((t) => (
                      <span key={t} className="block">
                        {t}
                      </span>
                    ))}
                  </td>
                  {levels.map((l, i) => {
                    const c = computed.cells.get(cellKey(o.id, l));
                    return (
                      <td key={l} className={cn("border border-slate-300 p-0 text-center", i === lower && "border-l-2 border-l-slate-500")}>
                        <CellPopover
                          tos={tos}
                          objectiveLabel={o.label || `Objective ${oi + 1}`}
                          objectiveId={o.id}
                          level={l}
                          items={c?.items ?? []}
                          allItems={allItems}
                          onAssign={onAssign}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 text-center text-base font-bold text-[#1b2466]">{rt?.count ?? 0}</td>
                </tr>,
                <tr key={`${o.id}-b`} className={cn(oi % 2 === 1 && "bg-slate-50/40")}>
                  {levels.map((l, i) => (
                    <td key={l} className={cn("border border-slate-300 px-1 py-1 text-center text-[11px] italic text-slate-600", i === lower && "border-l-2 border-l-slate-500")}>
                      {placementText(tos, exam, computed, o.id, l, layout)}
                    </td>
                  ))}
                  <td className="border border-slate-300" />
                </tr>,
              ];
            })}
            <SummaryRow label="Subtotal Based on Taxonomy Marks" levels={levels} lower={lower} total={computed.totalCount} strong get={(l) => computed.colTotals.get(l)?.count ?? 0} />
            <tr className="border-t-2 border-slate-500">
              <td colSpan={2} rowSpan={2} className="border border-slate-300 bg-slate-100 px-2 py-1.5 align-top text-xs font-semibold text-slate-700">
                Percentage Distribution
              </td>
              {levels.map((l, i) => (
                <td key={l} className={cn("border border-slate-300 px-1 py-1 text-center text-xs font-semibold tabular-nums", i === lower && "border-l-2 border-l-slate-500")}>
                  {has ? fmtPct(computed.colTotals.get(l)?.percent ?? 0) : "—"}
                </td>
              ))}
              <td rowSpan={2} className="border border-slate-300 text-center font-bold text-[#1b2466]">
                {has ? "100%" : "0%"}
              </td>
            </tr>
            <tr>
              {lower > 0 && (
                <td colSpan={lower} className="border border-slate-300 bg-sky-50/60 py-1 text-center text-sm font-bold text-sky-900">
                  {has ? `${round2(computed.groupPercents[0]?.percent ?? 0)}%` : "—"} <span className="text-[10px] font-normal">lower-order</span>
                </td>
              )}
              {N - lower > 0 && (
                <td colSpan={N - lower} className="border border-slate-300 border-l-2 border-l-slate-500 bg-amber-50/60 py-1 text-center text-sm font-bold text-amber-900">
                  {has ? `${round2(computed.groupPercents[1]?.percent ?? 0)}%` : "—"} <span className="text-[10px] font-normal">higher-order</span>
                </td>
              )}
            </tr>
            <SummaryRow label="Scoring Points Per Item" levels={levels} lower={lower} total="" get={(l) => computed.colTotals.get(l)?.pointsPerItem ?? ""} />
            <SummaryRow
              label="Total Scoring Points"
              levels={levels}
              lower={lower}
              total={computed.totalPoints}
              strong
              get={(l) => (computed.colTotals.get(l)?.count ? computed.colTotals.get(l)!.points : "")}
            />
          </tbody>
        </table>
      </ScrollTable>

      <PlacementKey tos={tos} computed={computed} layout={layout} exam={exam} />
    </div>
  );
}

function SummaryRow({
  label,
  levels,
  lower,
  total,
  get,
  strong,
}: {
  label: string;
  levels: string[];
  lower: number;
  total: string | number;
  get: (l: string) => string | number;
  strong?: boolean;
}) {
  return (
    <tr className="border-t-2 border-slate-500">
      <td colSpan={2} className="border border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700">
        {label}
      </td>
      {levels.map((l, i) => (
        <td key={l} className={cn("border border-slate-300 px-1 py-1.5 text-center tabular-nums", strong ? "font-semibold" : "text-xs", i === lower && "border-l-2 border-l-slate-500")}>
          {get(l)}
        </td>
      ))}
      <td className="border border-slate-300 text-center font-bold tabular-nums text-[#1b2466]">{total}</td>
    </tr>
  );
}

function CellPopover({
  tos,
  objectiveId,
  objectiveLabel,
  level,
  items,
  allItems,
  onAssign,
}: {
  tos: Tos;
  objectiveId: string;
  objectiveLabel: string;
  level: string;
  items: ExamItemRef[];
  allItems: ExamItemRef[];
  onAssign: AssignFn;
}) {
  const [open, setOpen] = useState(false);
  const inCell = new Set(items.map((i) => i.questionId));
  const others = allItems.filter((i) => !inCell.has(i.questionId));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-14 w-full items-center justify-center text-lg tabular-nums transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1b2466]/40",
            items.length ? "font-semibold text-slate-900" : "text-slate-300"
          )}
          aria-label={`${objectiveLabel.slice(0, 40)} · ${level}: ${items.length} item(s). Open to review or move items.`}
        >
          {items.length || "·"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] max-w-[92vw] p-0" align="center">
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{level}</p>
          <p className="line-clamp-2 text-sm font-medium text-slate-800">{objectiveLabel}</p>
        </div>
        <div className="max-h-72 space-y-2 overflow-auto px-3 py-2">
          {items.length === 0 && <p className="py-2 text-center text-xs italic text-slate-500">No items in this cell.</p>}
          {items.map((it) => (
            <div key={it.questionId} className="rounded-lg border border-slate-200 p-2">
              <p className="text-xs text-slate-700">
                <span className="mr-1 rounded bg-[#1b2466] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{it.label}</span>
                <span className="text-slate-500">
                  {it.typeLabel} · {it.points} pt
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">{excerpt(it.question.prompt, 120) || <em>No question text</em>}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Select value={objectiveId} onValueChange={(v) => onAssign([it.questionId], { objectiveId: v === NONE ? null : v })}>
                  <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label={`Objective for item ${it.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tos.objectives.map((o, i) => (
                      <SelectItem key={o.id} value={o.id}>
                        {`Obj. ${i + 1}: ${excerpt(o.label, 40) || "(no text)"}`}
                      </SelectItem>
                    ))}
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={level} onValueChange={(v) => onAssign([it.questionId], { level: v === NONE ? null : v })}>
                  <SelectTrigger size="sm" className="h-7 w-full text-xs" aria-label={`Level for item ${it.label}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tos.levels.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
        {others.length > 0 && (
          <div className="border-t border-slate-100 px-3 py-2">
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <ArrowRightLeft className="size-3.5" /> Move another item into this cell
            </label>
            <Select key={`mv-${items.length}-${others.length}`} onValueChange={(qid) => onAssign([qid], { objectiveId, level })}>
              <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label="Move an item into this cell">
                <SelectValue placeholder="Choose an exam item…" />
              </SelectTrigger>
              <SelectContent>
                {others.map((i) => (
                  <SelectItem key={i.questionId} value={i.questionId}>
                    {`${i.label} · ${excerpt(i.question.prompt, 48)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Placement key                                                       */
/* ------------------------------------------------------------------ */

export function PlacementKey({ tos, computed, layout, exam }: { tos: Tos; computed: TosComputed; layout: TosLayout; exam: Exam | undefined }) {
  const key = layout === "horizontal" ? computed.horizontalKey : computed.verticalKey;
  const cellOf = new Map<string, { objective: number; level: string }>();
  tos.objectives.forEach((o, oi) =>
    tos.levels.forEach((l) => computed.cells.get(cellKey(o.id, l))?.items.forEach((it) => cellOf.set(it.questionId, { objective: oi + 1, level: l })))
  );
  const matches = key.filter((k) => String(k.placement) === k.item.label).length;
  return (
    <details className="group rounded-xl border border-slate-200 bg-white" open={key.length > 0 && key.length <= 60}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[#1b2466]">
        Placement key — {TOS_LAYOUT_TITLE[layout]} ({key.length} item{key.length === 1 ? "" : "s"})
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="mb-2 text-xs text-slate-600">
          Placement number → exam item. To follow the {layout} layout, arrange the exam so that item <em>n</em> is the question listed at placement <em>n</em>.
          {key.length > 0 && (matches === key.length ? " The exam already follows this order." : ` ${key.length - matches} item(s) are currently in a different position.`)}
          {tos.numbering === "exam" && " (The table is currently showing actual exam numbers.)"}
        </p>
        {key.length === 0 ? (
          <p className="text-xs italic text-slate-500">No mapped items yet.</p>
        ) : (
          <ScrollTable minWidth={620} className="max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Placement</th>
                  <th className="px-2 py-1.5 font-semibold">Exam item</th>
                  <th className="px-2 py-1.5 font-semibold">Section</th>
                  <th className="px-2 py-1.5 font-semibold">Objective · Level</th>
                  <th className="px-2 py-1.5 font-semibold">Question</th>
                </tr>
              </thead>
              <tbody>
                {key.map((k) => {
                  const c = cellOf.get(k.item.questionId);
                  const same = String(k.placement) === k.item.label;
                  return (
                    <tr key={`${k.placement}-${k.item.questionId}`} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-mono font-semibold text-[#1b2466]">{k.placement}</td>
                      <td className={cn("px-2 py-1 font-mono", !same && "text-amber-800")}>{k.item.label}</td>
                      <td className="px-2 py-1 text-slate-600">{k.item.section.title || `Section ${k.item.sectionIndex + 1}`}</td>
                      <td className="px-2 py-1 text-slate-600">{c ? `Obj. ${c.objective} · ${c.level}` : "—"}</td>
                      <td className="px-2 py-1 text-slate-600">{excerpt(k.item.question.prompt, 70)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
        {!exam && <p className="mt-2 text-xs text-red-700">The source exam is missing.</p>}
      </div>
    </details>
  );
}
