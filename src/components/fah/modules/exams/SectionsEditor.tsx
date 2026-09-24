"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examItems, sectionTotals, toRoman } from "@/lib/fah/calc";
import { newQuestion, newSection } from "@/lib/fah/factories";
import { deepClone } from "@/lib/fah/ids";
import type { AppData, Exam, ExamSection, Question, QuestionType } from "@/lib/fah/types";
import { ConfirmDialog, DeleteIconButton, EmptyState, Field, NumberInput, ReorderButtons } from "../../common/ui";
import { moveItem } from "../../common/utils";
import { cloneQuestionIds, QUESTION_TYPE_OPTIONS, syllabusClos } from "./shared";
import { QuestionEditor } from "./QuestionEditor";
import type { ExamUpdater } from "./ExamEditor";

interface Props {
  exam: Exam;
  setExam: ExamUpdater;
  data: AppData;
  selected: string[];
  setSelected: (fn: string[] | ((s: string[]) => string[])) => void;
  onReplace: (questionId: string) => void;
}

/** Adapts existing questions when a section changes type (keeps all content; adds what the new type needs). */
function adaptQuestion(q: Question, type: QuestionType): Question {
  const n = { ...q };
  if (type === "multiple-choice" && !(n.choices && n.choices.length)) n.choices = newQuestion("multiple-choice").choices;
  if ((type === "essay" || type === "analysis" || type === "drawing" || type === "programming" || type === "custom") && !n.answerLines)
    n.answerLines = newQuestion(type).answerLines ?? 4;
  if (type === "programming" && !n.codeLanguage) n.codeLanguage = "python";
  return n;
}

export function SectionsEditor({ exam, setExam, data, selected, setSelected, onReplace }: Props) {
  const [pendingSectionDelete, setPendingSectionDelete] = useState<ExamSection | null>(null);
  const labels = useMemo(() => new Map(examItems(exam).map((i) => [i.questionId, i.label])), [exam]);
  const clos = syllabusClos(data, exam);
  const levels = data.institutional.tosCognitiveLevels;
  const sectionRefs = exam.sections.map((s, i) => ({ id: s.id, title: s.title, index: i }));

  const updSection = (id: string, fn: (s: ExamSection) => ExamSection) => setExam((e) => ({ ...e, sections: e.sections.map((s) => (s.id === id ? fn(s) : s)) }));
  const updQuestion = (secId: string, q: Question) => updSection(secId, (s) => ({ ...s, questions: s.questions.map((x) => (x.id === q.id ? q : x)) }));

  const addSection = () => {
    const sec = newSection("multiple-choice", `Test ${toRoman(exam.sections.length + 1)}`);
    setExam((e) => ({ ...e, sections: [...e.sections, sec] }));
    console.log("[exam-editor] section added", sec.id);
    setTimeout(() => document.getElementById(`sec-${sec.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const addQuestion = (sec: ExamSection) => {
    const q = newQuestion(sec.type);
    updSection(sec.id, (s) => ({ ...s, questions: [...s.questions, q] }));
    console.log("[exam-editor] question added", { section: sec.id, question: q.id });
  };

  const deleteQuestion = (sec: ExamSection, q: Question) => {
    const idx = sec.questions.findIndex((x) => x.id === q.id);
    updSection(sec.id, (s) => ({ ...s, questions: s.questions.filter((x) => x.id !== q.id) }));
    setSelected((sel) => sel.filter((x) => x !== q.id));
    console.log("[exam-editor] question deleted", q.id);
    toast("Question deleted", {
      description: q.prompt ? q.prompt.slice(0, 80) : undefined,
      action: {
        label: "Undo",
        onClick: () =>
          setExam((e) => ({
            ...e,
            sections: e.sections.map((s) => {
              if (s.id !== sec.id || s.questions.some((x) => x.id === q.id)) return s;
              const qs = [...s.questions];
              qs.splice(Math.min(idx, qs.length), 0, q);
              return { ...s, questions: qs };
            }),
          })),
      },
    });
  };

  const duplicateQuestion = (sec: ExamSection, q: Question) => {
    const copy = cloneQuestionIds(deepClone(q));
    copy.origin = "manual";
    updSection(sec.id, (s) => {
      const i = s.questions.findIndex((x) => x.id === q.id);
      const qs = [...s.questions];
      qs.splice(i + 1, 0, copy);
      return { ...s, questions: qs };
    });
    toast.success("Question duplicated");
  };

  const moveToSection = (from: ExamSection, q: Question, toId: string) => {
    setExam((e) => ({
      ...e,
      sections: e.sections.map((s) => {
        if (s.id === from.id) return { ...s, questions: s.questions.filter((x) => x.id !== q.id) };
        if (s.id === toId) return { ...s, questions: [...s.questions, adaptQuestion(q, s.type)] };
        return s;
      }),
    }));
    const target = exam.sections.find((s) => s.id === toId);
    console.log("[exam-editor] question moved", { question: q.id, to: toId });
    toast.success(`Moved to ${target?.title || "section"}`, {
      description: target && target.type !== from.type ? "The target section has a different question type — review the item." : undefined,
    });
  };

  const confirmDeleteSection = () => {
    if (!pendingSectionDelete) return;
    const id = pendingSectionDelete.id;
    const qids = new Set(pendingSectionDelete.questions.map((q) => q.id));
    setExam((e) => ({ ...e, sections: e.sections.filter((s) => s.id !== id) }));
    setSelected((sel) => sel.filter((x) => !qids.has(x)));
    console.log("[exam-editor] section deleted", id);
    setPendingSectionDelete(null);
  };

  return (
    <div className="space-y-4">
      {exam.sections.length === 0 && (
        <EmptyState
          icon={<ListPlus className="size-6" />}
          title="No sections yet"
          description="Add a section (e.g. Test I · Multiple Choice), then add questions — or use Generate with AI / Import exam."
          action={
            <Button onClick={addSection} className="bg-[#1b2466] hover:bg-[#262f7a]">
              <Plus className="size-4" /> Add section
            </Button>
          }
        />
      )}

      {exam.sections.map((sec, si) => {
        const t = sectionTotals(sec);
        const allSel = sec.questions.length > 0 && sec.questions.every((q) => selected.includes(q.id));
        const off = sec.plannedItems !== null && sec.plannedItems !== undefined && sec.plannedItems !== t.items;
        return (
          <section key={sec.id} id={`sec-${sec.id}`} aria-label={sec.title || `Section ${si + 1}`} className="scroll-mt-16 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-[#1b2466] to-[#2d3a8c] px-3 py-2 text-white md:px-4">
              <span className="font-display text-lg font-semibold text-amber-300">{toRoman(si + 1)}</span>
              <label htmlFor={`sec-title-${sec.id}`} className="sr-only">
                Section title
              </label>
              <Input
                id={`sec-title-${sec.id}`}
                value={sec.title}
                onChange={(e) => updSection(sec.id, (s) => ({ ...s, title: e.target.value }))}
                className="h-8 max-w-xs border-white/20 bg-white/10 font-semibold text-white placeholder:text-white/50"
                placeholder={`Test ${toRoman(si + 1)}`}
              />
              <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs tabular-nums">
                {t.items} item{t.items === 1 ? "" : "s"} · {t.points} pts
              </span>
              <div className="flex items-center rounded-md bg-white/90 text-slate-700">
                <ReorderButtons index={si} count={exam.sections.length} onMove={(a, b) => setExam((e) => ({ ...e, sections: moveItem(e.sections, a, b) }))} label={`section ${sec.title || si + 1}`} />
                <DeleteIconButton label={`Delete section ${sec.title || si + 1}`} onClick={() => setPendingSectionDelete(sec)} />
              </div>
            </div>

            <div className="space-y-3 p-3 md:p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Question type">
                  <Select
                    value={sec.type}
                    onValueChange={(v) => {
                      const type = v as QuestionType;
                      updSection(sec.id, (s) => ({ ...s, type, questions: s.questions.map((q) => adaptQuestion(q, type)) }));
                    }}
                  >
                    <SelectTrigger aria-label="Question type" className="w-full bg-white">
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
                </Field>
                {sec.type === "custom" ? (
                  <Field label="Custom type label" htmlFor={`sec-cl-${sec.id}`}>
                    <Input id={`sec-cl-${sec.id}`} value={sec.customTypeLabel ?? ""} onChange={(e) => updSection(sec.id, (s) => ({ ...s, customTypeLabel: e.target.value }))} className="bg-white" placeholder="e.g. True or False" />
                  </Field>
                ) : null}
                <Field label="Planned items" htmlFor={`sec-pl-${sec.id}`} error={off ? `Has ${t.items} of ${sec.plannedItems}` : null}>
                  <NumberInput id={`sec-pl-${sec.id}`} value={sec.plannedItems} min={0} onChange={(v) => updSection(sec.id, (s) => ({ ...s, plannedItems: v }))} placeholder="Not planned" invalid={off} />
                </Field>
                <Field label="Default points per item" htmlFor={`sec-dp-${sec.id}`}>
                  <NumberInput id={`sec-dp-${sec.id}`} value={sec.defaultPoints} min={0} step={0.5} onChange={(v) => updSection(sec.id, (s) => ({ ...s, defaultPoints: v }))} />
                </Field>
                <div className="flex flex-col justify-end rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Section total</span>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {t.items} items · {t.points} pts
                  </span>
                </div>
              </div>
              <Field label="Section instructions" htmlFor={`sec-in-${sec.id}`}>
                <Textarea
                  id={`sec-in-${sec.id}`}
                  rows={2}
                  value={sec.instructions}
                  onChange={(e) => updSection(sec.id, (s) => ({ ...s, instructions: e.target.value }))}
                  className="bg-white"
                  placeholder="e.g. Choose the letter of the best answer. Write your answer on the space provided before each number."
                />
              </Field>

              {sec.questions.length > 0 && (
                <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                  <Checkbox
                    id={`sec-all-${sec.id}`}
                    checked={allSel}
                    onCheckedChange={() =>
                      setSelected((sel) => (allSel ? sel.filter((x) => !sec.questions.some((q) => q.id === x)) : [...new Set([...sel, ...sec.questions.map((q) => q.id)])]))
                    }
                  />
                  <label htmlFor={`sec-all-${sec.id}`}>Select all items in this section (for AI regeneration)</label>
                </div>
              )}

              <ol className="space-y-2">
                {sec.questions.map((q, qi) => (
                  <QuestionEditor
                    key={q.id}
                    q={q}
                    sec={sec}
                    index={qi}
                    count={sec.questions.length}
                    label={labels.get(q.id) ?? String(qi + 1)}
                    sections={sectionRefs}
                    clos={clos}
                    levels={levels}
                    selected={selected.includes(q.id)}
                    onToggleSelect={() => setSelected((sel) => (sel.includes(q.id) ? sel.filter((x) => x !== q.id) : [...sel, q.id]))}
                    onChange={(nq) => updQuestion(sec.id, nq)}
                    onDelete={() => deleteQuestion(sec, q)}
                    onDuplicate={() => duplicateQuestion(sec, q)}
                    onMove={(a, b) => updSection(sec.id, (s) => ({ ...s, questions: moveItem(s.questions, a, b) }))}
                    onMoveToSection={(to) => moveToSection(sec, q, to)}
                    onReplace={() => onReplace(q.id)}
                  />
                ))}
              </ol>
              <Button variant="outline" size="sm" onClick={() => addQuestion(sec)} className="border-dashed">
                <Plus className="size-4" /> Add {sec.type === "custom" ? sec.customTypeLabel || "custom" : QUESTION_TYPE_OPTIONS.find((o) => o.value === sec.type)?.label.toLowerCase()} item
              </Button>
            </div>
          </section>
        );
      })}

      {exam.sections.length > 0 && (
        <Button variant="outline" onClick={addSection} className="w-full border-dashed py-6 text-[#1b2466]">
          <Plus className="size-4" /> Add section
        </Button>
      )}

      <ConfirmDialog
        open={!!pendingSectionDelete}
        onOpenChange={(o) => !o && setPendingSectionDelete(null)}
        title="Delete this section?"
        confirmLabel="Delete section"
        destructive
        onConfirm={confirmDeleteSection}
        description={
          pendingSectionDelete && (
            <p className="text-sm">
              <strong>{pendingSectionDelete.title || "This section"}</strong> and its {pendingSectionDelete.questions.length} question
              {pendingSectionDelete.questions.length === 1 ? "" : "s"} (with answer keys and rubrics) will be removed from the draft. You can still use Discard before saving
              to undo.
            </p>
          )
        }
      />
    </div>
  );
}
