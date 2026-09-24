"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowRight, BookMarked, CheckCheck, ChevronDown, ChevronUp, Library, Lock, Plus, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PO_CATEGORIES, orderedPOs, poNumbers } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";
import { runAi } from "@/lib/fah/services/ai";
import { demoSuggestPeos, validatePeoSuggestion, type PeoSuggestion } from "@/lib/fah/ai/demo/syllabus-outcomes";
import type { AppData, InstitutionalPO, LibraryPO, POCategory, Syllabus, SyllabusPO } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../../common/ai-review";
import { ChipSelect, ConfirmDialog, DeleteIconButton, EmptyState, Panel, SourceBadge } from "../../../common/ui";
import { href } from "../../../common/router";
import type { SectionProps } from "./types";

const TEMPLATE_CATS = [1, 4, 5] as const;
type TemplateCat = (typeof TEMPLATE_CATS)[number];

function instList(inst: AppData["institutional"], c: TemplateCat): InstitutionalPO[] {
  return c === 1 ? inst.category1 : c === 4 ? inst.category4 : inst.category5;
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** Rebuild template categories from the institutional configuration, keeping ids of POs whose text is unchanged. */
function recopyTemplate(s: Syllabus, inst: AppData["institutional"]) {
  const removed: SyllabusPO[] = [];
  const next: SyllabusPO[] = [];
  for (const c of PO_CATEGORIES) {
    const existing = s.programOutcomes.filter((p) => p.category === c);
    if (c === 2 || c === 3) {
      next.push(...existing);
      continue;
    }
    const pool = existing.filter((p) => p.source === "template");
    const used = new Set<string>();
    instList(inst, c as TemplateCat).forEach((ip) => {
      const match = pool.find((p) => !used.has(p.id) && clean(p.description) === clean(ip.description));
      if (match) used.add(match.id);
      next.push({
        id: match?.id ?? uid("spo"),
        category: c,
        description: ip.description,
        peos: [...ip.peos],
        source: "template",
        mappingSource: "template",
      });
    });
    removed.push(...pool.filter((p) => !used.has(p.id)));
    // Any non-template entries in a template category are preserved (should not normally exist).
    next.push(...existing.filter((p) => p.source !== "template"));
  }
  return { next, removed };
}

/** Removes PO ids from addressed list and CLO mappings. */
function withoutPOs(s: Syllabus, ids: Set<string>): Syllabus {
  return {
    ...s,
    programOutcomes: s.programOutcomes.filter((p) => !ids.has(p.id)),
    addressedPoIds: s.addressedPoIds.filter((id) => !ids.has(id)),
    clos: s.clos.map((c) => (c.poIds.some((id) => ids.has(id)) ? { ...c, poIds: c.poIds.filter((id) => !ids.has(id)) } : c)),
  };
}

function referencesTo(s: Syllabus, ids: Set<string>) {
  return {
    clos: s.clos.filter((c) => c.poIds.some((id) => ids.has(id))),
    addressed: s.addressedPoIds.some((id) => ids.has(id)),
  };
}

export function ProgramOutcomesSection({ syllabus, update, data }: SectionProps) {
  const inst = data.institutional;
  const numbers = useMemo(() => poNumbers(syllabus), [syllabus]);
  const ordered = useMemo(() => orderedPOs(syllabus), [syllabus]);
  const [autoSuggestId, setAutoSuggestId] = useState<string | null>(null);
  const [recopyOpen, setRecopyOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SyllabusPO | null>(null);

  const templateDiffers = useMemo(
    () =>
      TEMPLATE_CATS.some((c) => {
        const a = syllabus.programOutcomes.filter((p) => p.category === c && p.source === "template").map((p) => [clean(p.description), p.peos]);
        const b = instList(inst, c).map((p) => [clean(p.description), p.peos]);
        return JSON.stringify(a) !== JSON.stringify(b);
      }),
    [syllabus.programOutcomes, inst]
  );
  const recopyPreview = useMemo(() => (recopyOpen ? recopyTemplate(syllabus, inst) : null), [recopyOpen, syllabus, inst]);
  const recopyRefs = recopyPreview ? referencesTo(syllabus, new Set(recopyPreview.removed.map((p) => p.id))) : null;

  const applyRecopy = () => {
    update((s) => {
      const { next, removed } = recopyTemplate(s, inst);
      const cleaned = withoutPOs({ ...s, programOutcomes: next }, new Set(removed.map((p) => p.id)));
      console.log("[syllabus] template outcomes re-copied", { removed: removed.length, total: next.length });
      return cleaned;
    });
    toast.success("Template outcomes re-copied", { description: "Save the syllabus to keep the change." });
    setRecopyOpen(false);
  };

  const addFromLibrary = (lib: LibraryPO) => {
    const po: SyllabusPO = {
      id: uid("spo"),
      category: lib.category === "discipline" ? 2 : 3,
      description: lib.description,
      peos: [],
      source: "library",
      libraryId: lib.id,
      libraryVersion: lib.version,
    };
    update((s) => ({ ...s, programOutcomes: [...s.programOutcomes, po] }));
    setAutoSuggestId(po.id);
    console.log("[syllabus] library PO added", { libraryId: lib.id, poId: po.id });
  };

  const removeRefs = pendingRemove ? referencesTo(syllabus, new Set([pendingRemove.id])) : null;
  const applyRemove = () => {
    if (!pendingRemove) return;
    const id = pendingRemove.id;
    update((s) => withoutPOs(s, new Set([id])));
    console.log("[syllabus] PO removed", id);
    toast.success("Program outcome removed");
    setPendingRemove(null);
  };

  const updatePO = (id: string, patch: Partial<SyllabusPO>) =>
    update((s) => ({ ...s, programOutcomes: s.programOutcomes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const cloUsedPoIds = useMemo(() => new Set(syllabus.clos.flatMap((c) => c.poIds)), [syllabus.clos]);
  const sortByNumber = (ids: string[]) => [...ids].sort((a, b) => (numbers.get(a) ?? 999) - (numbers.get(b) ?? 999));

  return (
    <div className="space-y-6">
      {templateDiffers && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-start">
          <TriangleAlert className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold">Template-prescribed outcomes differ from the institutional configuration.</p>
            <p className="mt-0.5 text-amber-900">Categories 1, 4 and 5 in this syllabus are an earlier copy. Nothing changes until you re-copy them.</p>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 bg-white" onClick={() => setRecopyOpen(true)}>
            <RefreshCw className="size-4" /> Re-copy template outcomes
          </Button>
        </div>
      )}

      <Panel
        title="D. Program Outcomes and PEO alignment"
        description="Outcomes are numbered sequentially across the five categories, exactly as printed."
      >
        <div className="space-y-6">
          {PO_CATEGORIES.map((c) => {
            const list = ordered.filter((p) => p.category === c);
            const editable = c === 2 || c === 3;
            return (
              <section key={c} aria-labelledby={`po-cat-${c}`} className="rounded-xl border border-slate-200">
                <header className="flex flex-wrap items-center gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#1b2466] text-xs font-bold text-amber-300">{c}</span>
                  <h3 id={`po-cat-${c}`} className="font-display text-sm font-semibold text-[#1b2466]">
                    {inst.poCategoryTitles[c]}
                  </h3>
                  {editable ? (
                    <Badge variant="outline" className="ml-auto border-teal-300 bg-teal-50 text-teal-800">
                      <Library className="size-3" /> Chosen from IT Program Outcomes library
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-auto border-sky-300 bg-sky-50 text-sky-800">
                      <Lock className="size-3" /> Template-prescribed
                    </Badge>
                  )}
                </header>
                <div className="space-y-3 p-4">
                  {inst.poCategoryIntros[c] && <p className="text-sm italic text-slate-600">{inst.poCategoryIntros[c]}</p>}
                  {!editable && (
                    <p className="text-xs text-slate-500">
                      Locked. These outcomes and their PEO mappings change only through the{" "}
                      <a href={href("/settings")} className="font-medium text-[#1b2466] underline underline-offset-2">
                        institutional configuration
                      </a>
                      .
                    </p>
                  )}
                  {list.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                      {editable ? "No outcomes selected yet. Add at least one from the library below." : "No outcomes in this category."}
                    </p>
                  )}
                  <ul className="space-y-3">
                    {list.map((po) =>
                      editable ? (
                        <LibraryPoRow
                          key={po.id}
                          po={po}
                          number={numbers.get(po.id) ?? 0}
                          syllabus={syllabus}
                          data={data}
                          autoSuggest={autoSuggestId === po.id}
                          onAutoSuggested={() => setAutoSuggestId(null)}
                          onChange={(patch) => updatePO(po.id, patch)}
                          onRemove={() => setPendingRemove(po)}
                        />
                      ) : (
                        <li key={po.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <span className="h-fit shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">PO {numbers.get(po.id)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-relaxed text-slate-800">{po.description}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {po.peos.map((code) => (
                                <span key={code} className="rounded-full border border-[#1b2466]/20 bg-[#1b2466]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1b2466]">
                                  {code}
                                </span>
                              ))}
                              <SourceBadge source="template" />
                            </div>
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                  {editable && <LibraryPicker category={c} syllabus={syllabus} data={data} onAdd={addFromLibrary} />}
                </div>
              </section>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="E. Program Outcomes addressed by this course"
        description="Choose from this syllabus’ own outcomes. Hover a chip to read its text."
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={!cloUsedPoIds.size}
              onClick={() => update((s) => ({ ...s, addressedPoIds: sortByNumber(Array.from(new Set([...s.addressedPoIds, ...Array.from(cloUsedPoIds)]))) }))}
            >
              <CheckCheck className="size-4" /> Select all used by CLOs
            </Button>
            <Button size="sm" variant="ghost" disabled={!syllabus.addressedPoIds.length} onClick={() => update((s) => ({ ...s, addressedPoIds: [] }))}>
              Clear
            </Button>
          </>
        }
      >
        {ordered.length === 0 ? (
          <EmptyState title="No program outcomes" description="Add outcomes in Section D first." />
        ) : (
          <>
            <ChipSelect
              ariaLabel="Program Outcomes addressed by this course"
              options={ordered.map((p) => ({ value: p.id, label: `PO ${numbers.get(p.id)}`, title: p.description }))}
              value={syllabus.addressedPoIds}
              onChange={(v) => update((s) => ({ ...s, addressedPoIds: sortByNumber(v) }))}
            />
            {syllabus.addressedPoIds.length > 0 && (
              <ul className="mt-4 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm">
                {sortByNumber(syllabus.addressedPoIds)
                  .map((id) => syllabus.programOutcomes.find((p) => p.id === id))
                  .filter((p): p is SyllabusPO => !!p)
                  .map((p) => (
                    <li key={p.id} className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#1b2466]">PO {numbers.get(p.id)}</span>
                      <span className="text-slate-700">{p.description}</span>
                      {!cloUsedPoIds.has(p.id) && syllabus.clos.length > 0 && (
                        <span className="ml-auto shrink-0 self-start rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-900">no CLO yet</span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={recopyOpen}
        onOpenChange={setRecopyOpen}
        title="Re-copy template outcomes?"
        confirmLabel="Re-copy outcomes"
        onConfirm={applyRecopy}
        description={
          <div className="space-y-2 text-sm">
            <p>Categories 1, 4 and 5 will be replaced by the current institutional configuration. Outcomes with unchanged wording keep their CLO links.</p>
            {recopyPreview && recopyPreview.removed.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
                <p className="font-medium">{recopyPreview.removed.length} outcome(s) no longer in the template will be removed:</p>
                <ul className="mt-1 list-disc pl-5">
                  {recopyPreview.removed.map((p) => (
                    <li key={p.id}>
                      PO {numbers.get(p.id)} — {p.description.slice(0, 80)}
                      {p.description.length > 80 ? "…" : ""}
                    </li>
                  ))}
                </ul>
                {recopyRefs && (recopyRefs.clos.length > 0 || recopyRefs.addressed) && (
                  <p className="mt-1">
                    Their references will also be cleared
                    {recopyRefs.clos.length > 0 ? ` from ${recopyRefs.clos.map((c) => c.code).join(", ")}` : ""}
                    {recopyRefs.addressed ? " and from the addressed-PO list" : ""}.
                  </p>
                )}
              </div>
            )}
          </div>
        }
      />

      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        title="Remove this program outcome?"
        confirmLabel="Remove outcome"
        destructive
        onConfirm={applyRemove}
        description={
          pendingRemove && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>PO {numbers.get(pendingRemove.id)}</strong> — {pendingRemove.description}
              </p>
              <p>Outcomes after it will be renumbered. The library record is not affected.</p>
              {removeRefs && (removeRefs.clos.length > 0 || removeRefs.addressed) && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
                  It is referenced
                  {removeRefs.clos.length > 0 ? ` by ${removeRefs.clos.map((c) => c.code || "a CLO").join(", ")}` : ""}
                  {removeRefs.clos.length > 0 && removeRefs.addressed ? " and" : ""}
                  {removeRefs.addressed ? " in the addressed-PO list (Section E)" : ""}. Those references will be removed.
                </p>
              )}
            </div>
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Library picker                                                      */
/* ------------------------------------------------------------------ */

function LibraryPicker({ category, syllabus, data, onAdd }: { category: 2 | 3 | POCategory; syllabus: Syllabus; data: AppData; onAdd: (l: LibraryPO) => void }) {
  const [open, setOpen] = useState(false);
  const libCat = category === 2 ? "discipline" : "it-specific";
  const added = new Set(syllabus.programOutcomes.map((p) => p.libraryId).filter(Boolean));
  const available = data.libraryPOs
    .filter((l) => l.status === "active" && l.category === libCat && !added.has(l.id))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
      >
        <Plus className="size-4" /> Add from IT Program Outcomes library
        <span className="ml-1 rounded-full bg-teal-100 px-2 text-xs">{available.length} available</span>
        {open ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
      </button>
      {open && (
        <div className="border-t border-teal-200 p-2">
          {available.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-600">
              All active outcomes of this category are already in the syllabus. Manage the library in{" "}
              <a href={href("/outcomes")} className="font-medium underline">
                IT Program Outcomes
              </a>
              .
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {available.map((l) => (
                <li key={l.id} className="flex items-start gap-3 rounded-md bg-white px-2.5 py-2 shadow-xs">
                  <span className="mt-0.5 shrink-0 rounded bg-teal-100 px-1.5 text-[11px] font-semibold text-teal-900">{l.code}</span>
                  <span className="flex-1 text-sm text-slate-700">{l.description}</span>
                  <Button size="sm" variant="outline" className="h-7 shrink-0" aria-label={`Add ${l.code}`} onClick={() => onAdd(l)}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category 2/3 row with PEO suggestion                                */
/* ------------------------------------------------------------------ */

function LibraryPoRow({
  po,
  number,
  syllabus,
  data,
  autoSuggest,
  onAutoSuggested,
  onChange,
  onRemove,
}: {
  po: SyllabusPO;
  number: number;
  syllabus: Syllabus;
  data: AppData;
  autoSuggest: boolean;
  onAutoSuggested: () => void;
  onChange: (patch: Partial<SyllabusPO>) => void;
  onRemove: () => void;
}) {
  const ai = useAiProposal<PeoSuggestion>();
  const lib = po.libraryId ? data.libraryPOs.find((l) => l.id === po.libraryId) : undefined;
  const peos = syllabus.institutional.peos;
  const codes = peos.map((p) => p.code);
  const revised = !!lib && lib.version !== po.libraryVersion;
  const archived = lib?.status === "archived";
  const [showDiff, setShowDiff] = useState(false);
  const started = useRef(false);

  const suggest = (forceDemo = false) => {
    const demo = () => demoSuggestPeos({ po: po.description, peos, library: lib && lib.description === po.description ? lib : undefined });
    return ai.run(() =>
      runAi<PeoSuggestion>(
        "suggest-peos",
        { po: po.description, category: data.institutional.poCategoryTitles[po.category], peos },
        { demo, forceDemo, validate: (v) => validatePeoSuggestion(v, codes) }
      )
    );
  };

  useEffect(() => {
    if (autoSuggest && !started.current) {
      started.current = true;
      onAutoSuggested();
      console.log("[syllabus] auto PEO suggestion for", po.id);
      void suggest();
    }
  }, [autoSuggest]);

  const accept = () => {
    if (!ai.proposal) return;
    const valid = ai.proposal.peos.filter((c) => codes.includes(c));
    onChange({ peos: valid, alignmentNote: ai.proposal.explanation, mappingSource: ai.mode === "live" ? "ai" : "demo" });
    console.log("[syllabus] PEO suggestion accepted", { poId: po.id, peos: valid, mode: ai.mode });
    ai.clear();
  };

  const updateFromLibrary = () => {
    if (!lib) return;
    onChange({ description: lib.description, libraryVersion: lib.version });
    console.log("[syllabus] PO updated from library", { poId: po.id, version: lib.version });
    toast.success(`PO ${number} updated from the library`, { description: "Review its PEO mapping for the new wording." });
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <span className="h-fit shrink-0 rounded-md bg-[#1b2466] px-2 py-0.5 text-xs font-bold text-white">PO {number}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-slate-800">{po.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <SourceBadge source="library" />
            {lib && <span className="text-[11px] text-slate-500">{lib.code} · v{po.libraryVersion ?? "?"}</span>}
            {!lib && po.libraryId && (
              <Badge variant="outline" className="border-slate-300 text-slate-600">
                <XCircle className="size-3" /> No longer in library
              </Badge>
            )}
            {archived && (
              <Badge variant="outline" className="border-slate-400 bg-slate-100 text-slate-700">
                <Archive className="size-3" /> Archived in library
              </Badge>
            )}
          </div>
        </div>
        <DeleteIconButton label={`Remove PO ${number}`} onClick={onRemove} />
      </div>

      {revised && lib && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <div className="flex flex-wrap items-center gap-2">
            <BookMarked className="size-3.5" />
            <span className="font-semibold">Library outcome revised</span>
            <span className="text-amber-800">
              (v{po.libraryVersion ?? "?"} → v{lib.version})
            </span>
            <button type="button" className="font-medium underline" onClick={() => setShowDiff((s) => !s)} aria-expanded={showDiff}>
              {showDiff ? "Hide changes" : "Show changes"}
            </button>
            <Button size="sm" variant="outline" className="ml-auto h-7 border-amber-400 bg-white text-xs" onClick={updateFromLibrary}>
              <RefreshCw className="size-3.5" /> Update this syllabus from library
            </Button>
          </div>
          {showDiff && (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
              <div className="rounded border border-red-200 bg-red-50 p-2">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">In this syllabus</p>
                <p className="text-red-900 line-through decoration-red-300">{po.description}</p>
              </div>
              <ArrowRight className="mx-auto hidden size-4 text-amber-700 sm:block" />
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Current library text</p>
                <p className="text-emerald-900">{lib.description}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PEO mapping</p>
            <SourceBadge source={po.mappingSource} />
          </div>
          <ChipSelect
            ariaLabel={`PEOs for PO ${number}`}
            options={peos.map((p) => ({ value: p.code, label: p.code, title: p.description }))}
            value={po.peos}
            onChange={(v) => onChange({ peos: codes.filter((c) => v.includes(c)), mappingSource: "manual" })}
            emptyText="No PEOs in this syllabus."
          />
          {po.peos.length === 0 && <p className="mt-1.5 text-xs font-medium text-amber-700">No PEO mapped yet.</p>}
          {po.alignmentNote && <p className="mt-2 text-xs leading-relaxed text-slate-600">{po.alignmentNote}</p>}
        </div>
        <AiReviewPanel
          compact
          title="PEO suggestion"
          status={ai.status}
          mode={ai.mode}
          error={ai.error}
          warnings={ai.warnings}
          generateLabel={po.peos.length ? "Re-suggest" : "Suggest PEOs"}
          onGenerate={() => void suggest()}
          onRegenerate={() => void suggest()}
          onUseDemo={() => void suggest(true)}
          canUseDemo={ai.canUseDemo}
          onAccept={accept}
          onReject={() => ai.clear()}
          acceptLabel="Accept mapping"
        >
          {ai.proposal && (
            <div className="space-y-2">
              <ChipSelect
                ariaLabel={`Proposed PEOs for PO ${number}`}
                options={peos.map((p) => ({ value: p.code, label: p.code, title: p.description }))}
                value={ai.proposal.peos}
                onChange={(v) => ai.edit((p) => ({ ...p, peos: codes.filter((c) => v.includes(c)) }))}
              />
              {ai.proposal.peos.length === 0 && <p className="text-xs text-amber-700">No PEO selected — choose at least one before accepting.</p>}
              <p className={cn("text-xs leading-relaxed text-slate-700")}>{ai.proposal.explanation}</p>
            </div>
          )}
        </AiReviewPanel>
      </div>
    </li>
  );
}
