"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examItems } from "@/lib/fah/calc";
import { runAi } from "@/lib/fah/services/ai";
import { buildMapTosInput, demoMapTos, validateMapTos, type MapTosResult } from "@/lib/fah/ai/demo/tos";
import type { Exam, Tos } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../common/ai-review";
import { ScrollTable } from "../../common/ui";
import { excerpt, NONE } from "./tos-utils";

type Scope = "all" | "unassigned" | "selected";

export interface AiMapRequest {
  ids: string[];
  nonce: number;
}

export function AiMappingPanel({
  tos,
  exam,
  selected,
  request,
  onApply,
}: {
  tos: Tos;
  exam: Exam | undefined;
  selected: string[];
  /** External trigger (auto-map after creation, update from exam). */
  request: AiMapRequest | null;
  onApply: (rows: MapTosResult["mappings"], mode: "live" | "demo") => void;
}) {
  const ai = useAiProposal<MapTosResult>();
  const [scope, setScope] = useState<Scope>("unassigned");
  const [accepted, setAccepted] = useState<string[]>([]);
  const lastNonce = useRef<number | null>(null);

  const scopeIds = (s: Scope): string[] => {
    if (!exam) return [];
    const items = examItems(exam);
    if (s === "selected") return selected.filter((id) => items.some((i) => i.questionId === id));
    if (s === "unassigned") {
      const objIds = new Set(tos.objectives.map((o) => o.id));
      return items
        .filter((i) => {
          const m = tos.mappings.find((x) => x.questionId === i.questionId);
          return !m || !m.objectiveId || !objIds.has(m.objectiveId) || !m.level || !tos.levels.includes(m.level);
        })
        .map((i) => i.questionId);
    }
    return items.map((i) => i.questionId);
  };

  const request_ = (ids: string[], forceDemo = false) => {
    if (!exam) throw new Error("The source exam is missing.");
    const input = buildMapTosInput(tos, exam, ids);
    console.log(`[tos] map-tos request for ${input.items.length} item(s), ${input.objectives.length} objective(s)`);
    return runAi<MapTosResult>("map-tos", input, {
      demo: () => demoMapTos(input),
      forceDemo,
      validate: (v) => validateMapTos(v, input),
    });
  };

  const generate = async (ids: string[], forceDemo = false) => {
    if (!exam) return toast.error("The source exam is missing.");
    if (!ids.length) return toast.info("No items in the chosen scope.");
    if (!tos.objectives.length) return toast.error("Add at least one objective before mapping items.");
    const r = await ai.run(() => request_(ids, forceDemo));
    if (r.ok === true) {
      setAccepted(r.data.mappings.filter((m) => m.objectiveId && m.level).map((m) => m.questionId));
      console.log(`[tos] proposal ready: ${r.data.mappings.length} row(s) (${r.mode})`);
    }
  };

  // External requests
  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;
    lastNonce.current = request.nonce;
    void generate(request.ids);
  }, [request]);

  const regenerateSelected = async () => {
    const prev = ai.proposal;
    const ids = accepted.length ? accepted : prev?.mappings.map((m) => m.questionId) ?? [];
    if (!prev || !ids.length) return;
    console.log(`[tos] regenerating ${ids.length} proposal row(s)`);
    const r = await ai.run(async () => {
      const res = await request_(ids);
      if (res.ok === true) {
        const repl = new Map(res.data.mappings.map((m) => [m.questionId, m]));
        return { ...res, data: { mappings: prev.mappings.map((m) => repl.get(m.questionId) ?? m), warnings: res.data.warnings } };
      }
      return res;
    });
    if (r.ok !== true) toast.error("Regeneration failed — the previous proposal was kept.");
  };

  const accept = () => {
    const p = ai.proposal;
    if (!p) return;
    const rows = p.mappings.filter((m) => accepted.includes(m.questionId));
    if (!rows.length) return toast.info("Tick the rows you want to accept.");
    onApply(rows, ai.mode === "demo" ? "demo" : "live");
    const rest = p.mappings.filter((m) => !accepted.includes(m.questionId));
    toast.success(`${rows.length} mapping(s) accepted`, { description: rest.length ? `${rest.length} proposal row(s) still waiting for review.` : undefined });
    if (rest.length) ai.edit({ ...p, mappings: rest });
    else ai.clear();
    setAccepted([]);
  };

  const itemById = new Map((exam ? examItems(exam) : []).map((i) => [i.questionId, i]));
  const currentOf = (qid: string) => tos.mappings.find((m) => m.questionId === qid);
  const objLabel = (id: string | null | undefined) => {
    const i = tos.objectives.findIndex((o) => o.id === id);
    return i >= 0 ? `Obj. ${i + 1}` : "—";
  };
  const rows = ai.proposal?.mappings ?? [];
  const allOn = rows.length > 0 && rows.every((r) => accepted.includes(r.questionId));

  return (
    <AiReviewPanel
      title="Propose item mappings"
      description="Suggests an objective and a cognitive level for each item, with a short rationale. Nothing changes until you accept rows; manual mappings outside the chosen rows are preserved."
      status={ai.status}
      mode={ai.mode}
      error={ai.error}
      warnings={ai.proposal?.warnings ?? []}
      generateLabel="Propose mappings"
      onGenerate={() => void generate(scopeIds(scope))}
      onUseDemo={() => void generate(scopeIds(scope), true)}
      canUseDemo={ai.canUseDemo}
      onAccept={accept}
      acceptLabel={`Accept selected (${accepted.length})`}
      onRegenerate={() => void regenerateSelected()}
      regenerateLabel={accepted.length ? `Regenerate selected (${accepted.length})` : "Regenerate all rows"}
      onReject={() => {
        ai.clear();
        setAccepted([]);
      }}
      controls={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="tos-ai-scope" className="text-xs font-medium text-slate-600">
            Items to map
          </label>
          <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <SelectTrigger id="tos-ai-scope" size="sm" className="w-64 bg-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">{`Unassigned items (${scopeIds("unassigned").length})`}</SelectItem>
              <SelectItem value="selected">{`Items selected in the table (${scopeIds("selected").length})`}</SelectItem>
              <SelectItem value="all">{`All items (${scopeIds("all").length}) — replaces on accept`}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <ScrollTable minWidth={980} className="max-h-[28rem] overflow-y-auto bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="w-9 px-2 py-2">
                <Checkbox checked={allOn} aria-label="Select all proposal rows" onCheckedChange={(c) => setAccepted(c ? rows.map((r) => r.questionId) : [])} />
              </th>
              <th className="w-14 px-2 py-2 font-semibold">Item</th>
              <th className="px-2 py-2 font-semibold">Question</th>
              <th className="w-56 px-2 py-2 font-semibold">Proposed objective</th>
              <th className="w-40 px-2 py-2 font-semibold">Proposed level</th>
              <th className="w-64 px-2 py-2 font-semibold">Rationale</th>
              <th className="w-28 px-2 py-2 font-semibold">Current</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const it = itemById.get(r.questionId);
              const cur = currentOf(r.questionId);
              const on = accepted.includes(r.questionId);
              const set = (patch: Partial<typeof r>) =>
                ai.edit((p) => ({ ...p, mappings: p.mappings.map((x) => (x.questionId === r.questionId ? { ...x, ...patch } : x)) }));
              return (
                <tr key={r.questionId} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={on}
                      aria-label={`Accept proposal for item ${it?.label ?? ""}`}
                      onCheckedChange={(c) => setAccepted((a) => (c ? [...a, r.questionId] : a.filter((x) => x !== r.questionId)))}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-mono font-semibold text-[#1b2466]">{it?.label ?? "?"}</td>
                  <td className="px-2 py-1.5 text-slate-700">{excerpt(it?.question.prompt ?? "", 110)}</td>
                  <td className="px-2 py-1.5">
                    <Select value={r.objectiveId ?? NONE} onValueChange={(v) => set({ objectiveId: v === NONE ? null : v })}>
                      <SelectTrigger size="sm" className="w-full bg-white text-xs" aria-label={`Proposed objective for item ${it?.label ?? ""}`}>
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
                  <td className="px-2 py-1.5">
                    <Select value={r.level ?? NONE} onValueChange={(v) => set({ level: v === NONE ? null : v })}>
                      <SelectTrigger size="sm" className="w-full bg-white text-xs" aria-label={`Proposed level for item ${it?.label ?? ""}`}>
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
                  <td className="px-2 py-1.5">
                    <Input value={r.rationale} onChange={(e) => set({ rationale: e.target.value })} className="h-8 bg-white text-xs" aria-label={`Rationale for item ${it?.label ?? ""}`} />
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">
                    {cur?.objectiveId || cur?.level ? `${objLabel(cur?.objectiveId)} · ${cur?.level ?? "—"}` : "unassigned"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollTable>
    </AiReviewPanel>
  );
}
