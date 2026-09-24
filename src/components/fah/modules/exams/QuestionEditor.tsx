"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Copy,
  ImagePlus,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { questionPoints, sectionTypeLabel, toRoman } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";
import type { CLO, ExamSection, Question } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { DeleteIconButton, Field, NumberInput, ReorderButtons, SourceBadge } from "../../common/ui";
import { moveItem } from "../../common/utils";
import { CODE_LANGUAGES, NONE, readImageAsDataUrl } from "./shared";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export interface QuestionEditorProps {
  q: Question;
  sec: ExamSection;
  index: number;
  count: number;
  label: string;
  sections: { id: string; title: string; index: number }[];
  clos: CLO[];
  levels: string[];
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (from: number, to: number) => void;
  onMoveToSection: (sectionId: string) => void;
  onReplace: () => void;
}

export function QuestionEditor(p: QuestionEditorProps) {
  const { q, sec } = p;
  const [open, setOpen] = useState(!q.prompt.trim() || !!q.flags?.length);
  const imgRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Question>(k: K, v: Question[K]) => p.onChange({ ...q, [k]: v });
  const pts = questionPoints(q, sec);
  const idBase = `q-${q.id}`;
  const type = sec.type;

  const onImage = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await readImageAsDataUrl(f);
      set("imageDataUrl", url);
      console.log("[exam-editor] image attached", { question: q.id, bytes: f.size });
    } catch (e) {
      console.error("[exam-editor] image attach failed", e);
      toast.error("Image not attached", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      if (imgRef.current) imgRef.current.value = "";
    }
  };

  const choices = q.choices ?? [];
  const setChoices = (c: Question["choices"]) => p.onChange({ ...q, choices: c });
  const subs = q.subItems ?? [];
  const setSubs = (s: Question["subItems"]) => p.onChange({ ...q, subItems: s });

  return (
    <li
      className={cn(
        "rounded-xl border bg-white shadow-xs transition",
        p.selected ? "border-violet-400 ring-1 ring-violet-300" : q.flags?.length ? "border-amber-300" : "border-slate-200"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 p-2.5">
        <Checkbox checked={p.selected} onCheckedChange={p.onToggleSelect} aria-label={`Select item ${p.label} for AI regeneration`} className="mt-2" />
        <span className="mt-1 inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-[#1b2466] px-1.5 font-mono text-xs font-semibold text-white">{p.label}</span>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40">
          <span className={cn("line-clamp-2 text-sm", q.prompt.trim() ? "text-slate-800" : "italic text-slate-400")}>{q.prompt.trim() || "Empty question — click to write it"}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span className="rounded bg-amber-50 px-1.5 font-semibold text-amber-900">
              {pts} pt{pts === 1 ? "" : "s"}
              {q.points === null || q.points === undefined ? " (default)" : ""}
            </span>
            {q.origin && q.origin !== "manual" && <SourceBadge source={q.origin} />}
            {q.subItems?.length ? <span>{q.subItems.length} sub-items</span> : null}
            {q.cognitiveLevel && <span>{q.cognitiveLevel}</span>}
            {q.imageDataUrl && <span>· image</span>}
            {q.flags?.length ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 font-semibold text-amber-900">
                <AlertTriangle className="size-3" /> {q.flags.length} flag{q.flags.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </button>
        <div className="flex items-center gap-0.5">
          <ReorderButtons index={p.index} count={p.count} onMove={p.onMove} label={`item ${p.label}`} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for item ${p.label}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={p.onDuplicate}>
                <Copy className="size-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={p.onReplace}>
                <RefreshCw className="size-4" /> Replace with AI…
              </DropdownMenuItem>
              {p.sections.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-slate-500">Move to section</DropdownMenuLabel>
                  {p.sections
                    .filter((s) => s.id !== sec.id)
                    .map((s) => (
                      <DropdownMenuItem key={s.id} onClick={() => p.onMoveToSection(s.id)}>
                        <ArrowRightLeft className="size-4" /> {s.title || `Test ${toRoman(s.index + 1)}`}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DeleteIconButton onClick={p.onDelete} label={`Delete item ${p.label}`} />
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen((v) => !v)} aria-label={open ? "Collapse item" : "Expand item"}>
            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-3 pb-4 pt-3 md:px-4">
          {q.flags?.length ? (
            <div role="alert" className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <ul className="min-w-0 flex-1 list-disc space-y-0.5 pl-4">
                {q.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Button size="sm" variant="outline" className="h-7 border-amber-400 bg-white text-xs" onClick={() => set("flags", undefined)}>
                <Check className="size-3.5" /> Mark reviewed
              </Button>
            </div>
          ) : null}

          <Field label={`Question (${sectionTypeLabel(sec)})`} htmlFor={`${idBase}-prompt`}>
            <Textarea id={`${idBase}-prompt`} rows={3} value={q.prompt} onChange={(e) => set("prompt", e.target.value)} className="bg-white" placeholder="Write the question exactly as students should see it." />
          </Field>

          {type === "programming" && (
            <div className="grid gap-3 md:grid-cols-[12rem_1fr]">
              <Field label="Code language">
                <Select value={q.codeLanguage || "python"} onValueChange={(v) => set("codeLanguage", v)}>
                  <SelectTrigger aria-label="Code language" className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CODE_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Code snippet (shown to students, optional)" htmlFor={`${idBase}-code`}>
                <Textarea
                  id={`${idBase}-code`}
                  rows={6}
                  spellCheck={false}
                  value={q.code ?? ""}
                  onChange={(e) => set("code", e.target.value)}
                  className="bg-slate-950 font-mono text-xs text-slate-100 placeholder:text-slate-500"
                  placeholder={"def total(items):\n    ..."}
                />
              </Field>
            </div>
          )}

          {type === "multiple-choice" && (
            <fieldset className="space-y-2">
              <legend className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                Answer choices
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  <Lock className="size-3" /> Correct-answer mark is not shown to students
                </span>
              </legend>
              <ol className="space-y-1.5">
                {choices.map((c, i) => {
                  const correct = q.correctChoiceId === c.id;
                  return (
                    <li key={c.id} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1", correct ? "border-emerald-300 bg-emerald-50" : "border-slate-200")}>
                      <input
                        type="radio"
                        name={`${idBase}-correct`}
                        checked={correct}
                        onChange={() => set("correctChoiceId", c.id)}
                        aria-label={`Mark choice ${LETTERS[i]} as the correct answer`}
                        className="size-4 accent-emerald-700"
                      />
                      <span className="w-5 text-center font-mono text-sm font-semibold text-slate-600">{LETTERS[i]}.</span>
                      <Input
                        value={c.text}
                        onChange={(e) => setChoices(choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                        aria-label={`Choice ${LETTERS[i]}`}
                        className="h-8 flex-1 bg-white"
                      />
                      {correct && <span className="hidden text-[11px] font-semibold text-emerald-800 sm:inline">Correct</span>}
                      <ReorderButtons index={i} count={choices.length} onMove={(a, b) => setChoices(moveItem(choices, a, b))} label={`choice ${LETTERS[i]}`} />
                      <DeleteIconButton
                        label={`Remove choice ${LETTERS[i]}`}
                        onClick={() => p.onChange({ ...q, choices: choices.filter((x) => x.id !== c.id), correctChoiceId: correct ? undefined : q.correctChoiceId })}
                      />
                    </li>
                  );
                })}
              </ol>
              <Button type="button" size="sm" variant="outline" onClick={() => setChoices([...choices, { id: uid("ch"), text: "" }])} disabled={choices.length >= 8}>
                <Plus className="size-4" /> Add choice
              </Button>
              {!q.correctChoiceId && choices.length > 0 && <p className="text-xs text-amber-800">No correct answer marked yet — the answer key will be blank.</p>}
            </fieldset>
          )}

          {/* Sub-items */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Sub-items (a, b, c…)</span>
              <span className="text-[11px] text-slate-500">Part of this item — counted once, scored with this item’s points.</span>
            </div>
            {subs.length > 0 && (
              <ol className="mb-2 space-y-1.5">
                {subs.map((s, i) => (
                  <li key={s.id} className="flex items-start gap-2">
                    <span className="mt-2 w-7 text-right font-mono text-sm text-slate-600">({LETTERS[i]})</span>
                    <Textarea
                      rows={1}
                      value={s.prompt}
                      onChange={(e) => setSubs(subs.map((x) => (x.id === s.id ? { ...x, prompt: e.target.value } : x)))}
                      aria-label={`Sub-item ${LETTERS[i]}`}
                      className="min-h-9 flex-1 bg-white"
                    />
                    <ReorderButtons index={i} count={subs.length} onMove={(a, b) => setSubs(moveItem(subs, a, b))} label={`sub-item ${LETTERS[i]}`} />
                    <DeleteIconButton label={`Remove sub-item ${LETTERS[i]}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))} />
                  </li>
                ))}
              </ol>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setSubs([...subs, { id: uid("sub"), prompt: "" }])}>
              <Plus className="size-4" /> Add sub-item
            </Button>
          </div>

          {/* Image */}
          <div className="flex flex-wrap items-start gap-3">
            <input ref={imgRef} type="file" accept="image/*" className="sr-only" id={`${idBase}-img`} onChange={(e) => void onImage(e.target.files?.[0])} />
            {q.imageDataUrl ? (
              <div className="relative">
                <img src={q.imageDataUrl} alt={`Attachment for item ${p.label}`} className="max-h-48 max-w-full rounded-lg border border-slate-200 bg-white object-contain" />
                <Button size="sm" variant="secondary" className="absolute right-1 top-1 h-7 px-2 text-xs" onClick={() => set("imageDataUrl", undefined)}>
                  <X className="size-3.5" /> Remove image
                </Button>
              </div>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => imgRef.current?.click()}>
              <ImagePlus className="size-4" /> {q.imageDataUrl ? "Replace image" : type === "drawing" ? "Attach reference image / figure" : "Attach image"}
            </Button>
            <span className="self-center text-[11px] text-slate-500">PNG, JPG, GIF or SVG up to 1.5 MB. Printed with the question.</span>
          </div>

          {/* Scoring & tags */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Points (override)" htmlFor={`${idBase}-pts`} hint={`Empty = section default (${sec.defaultPoints ?? 0}). Effective: ${pts}.`}>
              <NumberInput id={`${idBase}-pts`} value={q.points} min={0} step={0.5} onChange={(v) => set("points", v)} placeholder={`Default ${sec.defaultPoints ?? 0}`} />
            </Field>
            {type !== "multiple-choice" && type !== "identification" && (
              <Field label={type === "drawing" ? "Answer space (≈0.3 in per line)" : "Answer lines"} htmlFor={`${idBase}-lines`}>
                <NumberInput id={`${idBase}-lines`} value={q.answerLines ?? null} min={0} max={40} onChange={(v) => set("answerLines", v ?? undefined)} placeholder="0 = none" />
              </Field>
            )}
            <Field label="Topic" htmlFor={`${idBase}-topic`}>
              <Input id={`${idBase}-topic`} value={q.topic ?? ""} onChange={(e) => set("topic", e.target.value)} className="bg-white" placeholder="e.g. OSI model" />
            </Field>
            <Field label="CLO" hint={p.clos.length ? undefined : "Link a syllabus with CLOs in Exam details."}>
              <Select value={q.cloId ?? NONE} onValueChange={(v) => set("cloId", v === NONE ? undefined : v)} disabled={!p.clos.length}>
                <SelectTrigger aria-label="Course learning outcome" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not tagged</SelectItem>
                  {p.clos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-semibold">{c.code}</span> <span className="max-w-72 truncate text-slate-500">{c.statement}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cognitive level">
              <Select value={q.cognitiveLevel || NONE} onValueChange={(v) => set("cognitiveLevel", v === NONE ? undefined : v)}>
                <SelectTrigger aria-label="Cognitive level" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not tagged</SelectItem>
                  {p.levels.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Teacher-only */}
          {type !== "multiple-choice" && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white">
                <Lock className="size-3" /> Teacher only · Not shown to students
              </p>
              <div className={cn("grid gap-3", type !== "identification" && "md:grid-cols-2")}>
                <Field
                  label={type === "identification" ? "Answer key" : type === "programming" ? "Model solution / expected output" : "Answer key / expected points"}
                  htmlFor={`${idBase}-key`}
                >
                  {type === "identification" ? (
                    <Input id={`${idBase}-key`} value={q.answerKey ?? ""} onChange={(e) => set("answerKey", e.target.value)} className="bg-white" placeholder="Expected term or answer" />
                  ) : (
                    <Textarea
                      id={`${idBase}-key`}
                      rows={4}
                      value={q.answerKey ?? ""}
                      onChange={(e) => set("answerKey", e.target.value)}
                      className={cn("bg-white", type === "programming" && "font-mono text-xs")}
                      spellCheck={type !== "programming"}
                    />
                  )}
                </Field>
                {type !== "identification" && (
                  <Field label="Scoring rubric" htmlFor={`${idBase}-rubric`}>
                    <Textarea id={`${idBase}-rubric`} rows={4} value={q.rubric ?? ""} onChange={(e) => set("rubric", e.target.value)} className="bg-white" placeholder={"Content – 50%\nOrganization – 30%\nExamples – 20%"} />
                  </Field>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
