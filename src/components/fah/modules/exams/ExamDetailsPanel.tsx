"use client";

import { BookOpenText, CheckCircle2, CircleAlert, Library } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppData, Exam, ExamTerm, Resource } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { Field, Panel } from "../../common/ui";
import { href } from "../../common/router";
import { toggleIn } from "../../common/utils";
import { applySyllabusToExam, EXAM_TERMS, NONE } from "./shared";
import type { ExamUpdater } from "./ExamEditor";

const STATUS_LABEL: Record<Resource["status"], string> = {
  processing: "Processing",
  extracted: "Readable",
  "metadata-only": "Bibliographic only",
  "needs-ocr": "Needs OCR",
  failed: "Extraction failed",
  inaccessible: "Inaccessible",
};

export function ResourceStatusPill({ r }: { r: Resource }) {
  const ok = r.status === "extracted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      {ok ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
      {STATUS_LABEL[r.status]}
    </span>
  );
}

export function ExamDetailsPanel({ exam, setExam, data }: { exam: Exam; setExam: ExamUpdater; data: AppData }) {
  const set = <K extends keyof Exam>(k: K, v: Exam[K]) => setExam((e) => ({ ...e, [k]: v }));
  const instructional = data.resources.filter((r) => r.purpose === "instructional" || exam.resourceIds.includes(r.id));
  const templates = data.resources.filter((r) => r.purpose === "exam-template");
  const usable = exam.resourceIds.filter((id) => data.resources.find((r) => r.id === id)?.status === "extracted").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Exam details" description="Printed on the exam header. Linking a syllabus fills in the course fields (you can still edit them).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked syllabus" className="sm:col-span-2" hint="Also provides the CLOs used to tag questions and build the TOS.">
            <Select
              value={exam.syllabusId ?? NONE}
              onValueChange={(v) => {
                const syl = v === NONE ? undefined : data.syllabi.find((s) => s.id === v);
                console.log("[exam-editor] link syllabus", v);
                setExam((e) => applySyllabusToExam(e, syl));
              }}
            >
              <SelectTrigger aria-label="Linked syllabus" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No syllabus linked</SelectItem>
                {data.syllabi.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.courseCode || "No code"} · {s.descriptiveTitle || "Untitled"} {s.isDemo ? "(demo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Course code" htmlFor="ex-code" required>
            <Input id="ex-code" value={exam.courseCode} onChange={(e) => set("courseCode", e.target.value)} placeholder="e.g. IT 213" className="bg-white" />
          </Field>
          <Field label="Course title" htmlFor="ex-ctitle">
            <Input id="ex-ctitle" value={exam.courseTitle} onChange={(e) => set("courseTitle", e.target.value)} placeholder="e.g. Data Communications and Networking" className="bg-white" />
          </Field>
          <Field label="Semester" htmlFor="ex-sem">
            <Input id="ex-sem" value={exam.semester} onChange={(e) => set("semester", e.target.value)} placeholder="e.g. 1st Semester" className="bg-white" />
          </Field>
          <Field label="Academic year" htmlFor="ex-ay">
            <Input id="ex-ay" value={exam.academicYear} onChange={(e) => set("academicYear", e.target.value)} placeholder="e.g. 2026-2027" className="bg-white" />
          </Field>
          <Field label="Term">
            <Select value={exam.term} onValueChange={(v) => set("term", v as ExamTerm)}>
              <SelectTrigger aria-label="Term" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXAM_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Exam title" htmlFor="ex-title" required>
            <Input id="ex-title" value={exam.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. First Preliminary Examination" className="bg-white" />
          </Field>
          <Field label="General instructions" htmlFor="ex-instr" className="sm:col-span-2" hint="Printed in a box before the first section.">
            <Textarea id="ex-instr" rows={3} value={exam.instructions} onChange={(e) => set("instructions", e.target.value)} className="bg-white" placeholder="Read each item carefully. Write your answers legibly. Erasures are considered wrong." />
          </Field>
          <Field label="Numbering" className="sm:col-span-2">
            <div role="radiogroup" aria-label="Item numbering" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["continuous", "Continuous (1 … N)", "Items are numbered 1 to N across all sections. Item labels in the TOS are plain numbers (e.g. 12)."],
                  ["per-section", "Restart per section", "Each section starts at 1. Labels combine the section’s Roman numeral and the item (e.g. II.3 = Test II, item 3)."],
                ] as const
              ).map(([v, label, desc]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={exam.numbering === v}
                  onClick={() => set("numbering", v)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    exam.numbering === v ? "border-[#1b2466] bg-[#1b2466]/5 ring-1 ring-[#1b2466]" : "border-slate-200 bg-white hover:border-[#1b2466]/50"
                  )}
                >
                  <span className="font-semibold text-slate-900">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Scope for AI" description="Used when generating or regenerating questions. Never printed on the exam.">
          <div className="space-y-4">
            <Field label="Coverage / scope" htmlFor="ex-cov" hint="Topics, chapters or weeks this exam covers.">
              <Textarea id="ex-cov" rows={3} value={exam.coverage} onChange={(e) => set("coverage", e.target.value)} className="bg-white" placeholder="Weeks 1–6: OSI model, TCP/IP, transmission media, IP addressing" />
            </Field>
            <Field label="Additional AI instructions" htmlFor="ex-aii">
              <Textarea id="ex-aii" rows={3} value={exam.aiInstructions} onChange={(e) => set("aiInstructions", e.target.value)} className="bg-white" placeholder="e.g. Use Philippine business scenarios; avoid trick questions." />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Linked resources"
          description={
            <>
              {exam.resourceIds.length} selected · {usable} readable by AI. Only resources with readable (extracted) content are sent to AI; others are listed but excluded.
            </>
          }
        >
          {instructional.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
              <Library className="size-4" /> No resources yet.{" "}
              <a className="font-medium text-[#1b2466] underline" href={href("/resources")}>
                Add resources
              </a>
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {instructional.map((r) => {
                const on = exam.resourceIds.includes(r.id);
                const cid = `exres-${r.id}`;
                return (
                  <li key={r.id} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", on ? "border-[#1b2466]/30 bg-[#1b2466]/5" : "border-slate-200 bg-white")}>
                    <Checkbox id={cid} checked={on} onCheckedChange={() => set("resourceIds", toggleIn(exam.resourceIds, r.id))} className="mt-0.5" />
                    <label htmlFor={cid} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate text-sm font-medium text-slate-800">{r.title || "Untitled resource"}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <ResourceStatusPill r={r} />
                        {r.type.toUpperCase()}
                        {r.wordCount ? ` · ${r.wordCount.toLocaleString()} words` : ""}
                        {r.isDemo ? " · demo" : ""}
                      </span>
                      {r.status !== "extracted" && r.statusMessage && <span className="mt-0.5 block text-[11px] text-slate-500">{r.statusMessage}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <Field label="Exam template resource (formatting hint for imports)" className="mt-4">
            <Select value={exam.templateResourceId ?? NONE} onValueChange={(v) => set("templateResourceId", v === NONE ? undefined : v)} disabled={!templates.length}>
              <SelectTrigger aria-label="Exam template resource" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{templates.length ? "No template" : "No exam-template resources"}</SelectItem>
                {templates.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {exam.syllabusId && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <BookOpenText className="size-3.5" /> Resources linked to the syllabus were pre-selected when you linked it.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
