"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileWarning, Info, Pencil, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DemoBadge, EmptyState, PageHeader, Panel } from "@/components/fah/common/ui";
import { href } from "@/components/fah/common/router";
import { PaginatedDocument } from "@/components/fah/documents/PaginatedDocument";
import { SYLLABUS_PAPERS, buildSyllabusDocument } from "@/lib/fah/documents/syllabus";
import { store, useAppData } from "@/lib/fah/store";
import { TEMPLATE_DISCREPANCIES } from "@/lib/fah/template";
import { syllabusIssues, type SyllabusSectionKey } from "@/lib/fah/validation";
import type { AppSettings, SyllabusPaper } from "@/lib/fah/types";

const SECTION_LABELS: Record<SyllabusSectionKey, string> = {
  course: "Course information",
  institutional: "Institutional statements",
  outcomes: "Program outcomes",
  clos: "Course learning outcomes",
  plan: "Course learning plan",
  references: "References",
  policies: "Policies & grading",
  signatories: "Signatories",
  agreement: "Learning Commitment Agreement",
};

/** Which editor step holds each placeholder field. */
const MISSING_STEP: Record<string, SyllabusSectionKey> = {
  "College Name": "course",
  "Syllabus Code": "course",
  "Course Code": "course",
  "Descriptive Title": "course",
  "No. of Units": "course",
  Semester: "course",
  "Academic Year": "course",
  "Course Description": "course",
  Vision: "institutional",
  Mission: "institutional",
  Goals: "institutional",
  "Outcomes common to the discipline": "outcomes",
  "Outcomes specific to the IT program": "outcomes",
  "Course Learning Outcomes": "clos",
  "Learning plan items": "plan",
  References: "references",
  "Faculty name": "signatories",
  "Department Chairperson": "signatories",
  Dean: "signatories",
};

const SYLLABUS_DISCREPANCY_IDS = ["paper", "exam-weeks", "plan-columns", "units", "grading-position", "fonts"];

const MATCHED = [
  "Institutional header and footer images, scaled to the page width and repeated on every page",
  "Section order: title block, course information, Vision/Mission/Goals/Core Values, PEOs, Program Outcomes, Course Description & CLOs, Course Learning Plan, references, class policies & evaluation, signatures, Learning Commitment Agreement",
  "Fonts and sizes: Book Antiqua 10 pt body, Monotype Corsiva 16 pt college name, Arial Italic 6 pt syllabus code, bold 11 pt course information",
  "Bordered tables, light-blue learning-plan header with “Lecture” sub-header, full-width examination rows",
  "Two-column policies box (class policies | dimension evaluation, criteria and transmutation) that continues across pages",
  "Signature block (Prepared / Reviewed / Approved / Revision) and a separate Learning Commitment Agreement page",
];

const EXTRA_DEVIATIONS = [
  "The template title reads “COURSE SYLLABUS IN ITE 153” while its course code is ITE 192; the export always uses the entered course code.",
  "Page breaks are computed automatically, so content falls on different pages than in the reference.",
  "Like the reference, the Course Learning Plan header is printed only once (not repeated on continuation pages).",
];

function StepLink({ id, step, children }: { id: string; step: SyllabusSectionKey; children: React.ReactNode }) {
  return (
    <a href={href(`/syllabi/${id}?step=${step}`)} className="font-medium text-[#1b2466] underline decoration-amber-400 underline-offset-2 hover:text-amber-700">
      {children}
    </a>
  );
}

export function SyllabusPreview({ id }: { id: string }) {
  const data = useAppData();
  const syllabus = data.syllabi.find((s) => s.id === id);
  const settings = data.settings;

  const doc = useMemo(() => (syllabus ? buildSyllabusDocument(syllabus, data) : null), [syllabus, data]);
  const issues = useMemo(() => (syllabus ? syllabusIssues(syllabus, data) : null), [syllabus, data]);

  if (!syllabus || !doc || !issues) {
    return (
      <EmptyState
        title="Syllabus not found"
        description="It may have been deleted or the demonstration data was removed."
        action={
          <Button asChild variant="outline">
            <a href={href("/syllabi")}>Back to syllabi</a>
          </Button>
        }
      />
    );
  }

  const paper = SYLLABUS_PAPERS[settings.syllabusPaper] ?? SYLLABUS_PAPERS["custom-13x11"];
  const setSettings = (patch: Partial<AppSettings>) => {
    console.log("[syllabus-preview] settings change", patch);
    store.setSettings(patch);
  };
  const choosePaper = (p: SyllabusPaper) => setSettings({ syllabusPaper: p, paperDiscrepancyResolved: true });

  const issueEntries = (Object.keys(issues) as SyllabusSectionKey[]).filter((k) => issues[k].length);
  const issueCount = issueEntries.reduce((a, k) => a + issues[k].length, 0);
  const discrepancies = TEMPLATE_DISCREPANCIES.filter((d) => SYLLABUS_DISCREPANCY_IDS.includes(d.id));
  const title = [syllabus.courseCode, syllabus.descriptiveTitle].filter(Boolean).join(" — ") || "Untitled syllabus";
  const fileBase = (syllabus.syllabusCode || syllabus.courseCode || "syllabus").trim().replace(/[\\/:*?"<>|\s]+/g, "-");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Syllabus · Print preview"
        title={title}
        badges={
          <>
            {syllabus.isDemo && <DemoBadge />}
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-600">{paper.label}</span>
          </>
        }
        description="This preview shows the saved syllabus. The downloaded PDF and the print output use exactly these pages."
        actions={
          <>
            <Button asChild variant="outline">
              <a href={href(`/syllabi/${id}`)}>
                <ArrowLeft className="size-4" /> Back to editor
              </a>
            </Button>
          </>
        }
      />

      {!settings.paperDiscrepancyResolved && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 md:flex-row md:items-center">
          <AlertTriangle className="size-6 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Paper size needs your decision</p>
            <p>
              The uploaded template is 14 × 8.5 in (Legal landscape) but the requested size is 13 × 11 in. Choose which to use. Until you choose, the
              preview uses {paper.description.split(" — ")[0]}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => choosePaper("custom-13x11")}>
              Use 13 × 11 in (requested)
            </Button>
            <Button size="sm" variant="outline" className="border-amber-500 bg-white" onClick={() => choosePaper("legal-14x8.5")}>
              Use 14 × 8.5 in (template)
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Print settings" description="These settings apply to every syllabus export.">
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Ruler className="size-4 text-amber-600" /> Paper size
              </legend>
              <RadioGroup value={settings.syllabusPaper} onValueChange={(v) => choosePaper(v as SyllabusPaper)} className="gap-2">
                {(Object.keys(SYLLABUS_PAPERS) as SyllabusPaper[]).map((k) => (
                  <Label
                    key={k}
                    htmlFor={`paper-${k}`}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 font-normal has-[[data-state=checked]]:border-[#1b2466] has-[[data-state=checked]]:bg-[#1b2466]/5"
                  >
                    <RadioGroupItem id={`paper-${k}`} value={k} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-slate-800">{SYLLABUS_PAPERS[k].label}</span>
                      <span className="text-xs text-slate-500">{SYLLABUS_PAPERS[k].description}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <p className="mt-2 text-xs text-slate-500">
                Current page: <strong>{paper.widthIn} in wide × {paper.heightIn} in high, landscape</strong>. Header, footer and margins scale to the chosen width.
              </p>
            </fieldset>

            <div className="space-y-3">
              {(
                [
                  ["showCloColumn", "Show “Corresponding CLOs” column", "Added after Specific Intended Learning Outcomes (not in the reference)."],
                  ["showMaterialsColumn", "Show “Instructional Material References” column", "Present in the reference."],
                  ["showHoursInUnits", "Show lecture/laboratory hours with units", "E.g. “3 units (2 hrs lecture, 3 hrs laboratory)” — not in the reference."],
                ] as const
              ).map(([key, label, hint]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <Label htmlFor={`opt-${key}`} className="flex flex-col items-start gap-0.5 font-normal">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    <span className="text-xs text-slate-500">{hint}</span>
                  </Label>
                  <Switch id={`opt-${key}`} checked={!!settings[key]} onCheckedChange={(v) => setSettings({ [key]: v } as Partial<AppSettings>)} />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Template compliance" description="Comparison with the uploaded “Syllabus Template.docx.pdf”.">
          <div className="space-y-4 text-sm">
            <p className="flex gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
              <Info className="mt-0.5 size-4 shrink-0 text-[#1b2466]" />
              <span>
                This export has not been verified against the official reference by the institution — compare it with the reference before official use.
              </span>
            </p>

            <div>
              <p className="mb-1 font-semibold text-slate-800">Reproduced from the template</p>
              <ul className="space-y-1">
                {MATCHED.map((m) => (
                  <li key={m} className="flex gap-2 text-slate-600">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-1 font-semibold text-slate-800">Known deviations</p>
              <ul className="space-y-1.5">
                {discrepancies.map((d) => (
                  <li key={d.id} className="text-slate-600">
                    <span className="font-medium text-slate-800">{d.area}:</span> {d.detail} <span className="text-slate-500">{d.resolution}</span>
                  </li>
                ))}
                {EXTRA_DEVIATIONS.map((d) => (
                  <li key={d} className="text-slate-600">
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {doc.missing.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <FileWarning className="size-4" /> {doc.missing.length} required field{doc.missing.length === 1 ? "" : "s"} printed as grey placeholders
                </p>
                <p className="mb-1 text-xs">Placeholders like “[Course Code]” also appear in the PDF. Fill them in before printing.</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {doc.missing.map((m) => (
                    <li key={m}>
                      <StepLink id={id} step={MISSING_STEP[m] ?? (m.startsWith("CLO") ? "clos" : "course")}>
                        {m}
                      </StepLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 font-semibold text-slate-800">
                Validation {issueCount ? <span className="font-normal text-red-700">— {issueCount} issue{issueCount === 1 ? "" : "s"}</span> : null}
              </p>
              {issueCount === 0 ? (
                <p className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="size-4" /> No validation issues.
                </p>
              ) : (
                <ul className="space-y-1">
                  {issueEntries.map((k) => (
                    <li key={k} className="flex items-center justify-between gap-2 rounded-md border border-red-100 bg-red-50/60 px-2.5 py-1.5">
                      <span className="text-slate-700">
                        {SECTION_LABELS[k]}: <span className="text-red-700">{issues[k].length}</span>
                        <span className="block text-xs text-slate-500">{issues[k][0]}</span>
                      </span>
                      <StepLink id={id} step={k}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <Pencil className="size-3.5" /> Fix
                        </span>
                      </StepLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <PaginatedDocument
        spec={doc.spec}
        blocks={doc.blocks}
        fileName={`${fileBase}-syllabus.pdf`}
        title={`Course Syllabus — ${title}`}
        notice={
          !settings.paperDiscrepancyResolved ? (
            <p className="text-xs text-amber-800">Export is allowed, but the paper size has not been confirmed yet (see the notice above).</p>
          ) : undefined
        }
      />
    </div>
  );
}
