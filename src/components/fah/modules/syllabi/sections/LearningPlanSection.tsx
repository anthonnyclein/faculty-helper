"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarRange, Copy, FileText, Lock, Plus, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { weekLabel } from "@/lib/fah/calc";
import { examWeekItems } from "@/lib/fah/factories";
import { uid } from "@/lib/fah/ids";
import { buildSourceContext, runAi, type AiRunResult, type SourceContext } from "@/lib/fah/services/ai";
import {
  demoLearningPlan,
  demoRegenerateRows,
  demoSiloSupport,
  normCloCode,
  validatePlanResult,
  validateSiloSupport,
  type PlanGenInput,
  type PlanGenResult,
  type PlanProposalItem,
  type PlanRegenInput,
  type SiloSupportInput,
  type SiloSupportResult,
} from "@/lib/fah/ai/demo/syllabus-plan";
import type { AppData, CLO, LearningPlanItem, Resource, Syllabus } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../../common/ai-review";
import { ChipSelect, ConfirmDialog, DeleteIconButton, EmptyState, IssueList, Panel, ReorderButtons, ScrollTable, SourceBadge } from "../../../common/ui";
import { href } from "../../../common/router";
import type { SectionProps } from "./types";

type Item = LearningPlanItem;
type Update = SectionProps["update"];

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const toLines = (s: string) =>
  (s || "")
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);

function mergeLines(existing: string, add: string[]): string {
  const cur = toLines(existing);
  const low = new Set(cur.map((c) => c.toLowerCase()));
  add.forEach((a) => {
    if (a.trim() && !low.has(a.trim().toLowerCase())) {
      cur.push(a.trim());
      low.add(a.trim().toLowerCase());
    }
  });
  return cur.join("\n");
}

const isNonEmpty = (it: Item) => !!(it.content.trim() || it.silos.trim() || it.activities.trim() || it.assessment.trim() || it.materials.trim() || it.cloIds.length);
/** Manually written lesson rows are preserved by AI generation unless explicitly ticked. */
const isProtected = (it: Item) => it.kind === "lesson" && (it.origin ?? "manual") === "manual" && isNonEmpty(it);

/** Stable sort by week; within a week lessons keep array order and exams come last. */
function sortPlan(items: Item[]): Item[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.weekStart - b.it.weekStart || (a.it.kind === "exam" ? 1 : 0) - (b.it.kind === "exam" ? 1 : 0) || a.i - b.i)
    .map((x) => x.it);
}

function newLesson(week: number): Item {
  return { id: uid("lp"), weekStart: week, weekEnd: null, kind: "lesson", content: "", silos: "", cloIds: [], activities: "", assessment: "", materials: "", origin: "manual" };
}

function examRow(week: number, label: string): Item {
  return { id: uid("lp"), weekStart: week, weekEnd: null, kind: "exam", examLabel: label, content: "", silos: "", cloIds: [], activities: "", assessment: "", materials: "", origin: "manual" };
}

/** Adds exam rows for configured exam weeks that have none (never removes). */
function ensureExamRows(plan: Item[], exams: { week: number; label: string }[]): Item[] {
  const have = new Set(plan.filter((p) => p.kind === "exam").map((p) => p.weekStart));
  return [...plan, ...exams.filter((e) => !have.has(e.week)).map((e) => examRow(e.week, e.label))];
}

function weeksOf(start: number, end?: number | null): number[] {
  const out: number[] = [];
  for (let w = start; w <= (end && end > start ? end : start); w++) out.push(w);
  return out;
}

function cloOptions(clos: CLO[]) {
  return clos.map((c) => ({ value: c.id, label: c.code || "CLO", title: c.statement }));
}

const STATUS_BADGE: Record<Resource["status"], [string, string]> = {
  extracted: ["Text extracted", "border-emerald-300 bg-emerald-50 text-emerald-800"],
  "metadata-only": ["Bibliographic only", "border-slate-300 bg-slate-50 text-slate-700"],
  "needs-ocr": ["Needs OCR", "border-amber-300 bg-amber-50 text-amber-900"],
  failed: ["Extraction failed", "border-red-300 bg-red-50 text-red-800"],
  inaccessible: ["Link inaccessible", "border-red-300 bg-red-50 text-red-800"],
  processing: ["Processing", "border-sky-300 bg-sky-50 text-sky-800"],
};

const UNUSABLE_REASON: Record<Resource["status"], string> = {
  extracted: "No readable text was stored for this resource.",
  "metadata-only": "Bibliographic information only — no readable content.",
  "needs-ocr": "Scanned file — requires OCR before it can be used.",
  failed: "Text extraction failed. Re-process it in the Resource Library.",
  inaccessible: "The link could not be accessed.",
  processing: "Still processing.",
};

/* ------------------------------------------------------------------ */
/* Proposal review rows                                                */
/* ------------------------------------------------------------------ */

interface ReviewRow {
  key: string;
  include: boolean;
  flag?: string;
  weekStart: number;
  weekEnd: number | null;
  content: string;
  silos: string;
  cloIds: string[];
  activities: string;
  assessment: string;
  materials: string;
  sourceIds: string[];
}

interface GenProposal {
  rows: ReviewRow[];
  warnings: string[];
}

function toReviewRows(res: PlanGenResult, clos: CLO[], exams: { week: number; label: string }[], allowedSources: string[]): GenProposal {
  const byCode = new Map(clos.map((c) => [normCloCode(c.code), c.id]));
  const examMap = new Map(exams.map((e) => [e.week, e.label]));
  const unknown = new Set<string>();
  const warnings = [...res.coverageWarnings];
  const rows = res.items.map<ReviewRow>((it: PlanProposalItem) => {
    const cloIds: string[] = [];
    it.cloCodes.forEach((code) => {
      const id = byCode.get(normCloCode(code));
      if (id && !cloIds.includes(id)) cloIds.push(id);
      else if (!id) unknown.add(code);
    });
    const examWeek = weeksOf(it.weekStart, it.weekEnd).find((w) => examMap.has(w));
    return {
      key: uid("rv"),
      include: examWeek === undefined,
      flag: examWeek !== undefined ? `Week ${examWeek} is reserved for ${examMap.get(examWeek)} — excluded by default.` : undefined,
      weekStart: it.weekStart,
      weekEnd: it.weekEnd,
      content: it.content,
      silos: it.silos.join("\n"),
      cloIds,
      activities: it.activities.join("\n"),
      assessment: it.assessment.join("\n"),
      materials: it.materials,
      sourceIds: it.sourceIds.filter((s) => allowedSources.includes(s)),
    };
  });
  if (unknown.size) warnings.push(`Ignored CLO codes that do not exist in this syllabus: ${Array.from(unknown).join(", ")}.`);
  const flagged = rows.filter((r) => r.flag).length;
  if (flagged) warnings.push(`${flagged} proposed row(s) fell in reserved examination weeks and were excluded (tick them to include anyway).`);
  return { rows: sortRows(rows), warnings };
}

function sortRows(rows: ReviewRow[]) {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.weekStart - b.r.weekStart || a.i - b.i)
    .map((x) => x.r);
}

function uncoveredWeeks(rows: { weekStart: number; weekEnd: number | null }[], exams: { week: number }[]): number[] {
  const covered = new Set<number>(exams.map((e) => e.week));
  rows.forEach((r) => weeksOf(r.weekStart, r.weekEnd).forEach((w) => covered.add(w)));
  return WEEKS.filter((w) => !covered.has(w));
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Cell({
  value,
  onChange,
  label,
  invalid,
  placeholder,
  onFocus,
  onBlur,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
  placeholder?: string;
  onFocus?: (v: string) => void;
  onBlur?: (v: string) => void;
  className?: string;
}) {
  return (
    <Textarea
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      placeholder={placeholder}
      rows={3}
      onFocus={(e) => onFocus?.(e.target.value)}
      onBlur={(e) => onBlur?.(e.target.value)}
      onChange={(e) => onChange(e.target.value)}
      className={cn("min-h-20 bg-white text-[13px] leading-snug", invalid && "border-amber-400 bg-amber-50/50", className)}
    />
  );
}

/** Week range editor using selects so a row never re-sorts while the user is typing. */
function WeekEditor({
  start,
  end,
  onChange,
  label,
  examWeeks = [],
}: {
  start: number;
  end: number | null | undefined;
  onChange: (s: number, e: number | null) => void;
  label: string;
  examWeeks?: number[];
}) {
  const bad = start < 1 || start > 18 || (!!end && (end < start || end > 18));
  const endVal = end && end > start ? String(end) : "none";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Select value={String(start)} onValueChange={(v) => { const ns = Number(v); onChange(ns, end && end > ns ? end : null); }}>
          <SelectTrigger aria-label={`${label}: start week`} size="sm" className={cn("h-8 w-[4.25rem] bg-white px-2", bad && "border-red-400")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKS.map((w) => (
              <SelectItem key={w} value={String(w)}>
                {w}
                {examWeeks.includes(w) ? " (exam)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">to</span>
        <Select value={endVal} onValueChange={(v) => onChange(start, v === "none" ? null : Number(v))}>
          <SelectTrigger aria-label={`${label}: end week (optional)`} size="sm" className={cn("h-8 w-[4.25rem] bg-white px-2", bad && "border-red-400")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {WEEKS.filter((w) => w > start).map((w) => (
              <SelectItem key={w} value={String(w)}>
                {w}
                {examWeeks.includes(w) ? " (exam)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className={cn("text-[11px] font-medium", bad ? "text-red-700" : "text-slate-500")}>{bad ? "Invalid week range" : weekLabel(start, end)}</p>
    </div>
  );
}

function ResourcePicker({ resources, selected, onChange, linkedIds }: { resources: Resource[]; selected: string[]; onChange: (ids: string[]) => void; linkedIds: string[] }) {
  const list = resources.filter((r) => r.purpose === "instructional");
  if (!list.length)
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
        No instructional resources yet. Add textbooks, handouts or notes in the{" "}
        <a href={href("/resources")} className="font-medium text-[#1b2466] underline underline-offset-2">
          Resource Library
        </a>
        . Generation can still run from the course description and CLOs.
      </p>
    );
  return (
    <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
      {list.map((r) => {
        const usable = r.status === "extracted" && r.content.trim().length > 0;
        const [lbl, cls] = STATUS_BADGE[r.status] ?? ["Unknown", ""];
        const id = `res-pick-${r.id}`;
        return (
          <li key={r.id} className={cn("flex items-start gap-3 px-3 py-2", !usable && "opacity-70")}>
            <Checkbox
              id={id}
              className="mt-0.5"
              disabled={!usable}
              checked={usable && selected.includes(r.id)}
              onCheckedChange={(c) => onChange(c === true ? Array.from(new Set([...selected, r.id])) : selected.filter((x) => x !== r.id))}
            />
            <label htmlFor={id} className={cn("min-w-0 flex-1", usable ? "cursor-pointer" : "cursor-not-allowed")}>
              <span className="block text-sm font-medium text-slate-800">{r.title || "Untitled resource"}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cls}>
                  {lbl}
                </Badge>
                {linkedIds.includes(r.id) && <Badge variant="outline">Linked to syllabus</Badge>}
                {usable && <span className="text-[11px] text-slate-500">{r.wordCount ? `${r.wordCount.toLocaleString()} words` : ""}</span>}
                {!usable && <span className="text-[11px] text-slate-500">{UNUSABLE_REASON[r.status]}</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function buildInput(syllabus: Syllabus, data: AppData, resourceIds: string[], instructions: string): { ctx: SourceContext; input: PlanGenInput } {
  const ctx = buildSourceContext(data.resources, resourceIds);
  const input: PlanGenInput = {
    course: {
      code: syllabus.courseCode,
      title: syllabus.descriptiveTitle,
      description: syllabus.courseDescription,
      units: syllabus.units,
      lectureHours: syllabus.lectureHours,
      labHours: syllabus.labHours,
    },
    clos: syllabus.clos.filter((c) => c.statement.trim()).map((c) => ({ id: c.id, code: c.code, statement: c.statement })),
    examWeeks: examWeekItems(data.settings),
    sources: ctx.sources.map((s) => ({ id: s.id, title: s.title, text: s.text })),
    instructions: instructions.trim(),
  };
  return { ctx, input };
}

function prerequisites(s: Syllabus): string[] {
  const out: string[] = [];
  if (!s.courseDescription.trim()) out.push("Enter the Course Description in Course information (section A).");
  if (!s.clos.some((c) => c.statement.trim())) out.push("Add at least one Course Learning Outcome (section F).");
  return out;
}

/** Editable table of proposed rows (shared by generation review). */
function ReviewTable({ rows, clos, onChange, examWeeksAll = [] }: { rows: ReviewRow[]; clos: CLO[]; onChange: (rows: ReviewRow[]) => void; examWeeksAll?: number[] }) {
  const set = (key: string, patch: Partial<ReviewRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <ScrollTable minWidth={1500} className="max-h-[52vh] overflow-y-auto bg-white">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#1b2466] text-xs text-white">
          <tr>
            <th className="w-16 px-2 py-2">Include</th>
            <th className="w-36 px-2 py-2">Week</th>
            <th className="w-52 px-2 py-2">Learning Content</th>
            <th className="w-72 px-2 py-2">Specific Intended Learning Outcomes</th>
            <th className="w-40 px-2 py-2">Corresponding CLOs</th>
            <th className="w-60 px-2 py-2">Teaching and Learning Activities</th>
            <th className="w-52 px-2 py-2">Assessment</th>
            <th className="w-48 px-2 py-2">Instructional Material References</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={cn("border-t border-slate-100 align-top", !r.include && "bg-slate-50 opacity-70", r.flag && "bg-amber-50/60")}>
              <td className="px-2 py-2">
                <Checkbox checked={r.include} onCheckedChange={(c) => set(r.key, { include: c === true })} aria-label={`Include proposed row ${i + 1}`} />
              </td>
              <td className="px-2 py-2">
                <WeekEditor label={`Proposed row ${i + 1}`} start={r.weekStart} end={r.weekEnd} onChange={(s, e) => set(r.key, { weekStart: s, weekEnd: e })} examWeeks={examWeeksAll} />
                {r.flag && (
                  <p className="mt-1 flex gap-1 text-[11px] text-amber-900">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {r.flag}
                  </p>
                )}
              </td>
              <td className="px-2 py-2">
                <Cell label={`Proposed row ${i + 1} learning content`} value={r.content} invalid={!r.content.trim()} onChange={(v) => set(r.key, { content: v })} />
              </td>
              <td className="px-2 py-2">
                <Cell label={`Proposed row ${i + 1} SILOs`} value={r.silos} onChange={(v) => set(r.key, { silos: v })} />
              </td>
              <td className="px-2 py-2">
                <ChipSelect ariaLabel={`Proposed row ${i + 1} CLOs`} options={cloOptions(clos)} value={r.cloIds} onChange={(v) => set(r.key, { cloIds: v })} />
              </td>
              <td className="px-2 py-2">
                <Cell label={`Proposed row ${i + 1} activities`} value={r.activities} onChange={(v) => set(r.key, { activities: v })} />
              </td>
              <td className="px-2 py-2">
                <Cell label={`Proposed row ${i + 1} assessment`} value={r.assessment} onChange={(v) => set(r.key, { assessment: v })} />
              </td>
              <td className="px-2 py-2">
                <Cell label={`Proposed row ${i + 1} materials`} value={r.materials} onChange={(v) => set(r.key, { materials: v })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}

/* ------------------------------------------------------------------ */
/* Generate 18-week plan                                               */
/* ------------------------------------------------------------------ */

function GeneratePlanDialog({
  open,
  onOpenChange,
  syllabus,
  data,
  update,
  resIds,
  setResIds,
  instructions,
  setInstructions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  syllabus: Syllabus;
  data: AppData;
  update: Update;
  resIds: string[];
  setResIds: (v: string[]) => void;
  instructions: string;
  setInstructions: (v: string) => void;
}) {
  const gen = useAiProposal<GenProposal>();
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const [forceReplace, setForceReplace] = useState<string[]>([]);
  const exams = examWeekItems(data.settings);
  const missing = prerequisites(syllabus);
  const protectedRows = sortPlan(syllabus.learningPlan).filter(isProtected);
  const replaceable = syllabus.learningPlan.filter((it) => it.kind === "lesson" && !isProtected(it));

  const generate = (forceDemo = false) => {
    if (missing.length) {
      toast.error("Complete the course details first", { description: missing.join(" ") });
      return;
    }
    const { ctx, input } = buildInput(syllabus, data, resIds, instructions);
    console.log("[plan] generate", { sources: input.sources.length, clos: input.clos.length, exams: input.examWeeks, forceDemo });
    void gen.run(async () => {
      const r = await runAi<PlanGenResult>("generate-learning-plan", input, { demo: () => demoLearningPlan(input), validate: validatePlanResult, forceDemo });
      if (r.ok === true) {
        const prop = toReviewRows(r.data, syllabus.clos, input.examWeeks, input.sources.map((s) => s.id));
        console.log("[plan] proposal ready", { rows: prop.rows.length, mode: r.mode });
        return { ok: true, data: prop, mode: r.mode, model: r.model } as AiRunResult<GenProposal>;
      }
      const f = r as Extract<AiRunResult<PlanGenResult>, { ok: false }>;
      console.error("[plan] generation failed", f.error);
      return f as AiRunResult<GenProposal>;
    }, ctx.warnings);
  };

  const proposal = gen.proposal;
  const included = proposal ? proposal.rows.filter((r) => r.include) : [];
  const gaps = proposal ? uncoveredWeeks(included, exams) : [];
  const liveWarnings = proposal ? [...proposal.warnings, ...(gaps.length ? [`With the current selection, week(s) ${gaps.join(", ")} have no lesson.`] : [])] : [];

  const apply = () => {
    if (!proposal) return;
    const origin: Item["origin"] = gen.mode === "live" ? "ai" : "demo";
    const newItems: Item[] = included.map((r) => ({
      id: uid("lp"),
      weekStart: r.weekStart,
      weekEnd: r.weekEnd && r.weekEnd > r.weekStart ? r.weekEnd : null,
      kind: "lesson",
      content: r.content.trim(),
      silos: r.silos.trim(),
      cloIds: r.cloIds,
      activities: r.activities.trim(),
      assessment: r.assessment.trim(),
      materials: r.materials.trim(),
      origin,
      sourceResourceIds: r.sourceIds,
    }));
    if (!newItems.length) {
      toast.error("No rows are selected to apply.");
      return;
    }
    let removed = 0;
    update((s) => {
      let plan = s.learningPlan;
      if (mode === "replace") {
        const before = plan.length;
        plan = plan.filter((it) => it.kind === "exam" || (isProtected(it) && !forceReplace.includes(it.id)));
        removed = before - plan.length;
      }
      plan = ensureExamRows([...plan, ...newItems], exams);
      const usedSources = Array.from(new Set(newItems.flatMap((i) => i.sourceResourceIds ?? [])));
      return { ...s, learningPlan: plan, resourceIds: Array.from(new Set([...s.resourceIds, ...usedSources])) };
    });
    console.log("[plan] applied", { added: newItems.length, mode, removed, origin });
    toast.success(`${newItems.length} plan row(s) applied`, { description: mode === "replace" ? "Manually written rows you did not tick were preserved." : "Added to the existing plan." });
    gen.clear();
    setForceReplace([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-[min(96vw,1200px)]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1b2466]">Generate 18-week Course Learning Plan</DialogTitle>
          <DialogDescription>
            Uses the course description, CLOs and the selected resources. Weeks {exams.map((e) => e.week).join(", ")} are reserved for examinations. Nothing changes until you
            apply the reviewed proposal.
          </DialogDescription>
        </DialogHeader>

        <AiReviewPanel
          title="AI learning plan"
          description="Proposes Learning Content, SILOs, CLOs, activities, assessment and material references for every non-examination week."
          status={gen.status}
          mode={gen.mode}
          error={gen.error}
          warnings={[...gen.warnings, ...liveWarnings]}
          generateLabel="Generate plan"
          onGenerate={() => generate()}
          onUseDemo={() => generate(true)}
          canUseDemo={gen.canUseDemo}
          onAccept={apply}
          acceptLabel={`Apply ${included.length} row(s) to plan`}
          onRegenerate={() => generate()}
          regenerateLabel="Generate again"
          onReject={() => gen.clear()}
          controls={
            <div className="space-y-4">
              {missing.length > 0 && <IssueList tone="warning" title="Required before generating" issues={missing} />}
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Instructional resources</p>
                <p className="mb-2 text-xs text-slate-500">Only resources with extracted text can be sent. Others are listed with the reason they cannot be used.</p>
                <ResourcePicker resources={data.resources} selected={resIds} onChange={setResIds} linkedIds={syllabus.resourceIds} />
              </div>
              <div>
                <label htmlFor="plan-instr" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Additional instructions <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Textarea
                  id="plan-instr"
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Follow chapters 1–10 of the main textbook; include a mini-project from week 15; emphasize hands-on laboratory work."
                  className="bg-white"
                />
              </div>
            </div>
          }
        >
          {proposal && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge variant="outline">{proposal.rows.length} proposed rows</Badge>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                  {included.length} included
                </Badge>
                <span>Edit any cell before applying. Untick rows you do not want.</span>
              </div>
              <ReviewTable rows={proposal.rows} clos={syllabus.clos} examWeeksAll={exams.map((e) => e.week)} onChange={(rows) => gen.edit((p) => ({ ...p, rows }))} />
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">How should the proposal be applied?</p>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as "replace" | "add")} className="gap-2">
                  <label className="flex items-start gap-2 text-sm">
                    <RadioGroupItem value="replace" className="mt-0.5" />
                    <span>
                      <strong>Replace unlocked lesson rows</strong> — removes {replaceable.length} AI-generated or empty lesson row(s). Examination rows and manually written rows are kept.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <RadioGroupItem value="add" className="mt-0.5" />
                    <span>
                      <strong>Add to existing</strong> — keeps every current row and adds the proposal.
                    </span>
                  </label>
                </RadioGroup>
                {mode === "replace" && protectedRows.length > 0 && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Lock className="size-3.5" /> Manually written rows (preserved unless ticked)
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto">
                      {protectedRows.map((it) => (
                        <li key={it.id} className="flex items-start gap-2 text-xs">
                          <Checkbox
                            id={`force-${it.id}`}
                            checked={forceReplace.includes(it.id)}
                            onCheckedChange={(c) => setForceReplace((l) => (c === true ? [...l, it.id] : l.filter((x) => x !== it.id)))}
                          />
                          <label htmlFor={`force-${it.id}`} className="cursor-pointer">
                            <span className="font-semibold">{weekLabel(it.weekStart, it.weekEnd)}</span> — {it.content.trim() || "(no content)"}{" "}
                            <span className="text-slate-500">· also replace</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </AiReviewPanel>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Regenerate selected rows                                            */
/* ------------------------------------------------------------------ */

interface RegenRow {
  rowId: string;
  accept: boolean;
  next: ReviewRow;
}

interface RegenProposal {
  rows: RegenRow[];
  warnings: string[];
}

function RegenerateDialog({
  open,
  onOpenChange,
  syllabus,
  data,
  update,
  selectedIds,
  onDone,
  resIds,
  setResIds,
  instructions,
  setInstructions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  syllabus: Syllabus;
  data: AppData;
  update: Update;
  selectedIds: string[];
  onDone: () => void;
  resIds: string[];
  setResIds: (v: string[]) => void;
  instructions: string;
  setInstructions: (v: string) => void;
}) {
  const regen = useAiProposal<RegenProposal>();
  const rows = sortPlan(syllabus.learningPlan).filter((it) => it.kind === "lesson" && selectedIds.includes(it.id));
  const missing = prerequisites(syllabus);
  const cloCode = (id: string) => syllabus.clos.find((c) => c.id === id)?.code ?? "?";

  const generate = (forceDemo = false) => {
    if (missing.length) {
      toast.error("Complete the course details first", { description: missing.join(" ") });
      return;
    }
    if (!rows.length) {
      toast.error("Select at least one lesson row to regenerate.");
      return;
    }
    const { ctx, input: base } = buildInput(syllabus, data, resIds, instructions);
    const input: PlanRegenInput = {
      ...base,
      rowsToRegenerate: rows.map((r) => ({ id: r.id, weekStart: r.weekStart, weekEnd: r.weekEnd ?? null, content: r.content, silos: r.silos })),
      keepRows: sortPlan(syllabus.learningPlan)
        .filter((it) => it.kind === "lesson" && !selectedIds.includes(it.id))
        .map((it) => ({ weekStart: it.weekStart, weekEnd: it.weekEnd ?? null, content: it.content })),
    };
    console.log("[plan] regenerate rows", rows.map((r) => r.id));
    void regen.run(async () => {
      const r = await runAi<PlanGenResult>("regenerate-plan-rows", input, { demo: () => demoRegenerateRows(input), validate: validatePlanResult, forceDemo });
      if (r.ok === true) {
        const allowed = input.sources.map((s) => s.id);
        const mapped = toReviewRows(r.data, syllabus.clos, [], allowed);
        const items = r.data.items;
        const used = new Set<number>();
        const out: RegenRow[] = [];
        rows.forEach((row, idx) => {
          let k = items.findIndex((it, j) => !used.has(j) && it.rowId === row.id);
          if (k < 0) k = items.findIndex((it, j) => !used.has(j) && !it.rowId && it.weekStart === row.weekStart);
          if (k < 0 && idx < items.length && !used.has(idx) && !items[idx].rowId) k = idx;
          if (k < 0) return;
          used.add(k);
          const next = toReviewRows({ items: [items[k]], coverageWarnings: [] }, syllabus.clos, [], allowed).rows[0];
          out.push({ rowId: row.id, accept: true, next: { ...next, weekStart: row.weekStart, weekEnd: row.weekEnd ?? null, flag: undefined } });
        });
        const warnings = [...mapped.warnings.filter((w) => !w.includes("reserved examination"))];
        if (out.length < rows.length) warnings.push(`${rows.length - out.length} selected row(s) received no proposal and will stay unchanged.`);
        return { ok: true, data: { rows: out, warnings }, mode: r.mode, model: r.model } as AiRunResult<RegenProposal>;
      }
      const f = r as Extract<AiRunResult<PlanGenResult>, { ok: false }>;
      console.error("[plan] regeneration failed", f.error);
      return f as AiRunResult<RegenProposal>;
    }, ctx.warnings);
  };

  const apply = () => {
    const p = regen.proposal;
    if (!p) return;
    const accepted = p.rows.filter((r) => r.accept);
    if (!accepted.length) {
      toast.error("No regenerated rows are ticked.");
      return;
    }
    const origin: Item["origin"] = regen.mode === "live" ? "ai" : "demo";
    update((s) => ({
      ...s,
      learningPlan: s.learningPlan.map((it) => {
        const a = accepted.find((x) => x.rowId === it.id);
        if (!a) return it;
        return {
          ...it,
          content: a.next.content.trim(),
          silos: a.next.silos.trim(),
          cloIds: a.next.cloIds,
          activities: a.next.activities.trim(),
          assessment: a.next.assessment.trim(),
          materials: a.next.materials.trim(),
          origin,
          sourceResourceIds: a.next.sourceIds,
        };
      }),
    }));
    console.log("[plan] regenerated rows applied", accepted.map((a) => a.rowId));
    toast.success(`${accepted.length} row(s) updated`, { description: "Other rows were not changed." });
    regen.clear();
    onDone();
    onOpenChange(false);
  };

  const setRow = (rowId: string, patch: Partial<RegenRow> | ((r: RegenRow) => RegenRow)) =>
    regen.edit((p) => ({ ...p, rows: p.rows.map((r) => (r.rowId === rowId ? (typeof patch === "function" ? patch(r) : { ...r, ...patch }) : r)) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-[min(96vw,1100px)]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1b2466]">Regenerate selected rows</DialogTitle>
          <DialogDescription>
            {rows.length} row(s) selected: {rows.map((r) => weekLabel(r.weekStart, r.weekEnd)).join(", ") || "none"}. Other rows are sent as context only and are never changed.
          </DialogDescription>
        </DialogHeader>
        <AiReviewPanel
          title="Regenerate rows"
          status={regen.status}
          mode={regen.mode}
          error={regen.error}
          warnings={[...regen.warnings, ...(regen.proposal?.warnings ?? [])]}
          generateLabel="Regenerate"
          onGenerate={() => generate()}
          onUseDemo={() => generate(true)}
          canUseDemo={regen.canUseDemo}
          onAccept={apply}
          acceptLabel={`Apply ${regen.proposal?.rows.filter((r) => r.accept).length ?? 0} row(s)`}
          onRegenerate={() => generate()}
          onReject={() => regen.clear()}
          controls={
            <div className="space-y-3">
              {missing.length > 0 && <IssueList tone="warning" title="Required before regenerating" issues={missing} />}
              <ResourcePicker resources={data.resources} selected={resIds} onChange={setResIds} linkedIds={syllabus.resourceIds} />
              <div>
                <label htmlFor="regen-instr" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Instructions for these rows <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Textarea id="regen-instr" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="bg-white" placeholder="e.g. Make the activities more hands-on." />
              </div>
            </div>
          }
        >
          {regen.proposal && (
            <ul className="space-y-3">
              {regen.proposal.rows.map((r) => {
                const old = syllabus.learningPlan.find((x) => x.id === r.rowId);
                if (!old) return null;
                return (
                  <li key={r.rowId} className={cn("rounded-xl border bg-white p-3", r.accept ? "border-emerald-200" : "border-slate-200 opacity-80")}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Checkbox id={`acc-${r.rowId}`} checked={r.accept} onCheckedChange={(c) => setRow(r.rowId, { accept: c === true })} />
                      <label htmlFor={`acc-${r.rowId}`} className="text-sm font-semibold text-[#1b2466]">
                        {weekLabel(old.weekStart, old.weekEnd)} — accept new version
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                        <p className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Current</p>
                        <p className="font-medium text-slate-800">{old.content || "(no content)"}</p>
                        <p className="mt-1 whitespace-pre-line">{old.silos || "—"}</p>
                        <p className="mt-1">CLOs: {old.cloIds.map(cloCode).join(", ") || "—"}</p>
                        <p className="mt-1 whitespace-pre-line">Activities: {old.activities || "—"}</p>
                        <p className="mt-1 whitespace-pre-line">Assessment: {old.assessment || "—"}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Proposed</p>
                        <Input aria-label="Proposed learning content" value={r.next.content} onChange={(e) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, content: e.target.value } }))} />
                        <Cell label="Proposed SILOs" value={r.next.silos} onChange={(v) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, silos: v } }))} />
                        <ChipSelect ariaLabel="Proposed CLOs" options={cloOptions(syllabus.clos)} value={r.next.cloIds} onChange={(v) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, cloIds: v } }))} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Cell label="Proposed activities" value={r.next.activities} onChange={(v) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, activities: v } }))} />
                          <Cell label="Proposed assessment" value={r.next.assessment} onChange={(v) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, assessment: v } }))} />
                        </div>
                        <Input aria-label="Proposed material references" value={r.next.materials} placeholder="Instructional material references" onChange={(e) => setRow(r.rowId, (x) => ({ ...x, next: { ...x.next, materials: e.target.value } }))} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AiReviewPanel>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function LearningPlanSection({ syllabus, update, data }: SectionProps) {
  const sorted = useMemo(() => sortPlan(syllabus.learningPlan), [syllabus.learningPlan]);
  const exams = examWeekItems(data.settings);
  const examByWeek = new Map(exams.map((e) => [e.week, e.label]));
  const planExamRows = syllabus.learningPlan.filter((p) => p.kind === "exam");
  const examMismatch =
    planExamRows
      .map((e) => e.weekStart)
      .sort((a, b) => a - b)
      .join(",") !==
    exams
      .map((e) => e.week)
      .sort((a, b) => a - b)
      .join(",");

  const [selected, setSelected] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addWeek, setAddWeek] = useState<string>("1");
  const [genOpen, setGenOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [resIds, setResIds] = useState<string[]>(() =>
    data.resources.filter((r) => r.purpose === "instructional" && r.status === "extracted" && r.content.trim() && syllabus.resourceIds.includes(r.id)).map((r) => r.id)
  );
  const [instructions, setInstructions] = useState("");

  // SILO assistance (one row at a time)
  const silo = useAiProposal<SiloSupportResult>();
  const [siloRowId, setSiloRowId] = useState<string | null>(null);
  const [offerRowId, setOfferRowId] = useState<string | null>(null);
  const siloFocus = useRef<{ id: string; value: string } | null>(null);

  const lessons = sorted.filter((i) => i.kind === "lesson");
  const selectedLessons = selected.filter((id) => lessons.some((l) => l.id === id));
  const gaps = uncoveredWeeks(
    syllabus.learningPlan.map((i) => ({ weekStart: i.weekStart, weekEnd: i.weekEnd ?? null })),
    planExamRows.map((e) => ({ week: e.weekStart }))
  );
  const coveredCount = 18 - gaps.length;
  const cloIdSet = new Set(syllabus.clos.map((c) => c.id));

  const setPlan = (fn: (l: Item[]) => Item[]) => update((s) => ({ ...s, learningPlan: fn(s.learningPlan) }));
  /** User edits turn AI/demo rows into manual rows (protected from bulk replacement). */
  const patch = (id: string, p: Partial<Item>, keepOrigin = false) =>
    setPlan((l) => l.map((it) => (it.id === id ? { ...it, ...p, ...(keepOrigin || it.kind === "exam" ? {} : { origin: "manual" as const }) } : it)));

  const addItem = (week: number) => {
    const it = newLesson(week);
    setPlan((l) => [...l, it]);
    console.log("[plan] add item", week, it.id);
    toast.success(`Row added to ${weekLabel(week)}`);
  };

  const duplicate = (it: Item) => {
    setPlan((l) => {
      const i = l.findIndex((x) => x.id === it.id);
      const copy: Item = { ...it, id: uid("lp"), origin: "manual", cloIds: [...it.cloIds], sourceResourceIds: it.sourceResourceIds ? [...it.sourceResourceIds] : undefined };
      const next = [...l];
      next.splice(i + 1, 0, copy);
      return next;
    });
  };

  const swap = (aId: string, bId: string) =>
    setPlan((l) => {
      const arr = [...l];
      const a = arr.findIndex((x) => x.id === aId);
      const b = arr.findIndex((x) => x.id === bId);
      if (a < 0 || b < 0) return l;
      [arr[a], arr[b]] = [arr[b], arr[a]];
      return arr;
    });

  const syncExams = () => {
    const expected = new Set(exams.map((e) => e.week));
    setPlan((l) => ensureExamRows(l.filter((it) => it.kind !== "exam" || expected.has(it.weekStart)), exams));
    const clash = lessons.filter((l) => weeksOf(l.weekStart, l.weekEnd).some((w) => expected.has(w))).length;
    console.log("[plan] exam weeks synced", exams);
    toast.success("Examination weeks synced with settings", { description: clash ? `${clash} lesson row(s) now fall in examination weeks — move them.` : undefined });
  };

  const runSilo = (it: Item, forceDemo = false) => {
    if (!it.silos.trim() && !it.content.trim()) {
      toast.error("Write the SILOs (or learning content) first.");
      return;
    }
    setSiloRowId(it.id);
    setOfferRowId(null);
    const input: SiloSupportInput = {
      silos: it.silos,
      content: it.content,
      clos: syllabus.clos.map((c) => ({ id: c.id, code: c.code, statement: c.statement })),
      courseTitle: syllabus.descriptiveTitle,
    };
    console.log("[plan] suggest SILO support", it.id);
    void silo.run(async () => {
      const r = await runAi<SiloSupportResult>("suggest-silo-support", input, { demo: () => demoSiloSupport(input), validate: validateSiloSupport, forceDemo });
      if (r.ok === true) return { ...r, data: { ...r.data, cloIds: r.data.cloIds.filter((id) => cloIdSet.has(id)) } };
      return r;
    });
  };

  const acceptSilo = () => {
    const p = silo.proposal;
    if (!p || !siloRowId) return;
    setPlan((l) =>
      l.map((it) =>
        it.id === siloRowId
          ? {
              ...it,
              cloIds: Array.from(new Set([...it.cloIds, ...p.cloIds])),
              activities: mergeLines(it.activities, p.activities),
              assessment: mergeLines(it.assessment, p.assessment),
            }
          : it
      )
    );
    console.log("[plan] SILO support accepted", siloRowId);
    toast.success("Suggestions merged into the row");
    silo.clear();
    setSiloRowId(null);
  };

  const siloHandlers = (it: Item) => ({
    onFocus: (v: string) => (siloFocus.current = { id: it.id, value: v }),
    onBlur: (v: string) => {
      const f = siloFocus.current;
      siloFocus.current = null;
      if (f && f.id === it.id && f.value.trim() !== v.trim() && v.trim() && siloRowId !== it.id) setOfferRowId(it.id);
    },
  });

  const rowIssue = (it: Item): string | null => {
    if (it.kind !== "lesson") return null;
    const w = weeksOf(it.weekStart, it.weekEnd).find((x) => planExamRows.some((e) => e.weekStart === x));
    if (w !== undefined) return `Week ${w} is reserved for ${planExamRows.find((e) => e.weekStart === w)?.examLabel || "an examination"}. Move this row.`;
    if (it.weekStart < 1 || it.weekStart > 18 || (it.weekEnd && (it.weekEnd < it.weekStart || it.weekEnd > 18))) return "Invalid week.";
    if (it.cloIds.some((id) => !cloIdSet.has(id))) return "Refers to a CLO that was removed.";
    return null;
  };

  const siblingsOf = (it: Item) => sorted.filter((x) => x.kind === "lesson" && x.weekStart === it.weekStart);

  const siloPanel = (it: Item) =>
    siloRowId === it.id ? (
      <AiReviewPanel
        title={`Suggest CLOs, activities & assessment · ${weekLabel(it.weekStart, it.weekEnd)}`}
        description="Based on this row’s SILOs and learning content. Accepting merges into this row only."
        status={silo.status}
        mode={silo.mode}
        error={silo.error}
        warnings={silo.warnings}
        onGenerate={() => runSilo(it)}
        onUseDemo={() => runSilo(it, true)}
        canUseDemo={silo.canUseDemo}
        onAccept={acceptSilo}
        acceptLabel="Accept into row"
        onRegenerate={() => runSilo(it)}
        onReject={() => {
          silo.clear();
          setSiloRowId(null);
        }}
      >
        {silo.proposal && (
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Corresponding CLOs</p>
              <ChipSelect ariaLabel="Suggested CLOs" options={cloOptions(syllabus.clos)} value={silo.proposal.cloIds} onChange={(v) => silo.edit((p) => ({ ...p, cloIds: v }))} emptyText="No CLOs defined yet." />
              {silo.proposal.explanation && <p className="mt-2 text-xs italic text-slate-600">{silo.proposal.explanation}</p>}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Teaching and Learning Activities (one per line)</p>
              <Cell label="Suggested activities" value={silo.proposal.activities.join("\n")} onChange={(v) => silo.edit((p) => ({ ...p, activities: v.split("\n") }))} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Assessment (one per line)</p>
              <Cell label="Suggested assessment" value={silo.proposal.assessment.join("\n")} onChange={(v) => silo.edit((p) => ({ ...p, assessment: v.split("\n") }))} />
            </div>
          </div>
        )}
      </AiReviewPanel>
    ) : offerRowId === it.id ? (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
        <Sparkles className="size-3.5" /> SILOs changed — suggest matching CLOs, activities and assessment?
        <Button size="sm" variant="outline" className="h-7 border-violet-300 bg-white text-xs" onClick={() => runSilo(it)}>
          Suggest
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOfferRowId(null)}>
          Dismiss
        </Button>
      </div>
    ) : null;

  const siloButton = (it: Item) => (
    <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-[11px] text-violet-800 hover:bg-violet-50" onClick={() => runSilo(it)} disabled={silo.status === "running" && siloRowId === it.id}>
      <Sparkles className="size-3.5" /> Suggest CLOs, activities & assessment
    </Button>
  );

  const rowActions = (it: Item) => (
    <div className="flex items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Duplicate ${weekLabel(it.weekStart, it.weekEnd)} row`} title="Duplicate row" onClick={() => duplicate(it)}>
        <Copy className="size-4" />
      </Button>
      <DeleteIconButton label={`Delete ${weekLabel(it.weekStart, it.weekEnd)} row`} onClick={() => setDeleteId(it.id)} />
    </div>
  );

  const reorder = (it: Item) => {
    const sib = siblingsOf(it);
    if (sib.length < 2) return null;
    const idx = sib.findIndex((x) => x.id === it.id);
    return <ReorderButtons index={idx} count={sib.length} label={`row within ${weekLabel(it.weekStart)}`} onMove={(from, to) => swap(sib[from].id, sib[to].id)} />;
  };

  const selectBox = (it: Item) => (
    <Checkbox
      checked={selected.includes(it.id)}
      onCheckedChange={(c) => setSelected((l) => (c === true ? [...l, it.id] : l.filter((x) => x !== it.id)))}
      aria-label={`Select ${weekLabel(it.weekStart, it.weekEnd)} row for regeneration`}
    />
  );

  const examLabelInput = (it: Item, cls?: string) => (
    <Input
      aria-label={`Examination label for week ${it.weekStart}`}
      value={it.examLabel ?? ""}
      onChange={(e) => patch(it.id, { examLabel: e.target.value })}
      className={cn("h-8 bg-white text-center font-bold uppercase tracking-wide text-[#1b2466]", cls)}
    />
  );

  const originBadge = (it: Item) => (it.origin && it.origin !== "manual" ? <SourceBadge source={it.origin} /> : null);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Panel
        title="Course Learning Plan"
        description={`${lessons.length} lesson row(s) · ${coveredCount}/18 weeks covered · examinations in weeks ${planExamRows.map((e) => e.weekStart).join(", ") || "—"}`}
        actions={
          <>
            <Button className="bg-violet-700 hover:bg-violet-800" size="sm" onClick={() => setGenOpen(true)}>
              <Wand2 className="size-4" /> Generate 18-week plan with AI
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedLessons.length} onClick={() => setRegenOpen(true)}>
              <RefreshCw className="size-4" /> Regenerate selected{selectedLessons.length ? ` (${selectedLessons.length})` : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="plan-add-week" className="mb-1 block text-xs font-medium text-slate-600">
              Add a row to week
            </label>
            <Select value={addWeek} onValueChange={setAddWeek}>
              <SelectTrigger id="plan-add-week" className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKS.map((w) => (
                  <SelectItem key={w} value={String(w)} disabled={planExamRows.some((e) => e.weekStart === w)}>
                    Week {w}
                    {planExamRows.some((e) => e.weekStart === w) ? " · examination" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-9 bg-[#1b2466] hover:bg-[#262f7a]" onClick={() => addItem(Number(addWeek))}>
            <Plus className="size-4" /> Add row
          </Button>
          {selected.length > 0 && (
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setSelected([])}>
              Clear selection ({selectedLessons.length})
            </Button>
          )}
        </div>
        {gaps.length > 0 && lessons.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-amber-900">
            <CalendarRange className="size-3.5" /> Weeks without entries:
            {gaps.map((w) => (
              <Button key={w} size="sm" variant="outline" className="h-6 border-amber-300 bg-amber-50 px-2 text-[11px] text-amber-900 hover:bg-amber-100" onClick={() => addItem(w)} title={`Add a row to week ${w}`}>
                + Week {w}
              </Button>
            ))}
          </div>
        )}
        {examMismatch && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="size-4" />
            Examination rows (weeks {planExamRows.map((e) => e.weekStart).join(", ") || "none"}) differ from Templates &amp; Settings (weeks {exams.map((e) => e.week).join(", ")}).
            <Button size="sm" variant="outline" className="ml-auto h-7 bg-white" onClick={syncExams}>
              Sync exam weeks with settings
            </Button>
          </div>
        )}
      </Panel>

      {lessons.length === 0 && (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No lessons planned yet"
          description="Generate a complete 18-week plan from your course description, CLOs and resources, or add rows manually week by week."
          action={
            <Button className="bg-violet-700 hover:bg-violet-800" onClick={() => setGenOpen(true)}>
              <Wand2 className="size-4" /> Generate 18-week plan with AI
            </Button>
          }
        />
      )}

      {sorted.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <ScrollTable minWidth={1480} className="bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1b2466] text-xs text-white">
                  <tr>
                    <th className="w-16 px-2 py-2.5">
                      <span className="sr-only">Select and order</span>
                    </th>
                    <th className="w-36 px-2 py-2.5">Week</th>
                    <th className="w-52 px-2 py-2.5">Learning Content</th>
                    <th className="w-72 px-2 py-2.5">Specific Intended Learning Outcomes</th>
                    <th className="w-40 px-2 py-2.5">Corresponding CLOs</th>
                    <th className="w-60 px-2 py-2.5">Teaching and Learning Activities</th>
                    <th className="w-52 px-2 py-2.5">Assessment</th>
                    <th className="w-48 px-2 py-2.5">Instructional Material References</th>
                    <th className="w-20 px-2 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((it) => {
                    if (it.kind === "exam")
                      return (
                        <tr key={it.id} className="border-t border-slate-200 bg-[#1b2466]/[0.06]">
                          <td colSpan={9} className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              <Lock className="size-4 text-[#1b2466]" aria-label="Locked examination week" />
                              <span className="w-20 text-xs font-semibold text-slate-600">Week {it.weekStart}</span>
                              <div className="mx-auto w-full max-w-md">{examLabelInput(it)}</div>
                              <span className="w-56 text-right text-[11px] text-slate-500">Reserved examination week — no lessons</span>
                            </div>
                          </td>
                        </tr>
                      );
                    const issue = rowIssue(it);
                    const emptyContent = !it.content.trim();
                    const extra = siloPanel(it);
                    return [
                      <tr key={it.id} className={cn("border-t border-slate-200 align-top", issue && "bg-red-50/50", selected.includes(it.id) && "bg-violet-50/60")}>
                        <td className="px-2 py-2">
                          <div className="flex items-start gap-1">
                            <div className="pt-1.5">{selectBox(it)}</div>
                            {reorder(it)}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <WeekEditor label={weekLabel(it.weekStart, it.weekEnd)} start={it.weekStart} end={it.weekEnd} onChange={(s, e) => patch(it.id, { weekStart: s, weekEnd: e }, true)} examWeeks={planExamRows.map((e) => e.weekStart)} />
                          <div className="mt-1">{originBadge(it)}</div>
                          {issue && <p className="mt-1 text-[11px] font-medium text-red-700">{issue}</p>}
                        </td>
                        <td className="px-2 py-2">
                          <Cell label={`${weekLabel(it.weekStart, it.weekEnd)} learning content`} value={it.content} invalid={emptyContent} placeholder="Required" onChange={(v) => patch(it.id, { content: v })} />
                        </td>
                        <td className="px-2 py-2">
                          <Cell label={`${weekLabel(it.weekStart, it.weekEnd)} SILOs`} value={it.silos} placeholder="One outcome per line" onChange={(v) => patch(it.id, { silos: v })} {...siloHandlers(it)} />
                          {siloButton(it)}
                        </td>
                        <td className="px-2 py-2">
                          <ChipSelect ariaLabel={`${weekLabel(it.weekStart, it.weekEnd)} corresponding CLOs`} options={cloOptions(syllabus.clos)} value={it.cloIds} onChange={(v) => patch(it.id, { cloIds: v })} emptyText="Add CLOs in section F" />
                        </td>
                        <td className="px-2 py-2">
                          <Cell label={`${weekLabel(it.weekStart, it.weekEnd)} activities`} value={it.activities} placeholder="One per line" onChange={(v) => patch(it.id, { activities: v })} />
                        </td>
                        <td className="px-2 py-2">
                          <Cell label={`${weekLabel(it.weekStart, it.weekEnd)} assessment`} value={it.assessment} placeholder="One per line" onChange={(v) => patch(it.id, { assessment: v })} />
                        </td>
                        <td className="px-2 py-2">
                          <Cell label={`${weekLabel(it.weekStart, it.weekEnd)} material references`} value={it.materials} onChange={(v) => patch(it.id, { materials: v })} />
                        </td>
                        <td className="px-1 py-2">{rowActions(it)}</td>
                      </tr>,
                      extra ? (
                        <tr key={`${it.id}-ai`} className="bg-white">
                          <td colSpan={9} className="px-3 pb-3">
                            {extra}
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </ScrollTable>
          </div>

          {/* Mobile / tablet cards */}
          <div className="space-y-3 lg:hidden">
            {sorted.map((it) => {
              if (it.kind === "exam")
                return (
                  <div key={it.id} className="rounded-xl border border-[#1b2466]/20 bg-[#1b2466]/[0.06] p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Lock className="size-3.5 text-[#1b2466]" /> Week {it.weekStart} · reserved examination week
                    </p>
                    {examLabelInput(it)}
                  </div>
                );
              const issue = rowIssue(it);
              const L = weekLabel(it.weekStart, it.weekEnd);
              const lbl = (t: string, c: ReactNode) => (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-600">{t}</p>
                  {c}
                </div>
              );
              return (
                <div key={it.id} className={cn("rounded-xl border bg-white p-3 shadow-sm", issue ? "border-red-200" : "border-slate-200")}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="pt-1.5">{selectBox(it)}</div>
                      {reorder(it)}
                      <WeekEditor label={L} start={it.weekStart} end={it.weekEnd} onChange={(s, e) => patch(it.id, { weekStart: s, weekEnd: e }, true)} examWeeks={planExamRows.map((e) => e.weekStart)} />
                    </div>
                    <div className="flex items-center gap-1">
                      {originBadge(it)}
                      {rowActions(it)}
                    </div>
                  </div>
                  {issue && <p className="mb-2 text-xs font-medium text-red-700">{issue}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {lbl("Learning Content", <Cell label={`${L} learning content`} value={it.content} invalid={!it.content.trim()} placeholder="Required" onChange={(v) => patch(it.id, { content: v })} />)}
                    {lbl(
                      "Specific Intended Learning Outcomes",
                      <>
                        <Cell label={`${L} SILOs`} value={it.silos} placeholder="One outcome per line" onChange={(v) => patch(it.id, { silos: v })} {...siloHandlers(it)} />
                        {siloButton(it)}
                      </>
                    )}
                    {lbl("Corresponding CLOs", <ChipSelect ariaLabel={`${L} corresponding CLOs`} options={cloOptions(syllabus.clos)} value={it.cloIds} onChange={(v) => patch(it.id, { cloIds: v })} emptyText="Add CLOs in section F" />)}
                    {lbl("Teaching and Learning Activities", <Cell label={`${L} activities`} value={it.activities} onChange={(v) => patch(it.id, { activities: v })} />)}
                    {lbl("Assessment", <Cell label={`${L} assessment`} value={it.assessment} onChange={(v) => patch(it.id, { assessment: v })} />)}
                    {lbl("Instructional Material References", <Cell label={`${L} material references`} value={it.materials} onChange={(v) => patch(it.id, { materials: v })} />)}
                  </div>
                  {siloPanel(it) && <div className="mt-3">{siloPanel(it)}</div>}
                </div>
              );
            })}
          </div>
          <p className="text-xs italic text-slate-500">Note: {data.institutional.scheduleNote}</p>
        </>
      )}

      <GeneratePlanDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        syllabus={syllabus}
        data={data}
        update={update}
        resIds={resIds}
        setResIds={setResIds}
        instructions={instructions}
        setInstructions={setInstructions}
      />
      <RegenerateDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        syllabus={syllabus}
        data={data}
        update={update}
        selectedIds={selectedLessons}
        onDone={() => setSelected([])}
        resIds={resIds}
        setResIds={setResIds}
        instructions={instructions}
        setInstructions={setInstructions}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this plan row?"
        description="The row and its content will be removed from the learning plan. You can discard unsaved changes to undo."
        confirmLabel="Delete row"
        destructive
        onConfirm={() => {
          const id = deleteId;
          setPlan((l) => l.filter((x) => x.id !== id));
          setSelected((l) => l.filter((x) => x !== id));
          if (siloRowId === id) {
            silo.clear();
            setSiloRowId(null);
          }
          console.log("[plan] delete row", id);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
