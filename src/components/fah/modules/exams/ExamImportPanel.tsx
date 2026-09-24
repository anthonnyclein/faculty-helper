"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runAi, type AiRunResult } from "@/lib/fah/services/ai";
import { demoExtractExam, validateExtractResult, type ExtractInput, type ExtractResult } from "@/lib/fah/ai/demo/exam";
import { extractTextFromFile, importToSections, IMPORT_ACCEPT, reviewExtraction, type ReviewedImport } from "@/lib/fah/services/exam-import";
import type { AppData, Exam, QuestionType } from "@/lib/fah/types";
import { AiReviewPanel, useAiProposal } from "../../common/ai-review";
import { Field, Panel, ScrollTable } from "../../common/ui";
import { pendingImports, QUESTION_TYPE_OPTIONS } from "./shared";
import type { ExamUpdater } from "./ExamEditor";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function ExamImportPanel({ exam, setExam, data, onDone }: { exam: Exam; setExam: ExamUpdater; data: AppData; onDone: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [applyMeta, setApplyMeta] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const proposal = useAiProposal<ReviewedImport>();
  const template = exam.templateResourceId ? data.resources.find((r) => r.id === exam.templateResourceId) : undefined;

  const extract = (sourceText: string, forceDemo = false) => {
    if (!sourceText.trim()) {
      toast.error("Paste the exam text or upload a file first.");
      return;
    }
    const input: ExtractInput = { text: sourceText, templateHint: template?.status === "extracted" ? template.content.slice(0, 3000) : undefined };
    console.log("[exam-import] extract request", { chars: sourceText.length, template: !!input.templateHint, forceDemo });
    const pre: string[] = [];
    if (sourceText.length > 60000) pre.push("The text is longer than 60,000 characters; only the first part is sent to AI. Split very long exams.");
    void proposal.run(async () => {
      const r = await runAi<ExtractResult>("extract-exam", input, { demo: () => demoExtractExam(input), validate: validateExtractResult, forceDemo });
      if (r.ok === true) {
        const reviewed = reviewExtraction(r.data, sourceText);
        const flagged = reviewed.sections.reduce((a, s) => a + s.questions.filter((q) => q.flags.length).length, 0);
        console.log("[exam-import] extraction ready", { mode: r.mode, sections: reviewed.sections.length, flagged });
        return { ...r, data: reviewed } as AiRunResult<ReviewedImport>;
      }
      console.error("[exam-import] extraction failed", (r as { error?: string }).error);
      return r as unknown as AiRunResult<ReviewedImport>;
    }, pre);
  };

  // Hand-off from the list's "Import existing exam" dialog: extract immediately.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    const pending = pendingImports.get(exam.id);
    if (!pending) return;
    started.current = true;
    pendingImports.delete(exam.id);
    setText(pending.text);
    setFileName(pending.fileName);
    extract(pending.text);
  }, [exam.id]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    try {
      const r = await extractTextFromFile(f);
      setText(r.text);
      setFileName(r.fileName);
      setFileWarnings(r.warnings);
      console.log("[exam-import] file read", { file: r.fileName, chars: r.text.length });
    } catch (e) {
      console.error("[exam-import] file read failed", e);
      toast.error("Could not read the file", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const p = proposal.proposal;
  const itemCount = p ? p.sections.reduce((a, s) => a + s.questions.length, 0) : 0;
  const flaggedCount = p ? p.sections.reduce((a, s) => a + s.questions.filter((q) => q.flags.length).length, 0) : 0;

  const editSection = (si: number, patch: Partial<ReviewedImport["sections"][number]>) =>
    proposal.edit((x) => ({ ...x, sections: x.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const editQuestion = (si: number, qi: number, patch: Partial<ReviewedImport["sections"][number]["questions"][number]>) =>
    proposal.edit((x) => ({
      ...x,
      sections: x.sections.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) } : s)),
    }));

  const accept = () => {
    if (!p) return;
    const sections = importToSections(p);
    const n = sections.reduce((a, s) => a + s.questions.length, 0);
    setExam((e) => {
      const hadQuestions = e.sections.some((s) => s.questions.length);
      const kept = e.sections.filter((s) => s.questions.length); // empty placeholder sections are replaced
      return {
        ...e,
        sections: [...kept, ...sections],
        source: hadQuestions ? e.source : "import",
        numbering: hadQuestions ? e.numbering : p.numbering,
        title: applyMeta && !e.title.trim() && p.title ? p.title : e.title,
        instructions: applyMeta && !e.instructions.trim() && p.generalInstructions ? p.generalInstructions : e.instructions,
      };
    });
    console.log("[exam-import] accepted", { sections: sections.length, items: n });
    toast.success(`Imported ${n} item${n === 1 ? "" : "s"} in ${sections.length} section${sections.length === 1 ? "" : "s"}`, {
      description: flaggedCount ? `${flaggedCount} flagged item(s) need review — look for the amber markers.` : "Review the items, then save.",
    });
    proposal.clear();
    onDone();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Import an existing exam"
        description="Paste the exam text or upload a .txt, .docx or .pdf file. Questions are copied exactly as written — nothing is rewritten. Uncertain extraction or numbering is flagged for your review."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="sr-only" id="exam-editor-import-file" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload file
          </Button>
          {fileName && <span className="text-xs text-slate-600">Loaded: {fileName}</span>}
          {template && (
            <span className="text-xs text-slate-500">
              Template hint: {template.title} {template.status !== "extracted" ? "(not readable — ignored)" : ""}
            </span>
          )}
        </div>
        <Field label="Exam text" htmlFor="exam-editor-import-text">
          <Textarea id="exam-editor-import-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="bg-white font-mono text-xs" placeholder={"TEST I. MULTIPLE CHOICE (1 pt each)\nDirections: Choose the letter of the best answer.\n1. Which layer…\n   a. Physical   b. Network   c. Session   d. Transport"} />
        </Field>
        {fileWarnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
            {fileWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </Panel>

      <AiReviewPanel
        title="Extract questions"
        description="Detects sections, numbered items, choices, points and answer keys. You review everything in a table before it is added to the exam."
        status={proposal.status}
        mode={proposal.mode}
        error={proposal.error}
        warnings={[...proposal.warnings, ...(p?.warnings ?? [])]}
        generateLabel="Extract from text"
        onGenerate={() => extract(text)}
        onRegenerate={() => extract(text)}
        regenerateLabel="Extract again"
        onUseDemo={() => extract(text, true)}
        canUseDemo={proposal.canUseDemo}
        onAccept={accept}
        acceptLabel={`Add ${itemCount} item${itemCount === 1 ? "" : "s"} to exam`}
        onReject={() => proposal.clear()}
      >
        {p && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                {p.sections.length} section(s) · {itemCount} item(s)
              </span>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900">
                  <AlertTriangle className="size-3.5" /> {flaggedCount} flagged
                </span>
              )}
              <span className="text-xs text-slate-600">Numbering detected: {p.numbering === "per-section" ? "restarts per section" : "continuous"}</span>
              {(p.title || p.generalInstructions) && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Checkbox checked={applyMeta} onCheckedChange={(v) => setApplyMeta(!!v)} />
                  Use detected title / general instructions when the exam’s are empty
                </label>
              )}
            </div>
            {p.sections.map((s, si) => (
              <div key={si} className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-[#1b2466]">{s.title || `Section ${si + 1}`}</span>
                  <Select value={s.questionType} onValueChange={(v) => editSection(si, { questionType: v as QuestionType, flags: [] })}>
                    <SelectTrigger aria-label={`Question type for ${s.title}`} className="h-8 w-52 bg-white">
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
                  {s.defaultPoints ? <span className="text-xs text-slate-600">{s.defaultPoints} pt(s) each</span> : null}
                  {s.flags.map((f) => (
                    <span key={f} className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-900">
                      {f}
                    </span>
                  ))}
                </div>
                {s.instructions && <p className="whitespace-pre-wrap px-3 pt-2 text-xs italic text-slate-600">{s.instructions}</p>}
                <ScrollTable minWidth={860} className="m-3 w-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-14 px-2 py-2">No.</th>
                        <th className="px-2 py-2">Question (exact wording)</th>
                        <th className="w-64 px-2 py-2">{s.questionType === "multiple-choice" ? "Choices" : "Sub-items"}</th>
                        <th className="w-36 px-2 py-2">Answer key</th>
                        <th className="w-14 px-2 py-2">Pts</th>
                        <th className="w-56 px-2 py-2">Review flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.questions.map((q, qi) => {
                        const list = s.questionType === "multiple-choice" ? q.choices ?? q.subItems : q.subItems ?? q.choices;
                        return (
                          <tr key={qi} className={q.flags.length ? "border-t border-amber-200 bg-amber-50/60 align-top" : "border-t border-slate-100 align-top"}>
                            <td className="px-2 py-2 font-mono text-xs">{q.number ?? "?"}</td>
                            <td className="px-2 py-2">
                              <Textarea
                                rows={2}
                                value={q.prompt}
                                onChange={(e) => editQuestion(si, qi, { prompt: e.target.value })}
                                aria-label={`Question ${q.number ?? qi + 1}`}
                                className="min-h-14 bg-white text-sm"
                              />
                            </td>
                            <td className="px-2 py-2 text-xs text-slate-700">
                              {list?.length ? (
                                <ol className="space-y-0.5">
                                  {list.map((c, ci) => (
                                    <li key={ci}>
                                      <span className="font-mono">{s.questionType === "multiple-choice" ? `${LETTERS[ci]}.` : `(${LETTERS[ci]})`}</span> {c}
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <span className="italic text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-xs">{q.answerKey ?? <span className="italic text-slate-400">none</span>}</td>
                            <td className="px-2 py-2 text-xs tabular-nums">{q.points ?? s.defaultPoints ?? "—"}</td>
                            <td className="px-2 py-2 text-xs">
                              {q.flags.length ? (
                                <ul className="space-y-0.5 text-amber-900">
                                  {q.flags.map((f) => (
                                    <li key={f} className="flex gap-1">
                                      <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {f}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-emerald-700">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollTable>
              </div>
            ))}
            <p className="text-xs text-slate-500">Flags stay on the imported items (amber) until you mark them reviewed in Sections & questions.</p>
          </div>
        )}
      </AiReviewPanel>
    </div>
  );
}
