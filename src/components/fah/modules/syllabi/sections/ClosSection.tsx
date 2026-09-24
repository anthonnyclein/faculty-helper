"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ListOrdered, Plus, Sparkles, Target, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orderedPOs, poNumbers, weekLabel } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";
import { runAi } from "@/lib/fah/services/ai";
import { demoSuggestCloPos, validateCloPoResult, type CloPoResult } from "@/lib/fah/ai/demo/syllabus-outcomes";
import type { CLO, Syllabus, SyllabusPO } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../../common/ai-review";
import { ChipSelect, ConfirmDialog, DeleteIconButton, EmptyState, Panel, ReorderButtons, ScrollTable, SourceBadge } from "../../../common/ui";
import { moveItem } from "../../../common/utils";
import type { SectionProps } from "./types";

export function ClosSection({ syllabus, update, data }: SectionProps) {
  const [showAllPos, setShowAllPos] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<CLO | null>(null);
  const numbers = useMemo(() => poNumbers(syllabus), [syllabus]);
  const ordered = useMemo(() => orderedPOs(syllabus), [syllabus]);
  const addressed = useMemo(() => ordered.filter((p) => syllabus.addressedPoIds.includes(p.id)), [ordered, syllabus.addressedPoIds]);

  const updateClo = (id: string, patch: Partial<CLO>) => update((s) => ({ ...s, clos: s.clos.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const addClo = () => {
    const clo: CLO = { id: uid("clo"), code: `CLO ${syllabus.clos.length + 1}`, statement: "", poIds: [] };
    update((s) => ({ ...s, clos: [...s.clos, clo] }));
    console.log("[syllabus] CLO added", clo.id);
    setTimeout(() => document.getElementById(`clo-statement-${clo.id}`)?.focus(), 50);
  };

  const renumber = () => {
    update((s) => ({ ...s, clos: s.clos.map((c, i) => ({ ...c, code: `CLO ${i + 1}` })) }));
    toast.success("CLO codes renumbered");
  };

  const planRefs = (id: string) => syllabus.learningPlan.filter((l) => l.cloIds.includes(id));
  const externalRefs = (id: string) => {
    const exams = data.exams.filter((e) => e.syllabusId === syllabus.id && e.sections.some((s) => s.questions.some((q) => q.cloId === id)));
    const tos = data.tos.filter((t) => t.syllabusId === syllabus.id && t.objectives.some((o) => o.cloId === id));
    return { exams, tos };
  };

  const requestRemove = (c: CLO) => {
    const ext = externalRefs(c.id);
    if (!c.statement.trim() && !c.poIds.length && !planRefs(c.id).length && !ext.exams.length && !ext.tos.length) removeClo(c.id);
    else setPendingRemove(c);
  };

  const removeClo = (id: string) => {
    update((s) => ({
      ...s,
      clos: s.clos.filter((c) => c.id !== id),
      learningPlan: s.learningPlan.map((l) => (l.cloIds.includes(id) ? { ...l, cloIds: l.cloIds.filter((x) => x !== id) } : l)),
    }));
    console.log("[syllabus] CLO removed", id);
    setPendingRemove(null);
  };

  const togglePo = (cloId: string, poId: string) =>
    update((s) => ({
      ...s,
      clos: s.clos.map((c) =>
        c.id === cloId ? { ...c, poIds: c.poIds.includes(poId) ? c.poIds.filter((x) => x !== poId) : sortPo([...c.poIds, poId], numbers), mappingSource: "manual" } : c
      ),
    }));

  // Matrix columns: addressed POs + any PO a CLO maps to that is not marked as addressed (flagged).
  const matrixCols = useMemo(() => {
    const used = new Set(syllabus.clos.flatMap((c) => c.poIds));
    return ordered.filter((p) => syllabus.addressedPoIds.includes(p.id) || used.has(p.id));
  }, [ordered, syllabus.addressedPoIds, syllabus.clos]);
  const colCount = (poId: string) => syllabus.clos.filter((c) => c.poIds.includes(poId)).length;
  const uncovered = addressed.filter((p) => colCount(p.id) === 0);

  const pr = pendingRemove;
  const prPlan = pr ? planRefs(pr.id) : [];
  const prExt = pr ? externalRefs(pr.id) : { exams: [], tos: [] };

  return (
    <div className="space-y-6">
      <Panel
        title="F. Course Learning Outcomes"
        description="Write each CLO as an observable learning outcome, then link it to the Program Outcomes it supports."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={renumber} disabled={syllabus.clos.length === 0}>
              <ListOrdered className="size-4" /> Renumber codes
            </Button>
            <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={addClo}>
              <Plus className="size-4" /> Add CLO
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">
            {addressed.length
              ? `${addressed.length} Program Outcome(s) are marked as addressed by this course (Section E).`
              : "No Program Outcomes are marked as addressed yet — select them in Section E so CLOs can be linked and suggestions can run."}
          </p>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Switch checked={showAllPos} onCheckedChange={setShowAllPos} aria-label="Show POs not marked as addressed" />
            Show POs not marked as addressed
          </label>
        </div>

        {syllabus.clos.length === 0 ? (
          <EmptyState
            icon={<Target className="size-6" />}
            title="No Course Learning Outcomes yet"
            description="Add the first CLO. After you write its statement, PO links are suggested from the outcomes this course addresses."
            action={
              <Button className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={addClo}>
                <Plus className="size-4" /> Add CLO
              </Button>
            }
          />
        ) : (
          <ol className="space-y-4">
            {syllabus.clos.map((c, i) => (
              <CloRow
                key={c.id}
                clo={c}
                index={i}
                count={syllabus.clos.length}
                syllabus={syllabus}
                ordered={ordered}
                addressed={addressed}
                numbers={numbers}
                showAllPos={showAllPos}
                onChange={(patch) => updateClo(c.id, patch)}
                onMove={(from, to) => update((s) => ({ ...s, clos: moveItem(s.clos, from, to) }))}
                onRemove={() => requestRemove(c)}
              />
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="CLO–PO alignment matrix" description="Click a cell to link or unlink a CLO and a Program Outcome.">
        {syllabus.clos.length === 0 || matrixCols.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            The matrix appears once there are CLOs and addressed Program Outcomes.
          </p>
        ) : (
          <>
            {uncovered.length > 0 && (
              <p role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {uncovered.map((p) => `PO ${numbers.get(p.id)}`).join(", ")} {uncovered.length === 1 ? "is" : "are"} marked as addressed but not covered by any CLO.
              </p>
            )}
            <ScrollTable minWidth={Math.max(480, 220 + matrixCols.length * 64)}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1b2466] text-white">
                    <th scope="col" className="sticky left-0 z-10 min-w-[200px] bg-[#1b2466] px-3 py-2 text-left font-display font-semibold">
                      CLO
                    </th>
                    {matrixCols.map((p) => {
                      const notAddressed = !syllabus.addressedPoIds.includes(p.id);
                      const zero = colCount(p.id) === 0;
                      return (
                        <th
                          key={p.id}
                          scope="col"
                          title={p.description}
                          className={cn("min-w-[64px] whitespace-nowrap px-2 py-2 text-center text-xs font-semibold", zero && "bg-amber-400 text-[#1b2466]", notAddressed && "bg-red-200 text-red-900")}
                        >
                          PO {numbers.get(p.id)}
                          {notAddressed && <span className="block text-[9px] font-medium normal-case">not addressed</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {syllabus.clos.map((c) => (
                    <tr key={c.id} className="border-t border-slate-200 even:bg-slate-50/60">
                      <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left align-top font-normal" title={c.statement}>
                        <span className="font-semibold text-[#1b2466]">{c.code || "CLO"}</span>
                        <span className="ml-2 line-clamp-2 text-xs text-slate-500">{c.statement || "No statement yet"}</span>
                      </th>
                      {matrixCols.map((p) => {
                        const on = c.poIds.includes(p.id);
                        return (
                          <td key={p.id} className="border-l border-slate-100 p-1 text-center">
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${c.code || "CLO"} supports PO ${numbers.get(p.id)}`}
                              onClick={() => togglePo(c.id, p.id)}
                              className={cn(
                                "mx-auto flex size-8 items-center justify-center rounded-md border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40",
                                on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-transparent hover:border-[#1b2466]/40 hover:text-slate-300"
                              )}
                            >
                              <Check className="size-4" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 text-xs">
                    <th scope="row" className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">
                      CLOs per PO
                    </th>
                    {matrixCols.map((p) => {
                      const n = colCount(p.id);
                      return (
                        <td key={p.id} className={cn("px-2 py-2 text-center font-semibold", n === 0 ? "text-amber-700" : "text-slate-700")}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </ScrollTable>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={!!pr}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        title={`Remove ${pr?.code || "this CLO"}?`}
        confirmLabel="Remove CLO"
        destructive
        onConfirm={() => pr && removeClo(pr.id)}
        description={
          pr && (
            <div className="space-y-2 text-sm">
              {pr.statement && <p className="italic text-slate-600">“{pr.statement}”</p>}
              {prPlan.length > 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
                  It is linked in the Course Learning Plan at {prPlan.map((l) => weekLabel(l.weekStart, l.weekEnd)).join(", ")}. Those links will be removed.
                </p>
              )}
              {(prExt.exams.length > 0 || prExt.tos.length > 0) && (
                <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-900">
                  Also referenced by {prExt.exams.length ? `exam(s) ${prExt.exams.map((e) => e.title || e.term).join(", ")}` : ""}
                  {prExt.exams.length && prExt.tos.length ? " and " : ""}
                  {prExt.tos.length ? `TOS ${prExt.tos.map((t) => t.title).join(", ")}` : ""}. Those links will show as missing until you update them there.
                </p>
              )}
              <p>Other CLO codes are not changed automatically — use “Renumber codes” if needed.</p>
            </div>
          )
        }
      />
    </div>
  );
}

function sortPo(ids: string[], numbers: Map<string, number>) {
  return [...ids].sort((a, b) => (numbers.get(a) ?? 999) - (numbers.get(b) ?? 999));
}

/* ------------------------------------------------------------------ */
/* Single CLO row with PO suggestions                                  */
/* ------------------------------------------------------------------ */

function CloRow({
  clo,
  index,
  count,
  syllabus,
  ordered,
  addressed,
  numbers,
  showAllPos,
  onChange,
  onMove,
  onRemove,
}: {
  clo: CLO;
  index: number;
  count: number;
  syllabus: Syllabus;
  ordered: SyllabusPO[];
  addressed: SyllabusPO[];
  numbers: Map<string, number>;
  showAllPos: boolean;
  onChange: (patch: Partial<CLO>) => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const ai = useAiProposal<CloPoResult>();
  const lastSuggested = useRef(clo.statement.trim());

  const options = (showAllPos ? ordered : ordered.filter((p) => addressed.includes(p) || clo.poIds.includes(p.id))).map((p) => ({
    value: p.id,
    label: `PO ${numbers.get(p.id)}${syllabus.addressedPoIds.includes(p.id) ? "" : " (not addressed)"}`,
    title: p.description,
  }));
  const invalidIds = clo.poIds.filter((id) => !syllabus.programOutcomes.some((p) => p.id === id));
  const unaddressed = clo.poIds.filter((id) => !invalidIds.includes(id) && !syllabus.addressedPoIds.includes(id));

  const canSuggest = clo.statement.trim().length > 15 && addressed.length > 0;

  const suggest = (forceDemo = false) => {
    const statement = clo.statement.trim();
    lastSuggested.current = statement;
    const pos = addressed.map((p) => ({ id: p.id, label: `PO ${numbers.get(p.id)}`, description: p.description }));
    const allowed = pos.map((p) => p.id);
    console.log("[syllabus] suggest CLO→PO", { cloId: clo.id, candidates: allowed.length });
    return ai.run(() =>
      runAi<CloPoResult>(
        "suggest-clo-pos",
        { clo: { code: clo.code, statement }, pos },
        { demo: () => demoSuggestCloPos({ clo: { statement }, pos }), forceDemo, validate: (v) => validateCloPoResult(v, allowed) }
      )
    );
  };

  const onBlurStatement = () => {
    const st = clo.statement.trim();
    if (st.length > 15 && st !== lastSuggested.current && addressed.length > 0 && ai.status !== "running") void suggest();
  };

  const acceptIds = (ids: string[]) => {
    if (!ai.proposal) return;
    const accepted = ai.proposal.suggestions.filter((s) => ids.includes(s.poId) && syllabus.addressedPoIds.includes(s.poId));
    if (!accepted.length) {
      ai.clear();
      return;
    }
    const note = accepted.map((s) => `PO ${numbers.get(s.poId)}: ${s.explanation}`).join(" ");
    onChange({
      poIds: sortPo(Array.from(new Set([...clo.poIds, ...accepted.map((s) => s.poId)])), numbers),
      alignmentNote: note,
      mappingSource: ai.mode === "live" ? "ai" : "demo",
    });
    console.log("[syllabus] CLO→PO accepted", { cloId: clo.id, poIds: accepted.map((s) => s.poId), mode: ai.mode });
    const rest = ai.proposal.suggestions.filter((s) => !ids.includes(s.poId));
    if (rest.length) ai.edit((p) => ({ ...p, suggestions: rest }));
    else ai.clear();
  };

  const rejectId = (id: string) => {
    if (!ai.proposal) return;
    const rest = ai.proposal.suggestions.filter((s) => s.poId !== id);
    if (rest.length) ai.edit((p) => ({ ...p, suggestions: rest }));
    else ai.clear();
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs md:p-4">
      <div className="flex gap-2">
        <ReorderButtons index={index} count={count} onMove={onMove} label={clo.code || `CLO ${index + 1}`} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="w-28 shrink-0">
              <label htmlFor={`clo-code-${clo.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                Code
              </label>
              <Input id={`clo-code-${clo.id}`} value={clo.code} placeholder={`CLO ${index + 1}`} className="h-9 font-semibold text-[#1b2466]" onChange={(e) => onChange({ code: e.target.value })} />
            </div>
            <div className="min-w-[220px] flex-1">
              <label htmlFor={`clo-statement-${clo.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                Statement <span className="text-red-600" aria-hidden>*</span>
              </label>
              <Textarea
                id={`clo-statement-${clo.id}`}
                rows={2}
                value={clo.statement}
                placeholder="e.g. Design and implement responsive web pages using HTML, CSS and JavaScript."
                aria-invalid={!clo.statement.trim() || undefined}
                onChange={(e) => onChange({ statement: e.target.value })}
                onBlur={onBlurStatement}
                className="leading-relaxed"
              />
            </div>
            <DeleteIconButton label={`Remove ${clo.code || "CLO"}`} onClick={onRemove} />
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Corresponding POs</p>
              <SourceBadge source={clo.poIds.length ? clo.mappingSource : undefined} />
            </div>
            <ChipSelect
              ariaLabel={`Corresponding POs for ${clo.code || "CLO"}`}
              options={options}
              value={clo.poIds}
              onChange={(v) => onChange({ poIds: sortPo(v, numbers), mappingSource: "manual" })}
              emptyText="No addressed POs — select them in Section E, or turn on “Show POs not marked as addressed”."
            />
            {unaddressed.length > 0 && (
              <p className="mt-1.5 text-xs text-amber-700">
                {unaddressed.map((id) => `PO ${numbers.get(id)}`).join(", ")} {unaddressed.length === 1 ? "is" : "are"} not marked as addressed in Section E.
              </p>
            )}
            {invalidIds.length > 0 && (
              <p className="mt-1.5 text-xs text-red-700">
                Refers to {invalidIds.length} removed PO(s).{" "}
                <button type="button" className="font-medium underline" onClick={() => onChange({ poIds: clo.poIds.filter((id) => !invalidIds.includes(id)) })}>
                  Clean up
                </button>
              </p>
            )}
            {clo.alignmentNote && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{clo.alignmentNote}</p>}
          </div>

          {(ai.status !== "idle" || canSuggest) && (
            <AiReviewPanel
              compact
              title="Suggested POs"
              status={ai.status}
              mode={ai.mode}
              error={ai.error}
              generateLabel="Suggest POs"
              onGenerate={() => void suggest()}
              onRegenerate={() => void suggest()}
              onUseDemo={() => void suggest(true)}
              canUseDemo={ai.canUseDemo}
              onAccept={() => ai.proposal && acceptIds(ai.proposal.suggestions.map((s) => s.poId))}
              acceptLabel="Accept all"
              onReject={() => ai.clear()}
            >
              {ai.proposal && ai.proposal.suggestions.length === 0 && (
                <p className="text-xs text-slate-600">No clear match among the addressed POs. Link POs manually or refine the statement.</p>
              )}
              {ai.proposal && ai.proposal.suggestions.length > 0 && (
                <ul className="space-y-1.5">
                  {ai.proposal.suggestions.map((s) => {
                    const already = clo.poIds.includes(s.poId);
                    return (
                      <li key={s.poId} className="flex flex-wrap items-start gap-2 rounded-md border border-violet-100 bg-white px-2.5 py-1.5">
                        <span className="shrink-0 rounded bg-violet-100 px-1.5 text-xs font-semibold text-violet-900">PO {numbers.get(s.poId)}</span>
                        <span className="min-w-0 flex-1 text-xs text-slate-700">
                          {s.explanation}
                          {already && <span className="ml-1 text-emerald-700">(already linked)</span>}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => acceptIds([s.poId])} aria-label={`Accept PO ${numbers.get(s.poId)}`}>
                            <Check className="size-3" /> Accept
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => rejectId(s.poId)} aria-label={`Reject PO ${numbers.get(s.poId)}`}>
                            <X className="size-3" /> Reject
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AiReviewPanel>
          )}
          {ai.status === "idle" && !canSuggest && clo.statement.trim().length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Sparkles className="size-3.5" />
              {addressed.length === 0 ? "PO suggestions need addressed POs (Section E)." : "Write a longer statement to get PO suggestions."}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
