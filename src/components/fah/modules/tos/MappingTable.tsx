"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Eraser, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examItems } from "@/lib/fah/calc";
import type { Exam, Tos, TosMapping } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { ScrollTable, SourceBadge } from "../../common/ui";
import { excerpt, NONE } from "./tos-utils";

export function MappingTable({
  tos,
  exam,
  selected,
  onSelectedChange,
  onAssign,
  onRationale,
  onRemoveOrphans,
}: {
  tos: Tos;
  exam: Exam | undefined;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onAssign: (questionIds: string[], patch: { objectiveId?: string | null; level?: string | null }) => void;
  onRationale: (questionId: string, rationale: string) => void;
  onRemoveOrphans: () => void;
}) {
  const items = useMemo(() => (exam ? examItems(exam) : []), [exam]);
  const [filter, setFilter] = useState<"all" | "unassigned">("all");
  const byQ = useMemo(() => {
    const m = new Map<string, { mapping: TosMapping; count: number }>();
    tos.mappings.forEach((x) => {
      const cur = m.get(x.questionId);
      if (cur) cur.count++;
      else m.set(x.questionId, { mapping: x, count: 1 });
    });
    return m;
  }, [tos.mappings]);
  const itemIds = new Set(items.map((i) => i.questionId));
  const orphans = tos.mappings.filter((m) => !itemIds.has(m.questionId)).length;
  const objIds = new Set(tos.objectives.map((o) => o.id));

  const isUnassigned = (qid: string) => {
    const m = byQ.get(qid)?.mapping;
    return !m || !m.objectiveId || !objIds.has(m.objectiveId) || !m.level || !tos.levels.includes(m.level);
  };
  const unassignedCount = items.filter((i) => isUnassigned(i.questionId)).length;
  const shown = filter === "unassigned" ? items.filter((i) => isUnassigned(i.questionId)) : items;
  const allSel = shown.length > 0 && shown.every((i) => selected.includes(i.questionId));

  if (!exam) return <p className="text-sm text-red-700">The source exam no longer exists, so its items cannot be listed.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div role="radiogroup" aria-label="Filter items" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["all", "unassigned"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium", filter === f ? "bg-white text-[#1b2466] shadow-sm" : "text-slate-600")}
            >
              {f === "all" ? `All items (${items.length})` : `Unassigned (${unassignedCount})`}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Every exam item must be mapped to exactly one objective and one level — items cannot be excluded.</span>
      </div>

      {orphans > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="size-4" /> {orphans} mapping(s) refer to questions that were deleted from the exam.
          <Button size="sm" variant="outline" className="ml-auto h-7 border-red-300 bg-white text-red-800" onClick={onRemoveOrphans}>
            <Eraser className="size-3.5" /> Remove them
          </Button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky top-12 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-[#1b2466]/20 bg-[#1b2466]/5 px-3 py-2 text-sm">
          <span className="font-semibold text-[#1b2466]">{selected.length} selected</span>
          <Select key={`bo-${selected.length}-${tos.mappings.length}`} onValueChange={(v) => onAssign(selected, { objectiveId: v === NONE ? null : v })}>
            <SelectTrigger size="sm" className="w-56 bg-white text-xs" aria-label="Set objective for selected items">
              <SelectValue placeholder="Set objective…" />
            </SelectTrigger>
            <SelectContent>
              {tos.objectives.map((o, i) => (
                <SelectItem key={o.id} value={o.id}>
                  {`Obj. ${i + 1}: ${excerpt(o.label, 50) || "(no text)"}`}
                </SelectItem>
              ))}
              <SelectItem value={NONE}>Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Select key={`bl-${selected.length}-${tos.mappings.length}`} onValueChange={(v) => onAssign(selected, { level: v === NONE ? null : v })}>
            <SelectTrigger size="sm" className="w-44 bg-white text-xs" aria-label="Set level for selected items">
              <SelectValue placeholder="Set level…" />
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
          <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={() => onSelectedChange([])}>
            <X className="size-4" /> Clear selection
          </Button>
        </div>
      )}

      <ScrollTable minWidth={1120}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="w-9 px-2 py-2">
                <Checkbox
                  checked={allSel}
                  aria-label="Select all shown items"
                  onCheckedChange={(c) =>
                    onSelectedChange(c ? [...new Set([...selected, ...shown.map((i) => i.questionId)])] : selected.filter((s) => !shown.some((i) => i.questionId === s)))
                  }
                />
              </th>
              <th className="w-14 px-2 py-2 font-semibold">Item</th>
              <th className="w-40 px-2 py-2 font-semibold">Section · type</th>
              <th className="w-12 px-2 py-2 font-semibold">Pts</th>
              <th className="px-2 py-2 font-semibold">Question</th>
              <th className="w-56 px-2 py-2 font-semibold">Objective</th>
              <th className="w-40 px-2 py-2 font-semibold">Cognitive level</th>
              <th className="w-56 px-2 py-2 font-semibold">Rationale</th>
              <th className="w-28 px-2 py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              const entry = byQ.get(it.questionId);
              const m = entry?.mapping;
              const un = isUnassigned(it.questionId);
              const dup = (entry?.count ?? 0) > 1;
              const sel = selected.includes(it.questionId);
              const objVal = m?.objectiveId && objIds.has(m.objectiveId) ? m.objectiveId : NONE;
              const lvVal = m?.level && tos.levels.includes(m.level) ? m.level : NONE;
              return (
                <tr key={it.questionId} className={cn("border-t border-slate-100 align-top", sel && "bg-[#1b2466]/[0.04]", (un || dup) && "bg-red-50/50")}>
                  <td className="px-2 py-2">
                    <Checkbox
                      checked={sel}
                      aria-label={`Select item ${it.label}`}
                      onCheckedChange={(c) => onSelectedChange(c ? [...selected, it.questionId] : selected.filter((s) => s !== it.questionId))}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded bg-[#1b2466] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">{it.label}</span>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600">
                    <span className="block font-medium text-slate-700">{it.section.title || `Section ${it.sectionIndex + 1}`}</span>
                    {it.typeLabel}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{it.points}</td>
                  <td className="px-2 py-2 text-xs text-slate-700">
                    {excerpt(it.question.prompt, 140) || <em className="text-slate-400">No question text</em>}
                    <span className="mt-1 flex flex-wrap gap-1">
                      {it.question.subItems?.length ? (
                        <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">{it.question.subItems.length} sub-items · counts as 1</span>
                      ) : null}
                      {it.question.topic && <span className="rounded bg-sky-50 px-1.5 text-[10px] text-sky-800">{it.question.topic}</span>}
                      {it.question.cognitiveLevel && <span className="rounded bg-amber-50 px-1.5 text-[10px] text-amber-900">tag: {it.question.cognitiveLevel}</span>}
                    </span>
                    {(un || dup) && (
                      <span role="alert" className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-700">
                        <AlertTriangle className="size-3" />
                        {dup ? `Counted ${entry?.count} times — use “Update from exam” or fix duplicates.` : !m ? "Not in the TOS yet." : !m.objectiveId || !objIds.has(m.objectiveId) ? "Objective missing." : "Cognitive level missing."}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Select value={objVal} onValueChange={(v) => onAssign([it.questionId], { objectiveId: v === NONE ? null : v })}>
                      <SelectTrigger size="sm" className={cn("w-full bg-white text-xs", objVal === NONE && "border-red-300")} aria-label={`Objective for item ${it.label}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tos.objectives.map((o, i) => (
                          <SelectItem key={o.id} value={o.id}>
                            {`Obj. ${i + 1}: ${excerpt(o.label, 50) || "(no text)"}`}
                          </SelectItem>
                        ))}
                        <SelectItem value={NONE}>— Unassigned —</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Select value={lvVal} onValueChange={(v) => onAssign([it.questionId], { level: v === NONE ? null : v })}>
                      <SelectTrigger size="sm" className={cn("w-full bg-white text-xs", lvVal === NONE && "border-red-300")} aria-label={`Cognitive level for item ${it.label}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tos.levels.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                        <SelectItem value={NONE}>— Unassigned —</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={m?.rationale ?? ""}
                      onChange={(e) => onRationale(it.questionId, e.target.value)}
                      placeholder="Why this objective / level?"
                      className="h-8 bg-white text-xs"
                      aria-label={`Rationale for item ${it.label}`}
                    />
                  </td>
                  <td className="px-2 py-2">{m?.mappingSource ? <SourceBadge source={m.mappingSource} /> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                  {filter === "unassigned" ? "All items are assigned." : "The exam has no items."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
