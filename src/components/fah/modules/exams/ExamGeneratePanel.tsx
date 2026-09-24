"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sectionTypeLabel, toRoman } from "@/lib/fah/calc";
import { newSection } from "@/lib/fah/factories";
import { buildSourceContext, runAi, type AiRunResult } from "@/lib/fah/services/ai";
import {
  demoGenerateExam,
  validateGenerateResult,
  type GenerateExamInput,
  type GenerateExamResult,
  type GenerateSectionPlan,
} from "@/lib/fah/ai/demo/exam";
import type { AppData, Exam, Question, QuestionType } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../common/ai-review";
import { Field, NumberInput, Panel, ScrollTable } from "../../common/ui";
import { href } from "../../common/router";
import { genToQuestion, QUESTION_TYPE_OPTIONS, syllabusClos } from "./shared";
import { ResourceStatusPill } from "./ExamDetailsPanel";
import type { ExamUpdater } from "./ExamEditor";

interface PlanRow {
  include: boolean;
  count: number | null;
}

export interface GenProposal {
  sections: { sectionId: string; title: string; type: QuestionType; questions: Question[] }[];
  warnings: string[];
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function ExamGeneratePanel({ exam, setExam, data, onDone }: { exam: Exam; setExam: ExamUpdater; data: AppData; onDone: () => void }) {
  const [plan, setPlan] = useState<Record<string, PlanRow>>({});
  const proposal = useAiProposal<GenProposal>();
  const ctx = useMemo(() => buildSourceContext(data.resources, exam.resourceIds), [data.resources, exam.resourceIds]);
  const selectedResources = data.resources.filter((r) => exam.resourceIds.includes(r.id));
  const clos = syllabusClos(data, exam);
  const levels = data.institutional.tosCognitiveLevels;

  const rowFor = (secId: string): PlanRow => {
    if (plan[secId]) return plan[secId];
    const s = exam.sections.find((x) => x.id === secId)!;
    const existing = s.questions.length;
    const planned = s.plannedItems ?? null;
    const count = planned !== null ? Math.max(0, planned - existing) : existing === 0 ? 5 : 0;
    return { include: count > 0, count };
  };
  const setRow = (secId: string, patch: Partial<PlanRow>) => setPlan((p) => ({ ...p, [secId]: { ...rowFor(secId), ...patch } }));
  const updSection = (id: string, patch: Partial<Exam["sections"][number]>) => setExam((e) => ({ ...e, sections: e.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const sectionPlans: GenerateSectionPlan[] = exam.sections
    .filter((s) => rowFor(s.id).include && (rowFor(s.id).count ?? 0) > 0)
    .map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      typeLabel: sectionTypeLabel(s),
      count: Math.min(60, rowFor(s.id).count ?? 0),
      points: s.defaultPoints,
      instructions: s.instructions || undefined,
    }));
  const totalRequested = sectionPlans.reduce((a, s) => a + s.count, 0);

  const normalize = (res: GenerateExamResult, mode: "live" | "demo", plans: GenerateSectionPlan[]): GenProposal => {
    const warnings = [...res.coverageWarnings];
    const origin = mode === "demo" ? "demo" : "ai";
    const sections = plans.map((pl, i) => {
      const got = res.sections.find((s) => s.sectionId === pl.id) ?? (res.sections.length === plans.length ? res.sections[i] : undefined);
      let gen = got?.questions ?? [];
      if (gen.length > pl.count) {
        warnings.push(`${pl.title}: the model returned ${gen.length} items; trimmed to the requested ${pl.count}.`);
        gen = gen.slice(0, pl.count);
      }
      const qs = gen.map((g) =>
        genToQuestion(g, pl.type, { clos, levels, origin, points: null, validSourceIds: ctx.sources.map((s) => s.id) })
      );
      if (qs.length < pl.count) {
        warnings.push(`${pl.title}: the model returned ${qs.length} of ${pl.count} requested items; ${pl.count - qs.length} empty placeholder(s) were added for you to write.`);
        while (qs.length < pl.count) {
          const q = genToQuestion({ prompt: "" }, pl.type, { clos, levels, origin, points: null, validSourceIds: [] });
          q.flags = ["Placeholder — the AI returned fewer items than requested. Write this question or delete it."];
          qs.push(q);
        }
      }
      return { sectionId: pl.id, title: pl.title, type: pl.type, questions: qs };
    });
    return { sections, warnings };
  };

  const generate = (forceDemo = false) => {
    if (!sectionPlans.length) {
      toast.error("Choose at least one section and a number of items to generate.");
      return;
    }
    const plans = sectionPlans;
    const input: GenerateExamInput = {
      exam: { courseCode: exam.courseCode, courseTitle: exam.courseTitle, term: exam.term, title: exam.title },
      coverage: exam.coverage,
      instructions: exam.aiInstructions,
      sections: plans,
      clos: clos.map((c) => ({ code: c.code, statement: c.statement })),
      levels,
      sources: ctx.sources.map((s) => ({ id: s.id, title: s.title, text: s.text })),
      avoid: exam.sections.flatMap((s) => s.questions.map((q) => q.prompt)).filter(Boolean),
    };
    console.log("[exam-generate] request", { sections: plans.length, items: totalRequested, sources: input.sources.length, forceDemo });
    void proposal.run(async () => {
      const r = await runAi<GenerateExamResult>("generate-exam", input, { demo: () => demoGenerateExam(input), validate: validateGenerateResult, forceDemo });
      if (r.ok === true) {
        const data2 = normalize(r.data, r.mode, plans);
        console.log("[exam-generate] proposal ready", { mode: r.mode, sections: data2.sections.length, warnings: data2.warnings.length });
        return { ...r, data: data2 } as AiRunResult<GenProposal>;
      }
      const f = r as Extract<AiRunResult<GenerateExamResult>, { ok: false }>;
      console.error("[exam-generate] failed", f.error);
      return f as AiRunResult<GenProposal>;
    }, ctx.warnings);
  };

  const editQ = (secId: string, qid: string, patch: Partial<Question>) =>
    proposal.edit((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.sectionId === secId ? { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) } : s)),
    }));
  const removeQ = (secId: string, qid: string) =>
    proposal.edit((p) => ({ ...p, sections: p.sections.map((s) => (s.sectionId === secId ? { ...s, questions: s.questions.filter((q) => q.id !== qid) } : s)) }));

  const accept = () => {
    const p = proposal.proposal;
    if (!p) return;
    setExam((e) => ({
      ...e,
      sections: e.sections.map((s) => {
        const ps = p.sections.find((x) => x.sectionId === s.id);
        if (!ps || !ps.questions.length) return s;
        // Existing questions and manual edits are preserved; generated items are appended (empty sections are simply filled).
        return { ...s, questions: s.questions.length ? [...s.questions, ...ps.questions] : ps.questions };
      }),
    }));
    const n = p.sections.reduce((a, s) => a + s.questions.length, 0);
    console.log("[exam-generate] accepted", { items: n });
    toast.success(`${n} generated item${n === 1 ? "" : "s"} added`, { description: "Review them in Sections & questions, then save." });
    setPlan({});
    proposal.clear();
    onDone();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Generation plan"
        description="Set how many items to generate per section. Types, counts and points are enforced: extra items are trimmed and missing ones become flagged placeholders."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const s = newSection("identification", `Test ${toRoman(exam.sections.length + 1)}`);
              setExam((e) => ({ ...e, sections: [...e.sections, s] }));
            }}
          >
            <Plus className="size-4" /> Add section
          </Button>
        }
      >
        {exam.sections.length === 0 ? (
          <p className="text-sm text-slate-500">Add a section to plan the generation.</p>
        ) : (
          <ScrollTable minWidth={820}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-3 py-2">Use</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="w-52 px-3 py-2">Question type</th>
                  <th className="w-20 px-3 py-2 text-center">Existing</th>
                  <th className="w-28 px-3 py-2">Planned</th>
                  <th className="w-28 px-3 py-2">Generate now</th>
                  <th className="w-28 px-3 py-2">Points / item</th>
                </tr>
              </thead>
              <tbody>
                {exam.sections.map((s, i) => {
                  const r = rowFor(s.id);
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <Checkbox checked={r.include} onCheckedChange={(v) => setRow(s.id, { include: !!v })} aria-label={`Generate items for ${s.title || `section ${i + 1}`}`} />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={s.title} onChange={(e) => updSection(s.id, { title: e.target.value })} aria-label="Section title" className="h-8 bg-white" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={s.type} onValueChange={(v) => updSection(s.id, { type: v as QuestionType })} disabled={s.questions.length > 0}>
                          <SelectTrigger aria-label="Question type" className="h-8 w-full bg-white" title={s.questions.length ? "Change the type in Sections & questions" : undefined}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">{s.questions.length}</td>
                      <td className="px-3 py-2">
                        <NumberInput value={s.plannedItems} min={0} onChange={(v) => updSection(s.id, { plannedItems: v })} ariaLabel="Planned items" className="h-8" placeholder="—" />
                      </td>
                      <td className="px-3 py-2">
                        <NumberInput value={r.count} min={0} max={60} onChange={(v) => setRow(s.id, { count: v, include: (v ?? 0) > 0 })} ariaLabel="Items to generate" className="h-8" />
                      </td>
                      <td className="px-3 py-2">
                        <NumberInput value={s.defaultPoints} min={0} step={0.5} onChange={(v) => updSection(s.id, { defaultPoints: v })} ariaLabel="Points per item" className="h-8" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <p className="mt-2 text-xs text-slate-500">{totalRequested} item(s) will be requested. Existing questions are never changed by generation.</p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sources" description="Only resources with readable (extracted) content are sent. Change the selection in Exam details.">
          {selectedResources.length === 0 ? (
            <p className="text-sm text-slate-500">
              No resources selected. Questions will be generic unless you{" "}
              <a className="font-medium text-[#1b2466] underline" href={href("/resources")}>
                add resources
              </a>{" "}
              and select them in Exam details.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {selectedResources.map((r) => {
                const ex = ctx.excluded.find((x) => x.id === r.id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <ResourceStatusPill r={r} />
                    <span className={ex ? "text-slate-400 line-through" : "text-slate-800"}>{r.title}</span>
                    {ex && <span className="text-xs text-slate-500">— excluded: {ex.reason}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {ctx.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {ctx.warnings.map((w) => (
                <li key={w} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Scope" description="Edited in Exam details; shown here for reference.">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{exam.coverage || <span className="italic text-slate-400">Not specified</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Additional instructions</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{exam.aiInstructions || <span className="italic text-slate-400">None</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">CLOs available for tagging</dt>
              <dd className="text-slate-800">{clos.length ? clos.map((c) => c.code).join(", ") : <span className="italic text-slate-400">Link a syllabus to tag CLOs</span>}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <AiReviewPanel
        title="Generate questions with AI"
        description="Drafts questions for the planned sections from the selected sources. Nothing changes until you accept; you can edit the preview first."
        status={proposal.status}
        mode={proposal.mode}
        error={proposal.error}
        warnings={[...proposal.warnings, ...(proposal.proposal?.warnings ?? [])]}
        generateLabel={`Generate ${totalRequested} item${totalRequested === 1 ? "" : "s"}`}
        onGenerate={() => generate(false)}
        onRegenerate={() => generate(false)}
        onUseDemo={() => generate(true)}
        canUseDemo={proposal.canUseDemo}
        onAccept={accept}
        acceptLabel="Accept & add to exam"
        onReject={() => proposal.clear()}
      >
        {proposal.proposal && (
          <div className="space-y-4">
            <p className="flex items-start gap-1.5 text-xs text-slate-600">
              <Info className="mt-0.5 size-3.5 shrink-0" /> Accepted items are appended after existing questions (empty sections are filled). Remove any item you do not want.
            </p>
            {proposal.proposal.sections.map((s) => (
              <div key={s.sectionId} className="rounded-xl border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-[#1b2466]">
                  {s.title} · {QUESTION_TYPE_OPTIONS.find((o) => o.value === s.type)?.label} · {s.questions.length} item(s)
                </p>
                <ol className="divide-y divide-slate-100">
                  {s.questions.map((q, qi) => (
                    <li key={q.id} className="space-y-2 px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 w-6 text-right font-mono text-xs font-semibold text-slate-500">{qi + 1}.</span>
                        <Textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) => editQ(s.sectionId, q.id, { prompt: e.target.value })}
                          aria-label={`Proposed question ${qi + 1}`}
                          className="flex-1 bg-white text-sm"
                        />
                        <Button variant="ghost" size="icon" className="size-8 text-slate-500" onClick={() => removeQ(s.sectionId, q.id)} aria-label={`Remove proposed question ${qi + 1}`}>
                          <X className="size-4" />
                        </Button>
                      </div>
                      {s.type === "multiple-choice" && q.choices && (
                        <div className="ml-8 grid gap-1 sm:grid-cols-2">
                          {q.choices.map((c, ci) => (
                            <label key={c.id} className="flex items-center gap-1.5 text-sm">
                              <input
                                type="radio"
                                name={`gen-${q.id}`}
                                checked={q.correctChoiceId === c.id}
                                onChange={() => editQ(s.sectionId, q.id, { correctChoiceId: c.id })}
                                aria-label={`Mark ${LETTERS[ci]} correct`}
                                className="accent-emerald-700"
                              />
                              <span className="w-4 font-mono text-xs">{LETTERS[ci]}.</span>
                              <Input
                                value={c.text}
                                onChange={(e) => editQ(s.sectionId, q.id, { choices: q.choices!.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })}
                                aria-label={`Choice ${LETTERS[ci]}`}
                                className="h-7 bg-white text-sm"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      {s.type !== "multiple-choice" && (
                        <div className="ml-8 grid gap-2 md:grid-cols-2">
                          <Field label="Answer key (teacher only)">
                            <Textarea rows={2} value={q.answerKey ?? ""} onChange={(e) => editQ(s.sectionId, q.id, { answerKey: e.target.value })} className="bg-slate-50 text-xs" />
                          </Field>
                          {s.type !== "identification" && (
                            <Field label="Rubric (teacher only)">
                              <Textarea rows={2} value={q.rubric ?? ""} onChange={(e) => editQ(s.sectionId, q.id, { rubric: e.target.value })} className="bg-slate-50 text-xs" />
                            </Field>
                          )}
                        </div>
                      )}
                      {q.code && <pre className="ml-8 overflow-x-auto rounded-md bg-slate-950 p-2 font-mono text-xs text-slate-100">{q.code}</pre>}
                      <p className="ml-8 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {q.topic && <span>Topic: {q.topic}</span>}
                        {q.cloId && <span>{clos.find((c) => c.id === q.cloId)?.code}</span>}
                        {q.cognitiveLevel && <span>{q.cognitiveLevel}</span>}
                        {q.sourceResourceIds?.length ? <span>Source: {q.sourceResourceIds.map((id) => data.resources.find((r) => r.id === id)?.title ?? id).join(", ")}</span> : null}
                        {q.flags?.map((f) => (
                          <span key={f} className="rounded bg-amber-100 px-1.5 font-medium text-amber-900">
                            {f}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </AiReviewPanel>
    </div>
  );
}

