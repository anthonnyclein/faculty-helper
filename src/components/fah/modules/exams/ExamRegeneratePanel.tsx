"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { examItems, questionPoints, sectionTypeLabel } from "@/lib/fah/calc";
import { buildSourceContext, runAi, type AiRunResult } from "@/lib/fah/services/ai";
import { demoRegenerate, validateRegenerateResult, type RegenerateInput, type RegenerateResult } from "@/lib/fah/ai/demo/exam";
import type { AppData, Exam, Question } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../common/ai-review";
import { genToQuestion, syllabusClos } from "./shared";
import type { ExamUpdater } from "./ExamEditor";

interface RegenItem {
  questionId: string;
  sectionId: string;
  label: string;
  old: Question;
  next: Question;
}

interface RegenProposal {
  items: RegenItem[];
  warnings: string[];
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Regenerate selected questions: old vs new per question, accepted individually. Unselected questions are never touched. */
export function ExamRegeneratePanel({
  exam,
  setExam,
  data,
  selected,
  setSelected,
  runRequest,
}: {
  exam: Exam;
  setExam: ExamUpdater;
  data: AppData;
  selected: string[];
  setSelected: (fn: string[] | ((s: string[]) => string[])) => void;
  runRequest: number;
}) {
  const proposal = useAiProposal<RegenProposal>();
  const [direction, setDirection] = useState("");
  const attempt = useRef(0);
  const items = useMemo(() => examItems(exam), [exam]);
  const clos = syllabusClos(data, exam);
  const levels = data.institutional.tosCognitiveLevels;

  const run = (forceDemo = false) => {
    const chosen = items.filter((i) => selected.includes(i.questionId));
    if (!chosen.length) {
      toast.error("Select at least one question (checkbox) to regenerate.");
      return;
    }
    const ctx = buildSourceContext(data.resources, exam.resourceIds);
    attempt.current += 1;
    const input: RegenerateInput = {
      exam: { courseCode: exam.courseCode, courseTitle: exam.courseTitle, term: exam.term, title: exam.title },
      coverage: exam.coverage,
      instructions: exam.aiInstructions,
      direction,
      clos: clos.map((c) => ({ code: c.code, statement: c.statement })),
      levels,
      sources: ctx.sources.map((s) => ({ id: s.id, title: s.title, text: s.text })),
      questions: chosen.map((i) => ({
        id: i.questionId,
        type: i.section.type,
        typeLabel: sectionTypeLabel(i.section),
        prompt: i.question.prompt,
        choices: i.question.choices?.map((c) => c.text),
        topic: i.question.topic,
        cloCode: clos.find((c) => c.id === i.question.cloId)?.code,
        cognitiveLevel: i.question.cognitiveLevel,
        points: i.points,
      })),
      avoid: items.filter((i) => !selected.includes(i.questionId)).map((i) => i.question.prompt).filter(Boolean),
      attempt: attempt.current,
    };
    console.log("[exam-regenerate] request", { count: chosen.length, attempt: attempt.current, forceDemo });
    void proposal.run(async () => {
      const r = await runAi<RegenerateResult>("regenerate-questions", input, { demo: () => demoRegenerate(input), validate: validateRegenerateResult, forceDemo });
      if (r.ok === true) {
        const warnings = [...r.data.coverageWarnings];
        const origin = r.mode === "demo" ? "demo" : "ai";
        const out: RegenItem[] = [];
        chosen.forEach((i) => {
          const g = r.data.questions.find((x) => x.id === i.questionId);
          if (!g) {
            warnings.push(`No replacement was returned for item ${i.label}; it is unchanged.`);
            return;
          }
          const nq = genToQuestion(g, i.section.type, { clos, levels, origin, points: i.question.points, validSourceIds: ctx.sources.map((s) => s.id) });
          // Keep identity and teacher settings so TOS mappings and layout stay attached to the item.
          nq.id = i.question.id;
          nq.imageDataUrl = i.question.imageDataUrl;
          nq.answerLines = i.question.answerLines ?? nq.answerLines;
          nq.cloId = nq.cloId ?? i.question.cloId;
          nq.cognitiveLevel = nq.cognitiveLevel ?? i.question.cognitiveLevel;
          nq.topic = nq.topic ?? i.question.topic;
          out.push({ questionId: i.questionId, sectionId: i.sectionId, label: i.label, old: i.question, next: nq });
        });
        console.log("[exam-regenerate] proposal ready", { mode: r.mode, items: out.length });
        return { ...r, data: { items: out, warnings } } as AiRunResult<RegenProposal>;
      }
      console.error("[exam-regenerate] failed", (r as { error?: string }).error);
      return r as unknown as AiRunResult<RegenProposal>;
    }, ctx.warnings);
  };

  // "Replace" from a single question's menu.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (runRequest > 0) runRef.current(false);
  }, [runRequest]);

  const applyOne = (it: RegenItem) => {
    setExam((e) => ({
      ...e,
      sections: e.sections.map((s) => (s.id === it.sectionId ? { ...s, questions: s.questions.map((q) => (q.id === it.questionId ? it.next : q)) } : s)),
    }));
    setSelected((sel) => sel.filter((x) => x !== it.questionId));
    console.log("[exam-regenerate] accepted", it.questionId);
  };

  const dropOne = (qid: string) => {
    proposal.edit((p) => ({ ...p, items: p.items.filter((x) => x.questionId !== qid) }));
  };

  // Close the panel once every proposed item has been handled.
  const { status: pStatus, proposal: pData, clear: pClear } = proposal;
  useEffect(() => {
    if (pStatus === "ready" && pData && pData.items.length === 0) pClear();
  }, [pStatus, pData, pClear]);

  if (!selected.length && proposal.status === "idle") return null;

  return (
    <AiReviewPanel
      title={`Regenerate selected questions (${selected.length} selected)`}
      description="Writes a new version of each selected question (same type, topic and level). Compare old and new, then accept individually. Unselected questions are not touched."
      status={proposal.status}
      mode={proposal.mode}
      error={proposal.error}
      warnings={[...proposal.warnings, ...(proposal.proposal?.warnings ?? [])]}
      generateLabel="Regenerate selected"
      onGenerate={() => run(false)}
      onRegenerate={() => run(false)}
      onUseDemo={() => run(true)}
      canUseDemo={proposal.canUseDemo}
      onAccept={() => {
        const list = proposal.proposal?.items ?? [];
        list.forEach(applyOne);
        toast.success(`${list.length} question${list.length === 1 ? "" : "s"} replaced`);
        proposal.clear();
      }}
      acceptLabel="Accept all"
      onReject={() => proposal.clear()}
      controls={
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
            Direction for the new versions (optional)
            <Input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="e.g. make them harder; use a real-world scenario" className="mt-1 bg-white" />
          </label>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        </div>
      }
    >
      {proposal.proposal && (
        <ul className="space-y-3">
          {proposal.proposal.items.map((it) => {
            const sec = exam.sections.find((s) => s.id === it.sectionId);
            return (
              <li key={it.questionId} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#1b2466] px-1.5 font-mono text-xs font-semibold text-white">{it.label}</span>
                  <span className="text-xs text-slate-500">
                    {sec ? sectionTypeLabel(sec) : ""} · {sec ? questionPoints(it.next, sec) : ""} pts
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 bg-emerald-700 text-xs hover:bg-emerald-800"
                      onClick={() => {
                        applyOne(it);
                        dropOne(it.questionId);
                        toast.success(`Item ${it.label} replaced`);
                      }}
                    >
                      <Check className="size-3.5" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dropOne(it.questionId)}>
                      <X className="size-3.5" /> Keep original
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr]">
                  <QuestionSnapshot q={it.old} heading="Current" tone="old" />
                  <ArrowRight className="hidden size-4 self-center text-slate-400 md:block" aria-hidden />
                  <QuestionSnapshot q={it.next} heading="Proposed" tone="new" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AiReviewPanel>
  );
}

function QuestionSnapshot({ q, heading, tone }: { q: Question; heading: string; tone: "old" | "new" }) {
  const correct = q.choices?.findIndex((c) => c.id === q.correctChoiceId) ?? -1;
  return (
    <div className={tone === "old" ? "rounded-lg border border-slate-200 bg-slate-50 p-2.5" : "rounded-lg border border-violet-200 bg-violet-50/60 p-2.5"}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{heading}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-800">{q.prompt || <span className="italic text-slate-400">Empty</span>}</p>
      {q.choices?.length ? (
        <ol className="mt-1 space-y-0.5 text-xs text-slate-700">
          {q.choices.map((c, i) => (
            <li key={c.id} className={i === correct ? "font-semibold text-emerald-800" : undefined}>
              {LETTERS[i]}. {c.text} {i === correct ? "✓" : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {q.code && <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-1.5 font-mono text-[11px] text-slate-100">{q.code}</pre>}
      {(q.answerKey || q.rubric) && (
        <p className="mt-1 whitespace-pre-wrap border-t border-dashed border-slate-300 pt-1 text-[11px] text-slate-600">
          <span className="font-semibold">Teacher only: </span>
          {q.answerKey}
          {q.rubric ? `\nRubric: ${q.rubric}` : ""}
        </p>
      )}
    </div>
  );
}
