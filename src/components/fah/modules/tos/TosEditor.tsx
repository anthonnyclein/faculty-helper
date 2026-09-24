"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, BookOpenText, CheckCircle2, FileQuestion, FileSpreadsheet, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecordDraft, useStoreState } from "@/lib/fah/store";
import { computeTos, round2 } from "@/lib/fah/calc";
import type { MapTosResult } from "@/lib/fah/ai/demo/tos";
import type { Tos } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { AiStatusBadge, ConfirmDialog, DemoBadge, EmptyState, IssueList, LoadingBlock, PageHeader, Panel, SaveBar } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { TosStatusPill } from "./TosList";
import { TosDetails, TosLevels, TosObjectives, TosSignatures } from "./TosSetup";
import { MappingTable } from "./MappingTable";
import { AiMappingPanel, type AiMapRequest } from "./AiMappingPanel";
import { NumberingToggle, TosMatrix } from "./TosMatrix";
import { TosPrintPanel } from "./TosPrintPanel";
import { assignMappings, examDisplayName, planExamSync, tosStatus } from "./tos-utils";
import { examItems } from "@/lib/fah/calc";

type Tab = "setup" | "mappings" | "horizontal" | "vertical" | "print";

export function TosEditor({ id }: { id: string }) {
  const { data, ready } = useStoreState();
  const { record, draft, setDraft: setDraftRaw, save, discard, status, error, lastSavedAt, autosave } = useRecordDraft("tos", id);
  const setDraft = setDraftRaw as unknown as (u: (d: Tos) => Tos) => void;
  const tos = draft as Tos | undefined;
  const exam = tos ? data.exams.find((e) => e.id === tos.examId) : undefined;
  const syllabus = tos?.syllabusId ? data.syllabi.find((s) => s.id === tos.syllabusId) : exam?.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  const lowerOrder = data.institutional.tosLowerOrderCount;
  const computed = useMemo(() => (tos ? computeTos(tos, exam, lowerOrder) : null), [tos, exam, lowerOrder]);

  const [tab, setTab] = useState<Tab>("setup");
  const [selected, setSelected] = useState<string[]>([]);
  const [aiRequest, setAiRequest] = useState<AiMapRequest | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<"unassigned" | "ai">("ai");

  // Auto-map after creation: #/tos/<id>?automap=1
  useEffect(() => {
    if (!tos || !exam) return;
    if (!window.location.hash.includes("automap=1")) return;
    window.history.replaceState(null, "", `#/tos/${tos.id}`);
    console.log("[tos] auto-mapping new TOS", tos.id);
    setTab("mappings");
    setAiRequest({ ids: examItems(exam).map((i) => i.questionId), nonce: Date.now() });
  }, [tos?.id, exam]);

  const onAssign = useCallback(
    (ids: string[], patch: { objectiveId?: string | null; level?: string | null }) => {
      console.log(`[tos] assign ${ids.length} item(s)`, patch);
      setDraft((d) => assignMappings(d, exam, ids, patch, "manual"));
    },
    [exam, setDraft]
  );

  const onApplyAi = (rows: MapTosResult["mappings"], mode: "live" | "demo") => {
    console.log(`[tos] applying ${rows.length} proposed mapping(s) (${mode})`);
    setDraft((d) =>
      rows.reduce(
        (acc, r) => assignMappings(acc, exam, [r.questionId], { objectiveId: r.objectiveId, level: r.level, rationale: r.rationale }, mode === "demo" ? "demo" : "ai"),
        d
      )
    );
  };

  if (!ready) return <LoadingBlock />;
  if (!record || !tos || !computed) {
    return (
      <EmptyState
        icon={<FileSpreadsheet className="size-6" />}
        title="Table of Specifications not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" onClick={() => navigate("/tos")}>
            <ArrowLeft className="size-4" /> Back to list
          </Button>
        }
      />
    );
  }

  const st = tosStatus(tos, data);
  const plan = exam ? planExamSync(tos, exam) : null;
  const displayedPct = computed.totalCount ? round2(tos.levels.reduce((a, l) => a + round2(computed.colTotals.get(l)?.percent ?? 0), 0)) : 0;

  const applySync = () => {
    if (!exam || !plan) return;
    setDraft((d) => ({ ...d, mappings: planExamSync(d, exam).mappings, sourceExamRevision: exam.revision }));
    console.log(`[tos] synced with exam rev ${exam.revision}: +${plan.added.length} -${plan.removed} sections fixed ${plan.sectionsFixed}`);
    if (syncMode === "ai" && plan.added.length) {
      setTab("mappings");
      setAiRequest({ ids: plan.added, nonce: Date.now() });
    }
    toast.success("TOS updated from the exam", { description: "Review the changes, then Save." });
    setSyncOpen(false);
  };

  return (
    <div>
      <SaveBar status={status} lastSavedAt={lastSavedAt} autosave={autosave} error={error} onSave={() => void save()} onDiscard={discard}>
        <AiStatusBadge compact />
      </SaveBar>

      <PageHeader
        eyebrow="Table of Specifications"
        title={tos.title || "Untitled TOS"}
        badges={
          <>
            {tos.isDemo && <DemoBadge />}
            <TosStatusPill tone={st.tone} label={st.label} />
          </>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <FileQuestion className="size-4 text-slate-400" /> Source exam:{" "}
              {exam ? (
                <a className="font-medium text-[#1b2466] underline-offset-2 hover:underline" href={href(`/exams/${exam.id}`)}>
                  {examDisplayName(exam)}
                </a>
              ) : (
                <span className="font-medium text-red-700">missing</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpenText className="size-4 text-slate-400" /> Syllabus:{" "}
              {syllabus ? (
                <a className="font-medium text-[#1b2466] underline-offset-2 hover:underline" href={href(`/syllabi/${syllabus.id}`)}>
                  {syllabus.courseCode} {syllabus.descriptiveTitle}
                </a>
              ) : (
                <span className="text-slate-500">not linked</span>
              )}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" onClick={() => navigate("/tos")}>
            <ArrowLeft className="size-4" /> All tables
          </Button>
        }
      />

      {/* Needs review */}
      {computed.needsReview && exam && (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 md:flex-row md:items-center">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Source exam changed</p>
            <p>
              The exam was edited after this TOS was generated (TOS based on revision {tos.sourceExamRevision}, exam is now at revision {exam.revision}).
              {plan && ` ${plan.added.length} new item(s), ${plan.removed} removed mapping(s), ${plan.sectionsFixed} moved item(s).`}
            </p>
          </div>
          <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={() => setSyncOpen(true)}>
            <RefreshCcw className="size-4" /> Update from exam
          </Button>
        </div>
      )}

      {/* Validation summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Items (exam vs TOS)" value={`${computed.examItemCount} / ${computed.totalCount}`} ok={!!exam && computed.examItemCount === computed.totalCount} />
        <Stat label="Points (exam vs TOS)" value={`${computed.examPoints} / ${computed.totalPoints}`} ok={!!exam && Math.abs(computed.examPoints - computed.totalPoints) < 0.001} />
        <Stat label="Percentage total" value={`${displayedPct}%`} ok={computed.totalCount > 0 && Math.abs(displayedPct - 100) <= 0.05} />
        <Stat
          label="Lower / higher order"
          value={computed.totalCount ? `${round2(computed.groupPercents[0]?.percent ?? 0)}% / ${round2(computed.groupPercents[1]?.percent ?? 0)}%` : "—"}
          ok={computed.totalCount > 0}
          neutral
        />
      </div>
      <div className="mb-6 space-y-2">
        <IssueList issues={computed.errors} title={`${computed.errors.length} validation error${computed.errors.length === 1 ? "" : "s"}`} />
        <IssueList issues={computed.warnings} tone="warning" title="Warnings" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="mappings">
            Mappings
            {computed.errors.some((e) => e.includes("not accounted")) && <span className="ml-1 size-2 rounded-full bg-red-500" aria-label="has unassigned items" />}
          </TabsTrigger>
          <TabsTrigger value="horizontal">Horizontal Item Placement</TabsTrigger>
          <TabsTrigger value="vertical">Vertical Item Placement</TabsTrigger>
          <TabsTrigger value="print">Print / PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <TosDetails tos={tos} setDraft={setDraft} />
          <TosLevels tos={tos} data={data} setDraft={setDraft} />
          <TosObjectives tos={tos} syllabus={syllabus} computed={computed} setDraft={setDraft} />
          <TosSignatures tos={tos} data={data} setDraft={setDraft} />
        </TabsContent>

        {/* Keep the AI panel mounted so auto-mapping and pending proposals survive tab switches. */}
        <div className={cn("space-y-4", tab !== "mappings" && "hidden")}>
          <AiMappingPanel tos={tos} exam={exam} selected={selected} request={aiRequest} onApply={onApplyAi} />
          <Panel title="Item mapping" description="The data behind both layouts: one row per exam item. Select rows to set an objective or level in bulk.">
            <MappingTable
              tos={tos}
              exam={exam}
              selected={selected}
              onSelectedChange={setSelected}
              onAssign={onAssign}
              onRationale={(qid, r) => setDraft((d) => assignMappings(d, exam, [qid], { rationale: r }, "manual"))}
              onRemoveOrphans={() => {
                const ids = new Set(exam ? examItems(exam).map((i) => i.questionId) : []);
                setDraft((d) => ({ ...d, mappings: d.mappings.filter((m) => ids.has(m.questionId)) }));
                toast.success("Mappings for deleted questions removed");
              }}
            />
          </Panel>
        </div>

        {(["horizontal", "vertical"] as const).map((layout) => (
          <TabsContent key={layout} value={layout} className="space-y-4">
            <Panel
              title={layout === "horizontal" ? "Horizontal Item Placement" : "Vertical Item Placement"}
              actions={<NumberingToggle value={tos.numbering} onChange={(v) => setDraft((d) => ({ ...d, numbering: v }))} />}
            >
              <TosMatrix tos={tos} exam={exam} syllabus={syllabus} computed={computed} layout={layout} lowerOrderCount={lowerOrder} onAssign={onAssign} />
            </Panel>
          </TabsContent>
        ))}

        <TabsContent value="print" className="space-y-4">
          <Panel title="Print / PDF" actions={<NumberingToggle value={tos.numbering} onChange={(v) => setDraft((d) => ({ ...d, numbering: v }))} />}>
            <TosPrintPanel tos={tos} exam={exam} data={data} errors={computed.errors} />
          </Panel>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        title="Update this TOS from the exam?"
        confirmLabel="Update TOS"
        onConfirm={applySync}
        description={
          plan && (
            <div className="space-y-2 text-sm">
              <ul className="list-disc space-y-0.5 pl-5">
                <li>{plan.added.length} new question(s) will be added to the mapping table.</li>
                <li>{plan.removed} mapping(s) for deleted questions will be removed.</li>
                <li>{plan.sectionsFixed} section reference(s) will be corrected.</li>
                {plan.duplicatesRemoved > 0 && <li>{plan.duplicatesRemoved} duplicate mapping(s) will be removed.</li>}
                <li>Existing mappings (including your manual edits) are kept. Re-check items whose wording changed.</li>
              </ul>
            </div>
          )
        }
      >
        {plan && plan.added.length > 0 && (
          <div role="radiogroup" aria-label="New items" className="space-y-1.5 text-sm">
            {(
              [
                ["ai", "Propose mappings for the new items (review before accepting)"],
                ["unassigned", "Add new items as unassigned (map them manually)"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="tos-sync-mode" checked={syncMode === v} onChange={() => setSyncMode(v)} className="accent-[#1b2466]" />
                {l}
              </label>
            ))}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, ok, neutral }: { label: string; value: string; ok: boolean; neutral?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white px-4 py-3 shadow-sm",
        neutral ? "border-slate-200" : ok ? "border-emerald-200" : "border-red-200 bg-red-50/40"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-[#1b2466] tabular-nums">
        {value}
        {!neutral && (ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-red-600" />)}
      </p>
    </div>
  );
}
