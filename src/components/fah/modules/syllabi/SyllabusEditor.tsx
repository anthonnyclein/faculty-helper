"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, Eye, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { store, useAppData, useRecordDraft } from "@/lib/fah/store";
import { duplicateSyllabus } from "@/lib/fah/factories";
import { syllabusIssues, type SyllabusSectionKey } from "@/lib/fah/validation";
import type { Syllabus } from "@/lib/fah/types";
import { DemoBadge, EmptyState, LoadingBlock, PageHeader, SaveBar } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { CourseInfoSection } from "./sections/CourseInfoSection";
import { InstitutionalSection } from "./sections/InstitutionalSection";
import { ProgramOutcomesSection } from "./sections/ProgramOutcomesSection";
import { ClosSection } from "./sections/ClosSection";
import { LearningPlanSection } from "./sections/LearningPlanSection";
import { ReferencesSection } from "./sections/ReferencesSection";
import { PoliciesSection } from "./sections/PoliciesSection";
import { SignatoriesSection } from "./sections/SignatoriesSection";
import { AgreementSection } from "./sections/AgreementSection";
import type { SectionProps } from "./sections/types";

const STEPS: { key: SyllabusSectionKey; letter: string; title: string; description: string; C: (p: SectionProps) => React.ReactNode }[] = [
  { key: "course", letter: "A", title: "Course information", description: "Identifiers, units, hours, term and course description.", C: CourseInfoSection },
  { key: "institutional", letter: "B–C", title: "Institutional statements & PEOs", description: "Vision, Mission, Goals, Core Values and Program Educational Objectives from the template.", C: InstitutionalSection },
  { key: "outcomes", letter: "D–E", title: "Program Outcomes & PEO alignment", description: "Five PO categories, PEO mappings, and the POs addressed by this course.", C: ProgramOutcomesSection },
  { key: "clos", letter: "F", title: "Course Learning Outcomes", description: "CLOs, corresponding POs and the CLO–PO alignment matrix.", C: ClosSection },
  { key: "plan", letter: "G", title: "Course Learning Plan", description: "18-week plan with examination weeks, manual or AI-assisted.", C: LearningPlanSection },
  { key: "references", letter: "H", title: "References", description: "Drafted from resource metadata; missing details are flagged.", C: ReferencesSection },
  { key: "policies", letter: "I", title: "Course policies & evaluation", description: "Requirements, class policies, grading system and dimension evaluation.", C: PoliciesSection },
  { key: "signatories", letter: "J–K", title: "Signatories & revision", description: "Prepared / Reviewed / Approved by, dates and revision information.", C: SignatoriesSection },
  { key: "agreement", letter: "L", title: "Learning Commitment Agreement", description: "Template statement with this course’s code and semester.", C: AgreementSection },
];

export function SyllabusEditor({ id }: { id: string }) {
  const data = useAppData();
  const { ready, record, draft, setDraft, status, error, lastSavedAt, save, discard, autosave } = useRecordDraft("syllabi", id);
  const [step, setStep] = useState<SyllabusSectionKey>("course");

  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const s = q.get("step") as SyllabusSectionKey | null;
    if (s && STEPS.some((x) => x.key === s)) setStep(s);
  }, []);

  const issues = useMemo(() => (draft ? syllabusIssues(draft as Syllabus, data) : null), [draft, data]);

  if (!ready) return <LoadingBlock />;
  if (!record || !draft)
    return <EmptyState title="Syllabus not found" description="It may have been deleted." action={<Button onClick={() => navigate("/syllabi")}>Back to syllabi</Button>} />;

  const syl = draft as Syllabus;
  const update = (fn: (s: Syllabus) => Syllabus) => setDraft((d) => fn(d as Syllabus));
  const idx = STEPS.findIndex((s) => s.key === step);
  const Cur = STEPS[idx];
  const totalIssues = issues ? Object.values(issues).reduce((a, l) => a + l.length, 0) : 0;

  const goto = (k: SyllabusSectionKey) => {
    setStep(k);
    document.getElementById("syllabus-step-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onDuplicate = async () => {
    if (status === "unsaved") {
      const ok = await save();
      if (!ok) return;
    }
    const copy = duplicateSyllabus(syl);
    store.upsert("syllabi", copy);
    await store.flush();
    toast.success("Syllabus duplicated", { description: "Revision information was preserved in the copy." });
    navigate(`/syllabi/${copy.id}`);
  };

  const onPreview = async () => {
    if (status === "unsaved") {
      const ok = await save();
      if (!ok) return;
    }
    navigate(`/syllabi/${syl.id}/preview`);
  };

  return (
    <div>
      <SaveBar status={status} lastSavedAt={lastSavedAt} autosave={autosave} error={error} onSave={() => void save().then((ok) => ok && toast.success("Syllabus saved"))} onDiscard={discard}>
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="size-4" /> Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="size-4" /> Preview & export
        </Button>
      </SaveBar>

      <PageHeader
        eyebrow="Course syllabus"
        title={
          <>
            {syl.courseCode || "New syllabus"}
            {syl.descriptiveTitle && <span className="font-normal text-slate-500"> · {syl.descriptiveTitle}</span>}
          </>
        }
        badges={
          <>
            {syl.isDemo && <DemoBadge />}
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", totalIssues ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800")}>
              {totalIssues ? <AlertCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
              {totalIssues ? `${totalIssues} item(s) need attention` : "All sections complete"}
            </span>
          </>
        }
        actions={
          <a href={href("/syllabi")} className="text-sm font-medium text-[#1b2466] underline-offset-4 hover:underline">
            ← All syllabi
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Step navigation */}
        <nav aria-label="Syllabus sections" className="lg:sticky lg:top-16 lg:self-start">
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {STEPS.map((s) => {
              const n = issues?.[s.key].length ?? 0;
              const on = s.key === step;
              return (
                <li key={s.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goto(s.key)}
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40",
                      on ? "border-[#1b2466] bg-[#1b2466] text-white shadow" : "border-slate-200 bg-white text-slate-700 hover:border-[#1b2466]/40"
                    )}
                  >
                    <span className={cn("flex h-7 min-w-9 items-center justify-center rounded-md px-1 text-[11px] font-bold", on ? "bg-amber-400 text-[#1b2466]" : "bg-slate-100 text-slate-600")}>{s.letter}</span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                    <span className="ml-auto pl-1" aria-label={n ? `${n} issue(s)` : "complete"}>
                      {n ? (
                        <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", on ? "bg-white/20" : "bg-amber-100 text-amber-900")}>{n}</span>
                      ) : (
                        <CheckCircle2 className={cn("size-4", on ? "text-emerald-300" : "text-emerald-600")} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0" id="syllabus-step-top">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Section {Cur.letter}</p>
            <h2 className="font-display text-xl font-semibold text-[#1b2466]">{Cur.title}</h2>
            <p className="text-sm text-slate-500">{Cur.description}</p>
          </div>
          {issues && issues[step].length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              <ul className="list-disc space-y-0.5 pl-5">
                {issues[step].map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          <Cur.C syllabus={syl} update={update} data={data} />
          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="ghost" disabled={idx === 0} onClick={() => goto(STEPS[idx - 1].key)}>
              <ArrowLeft className="size-4" /> {idx > 0 ? STEPS[idx - 1].title : "Previous"}
            </Button>
            {idx < STEPS.length - 1 ? (
              <Button variant="outline" onClick={() => goto(STEPS[idx + 1].key)}>
                {STEPS[idx + 1].title} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={onPreview} className="bg-[#1b2466]">
                <Eye className="size-4" /> Preview & export
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
