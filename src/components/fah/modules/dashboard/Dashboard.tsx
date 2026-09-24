"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  FileSpreadsheet,
  FlaskConical,
  Library,
  Loader2,
  LogIn,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { store, useAppData } from "@/lib/fah/store";
import { useAiStatus } from "@/lib/fah/services/ai";
import { useAuth } from "@/lib/fah/services/auth";
import { newExam, newSyllabus } from "@/lib/fah/factories";
import { computeTos } from "@/lib/fah/calc";
import { syllabusIssues } from "@/lib/fah/validation";
import { DemoBadge, Panel } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { formatDateTime } from "../../common/utils";

export function Dashboard() {
  const data = useAppData();
  const ai = useAiStatus();
  const { session } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const recent = useMemo(() => {
    const items = [
      ...data.syllabi.map((s) => ({
        id: s.id,
        kind: "Syllabus",
        title: `${s.courseCode || "Untitled"} — ${s.descriptiveTitle || "Untitled syllabus"}`,
        updatedAt: s.updatedAt,
        link: `/syllabi/${s.id}`,
        isDemo: s.isDemo,
        icon: BookOpenText,
      })),
      ...data.exams.map((e) => ({
        id: e.id,
        kind: "Exam",
        title: `${e.courseCode || "—"} · ${e.title || e.term}`,
        updatedAt: e.updatedAt,
        link: `/exams/${e.id}`,
        isDemo: e.isDemo,
        icon: ClipboardList,
      })),
      ...data.tos.map((t) => ({
        id: t.id,
        kind: "TOS",
        title: t.title || "Table of Specifications",
        updatedAt: t.updatedAt,
        link: `/tos/${t.id}`,
        isDemo: t.isDemo,
        icon: FileSpreadsheet,
      })),
    ];
    return items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6);
  }, [data]);

  const tosReview = useMemo(
    () =>
      data.tos
        .map((t) => {
          const exam = data.exams.find((e) => e.id === t.examId);
          const c = computeTos(t, exam, data.institutional.tosLowerOrderCount);
          return { t, needsReview: c.needsReview, errors: c.errors.length };
        })
        .filter((x) => x.needsReview || x.errors > 0),
    [data]
  );

  const sylIssues = useMemo(
    () =>
      data.syllabi
        .map((s) => {
          const iss = syllabusIssues(s, data);
          const count = Object.values(iss).reduce((a, l) => a + l.length, 0);
          const firstStep = (Object.keys(iss) as (keyof typeof iss)[]).find((k) => iss[k].length > 0);
          return { s, count, firstStep };
        })
        .filter((x) => x.count > 0),
    [data]
  );

  const counts = [
    { label: "Syllabi", n: data.syllabi.length, link: "/syllabi", icon: BookOpenText },
    { label: "Exams", n: data.exams.length, link: "/exams", icon: ClipboardList },
    { label: "Tables of Specifications", n: data.tos.length, link: "/tos", icon: FileSpreadsheet },
    { label: "Resources", n: data.resources.length, link: "/resources", icon: Library },
    { label: "IT Program Outcomes", n: data.libraryPOs.filter((p) => p.status === "active").length, link: "/outcomes", icon: Target },
  ];

  const demoSyl = data.syllabi.find((s) => s.isDemo);
  const demoExam = data.exams.find((e) => e.isDemo);
  const demoTos = data.tos.find((t) => t.isDemo);
  const sylLink = (step?: string) => (demoSyl ? `/syllabi/${demoSyl.id}${step ? `?step=${step}` : ""}` : "/syllabi");
  const steps: { title: string; detail: string; link?: string; done: boolean }[] = [
    { title: "Enter demonstration mode or sign in with Google", detail: "You are signed in — your work is stored in this browser.", done: !!session },
    { title: "Create a syllabus and enter course information", detail: "Course code, title, units, semester and description.", link: sylLink("course"), done: data.syllabi.length > 0 },
    { title: "Select Program Outcomes and review alignment", detail: "Choose discipline and IT-specific POs; confirm PEO mappings.", link: sylLink("outcomes"), done: data.syllabi.some((s) => s.addressedPoIds.length > 0) },
    { title: "Write CLOs and the 18-week learning plan", detail: "Map each CLO to POs; plan lessons around the exam weeks.", link: sylLink("plan"), done: data.syllabi.some((s) => s.clos.length > 0 && s.learningPlan.some((l) => l.kind === "lesson")) },
    { title: "Add references, policies, grading and signatories", detail: "Cite resources and select who prepares, reviews and approves.", link: sylLink("references"), done: data.syllabi.some((s) => s.references.length > 0) },
    { title: "Preview and export the syllabus", detail: "Check pagination against the reference, then download the PDF.", link: demoSyl ? `/syllabi/${demoSyl.id}/preview` : "/syllabi", done: false },
    { title: "Create or import an examination", detail: "Build sections and items, or import a PDF/DOCX exam for review.", link: demoExam ? `/exams/${demoExam.id}` : "/exams", done: data.exams.length > 0 },
    { title: "Generate and edit the Table of Specifications", detail: "Map every item to an objective and cognitive level.", link: demoTos ? `/tos/${demoTos.id}` : "/tos", done: data.tos.length > 0 },
    { title: "Export both TOS PDFs (horizontal and vertical)", detail: "Placement numbers follow each template's reading direction.", link: demoTos ? `/tos/${demoTos.id}` : "/tos", done: false },
    { title: "Refresh the page and recover your saved records", detail: "Everything saved is restored from browser storage.", link: "/settings", done: false },
  ];

  const createSyllabus = () => {
    const s = newSyllabus(data);
    store.upsert("syllabi", s);
    console.log("[dashboard] created syllabus", s.id);
    navigate(`/syllabi/${s.id}`);
  };
  const createExam = () => {
    const e = newExam();
    store.upsert("exams", e);
    console.log("[dashboard] created exam", e.id);
    navigate(`/exams/${e.id}`);
  };

  const aiConf = {
    checking: { icon: <Loader2 className="size-5 animate-spin" />, title: "Checking AI service…", cls: "bg-slate-100 text-slate-600" },
    connected: { icon: <Sparkles className="size-5" />, title: "AI connected", cls: "bg-emerald-100 text-emerald-700" },
    unavailable: { icon: <CloudOff className="size-5" />, title: "AI unavailable", cls: "bg-amber-100 text-amber-800" },
    demo: { icon: <FlaskConical className="size-5" />, title: "AI demonstration mode", cls: "bg-fuchsia-100 text-fuchsia-700" },
  }[ai.state];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[#1b2466] px-6 py-8 text-white shadow-lg md:px-10">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Faculty Academic Helper</p>
            <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
              {greeting}, {session?.name?.split(" ")[0] || "colleague"}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-indigo-100">
              Prepare course syllabi, examinations and Tables of Specifications that follow the institutional templates. Everything you save stays in this browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createSyllabus} className="bg-amber-400 text-[#1b2466] hover:bg-amber-300">
              <Plus className="size-4" /> New syllabus
            </Button>
            <Button onClick={createExam} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Plus className="size-4" /> New exam
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <a href={href("/resources")}>
                <Library className="size-4" /> Add resource
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {counts.map((c) => {
          const Icon = c.icon;
          return (
            <a
              key={c.label}
              href={href(c.link)}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1b2466]/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#1b2466]/5 text-[#1b2466]">
                  <Icon className="size-4" />
                </span>
                <ArrowRight className="size-4 text-slate-300 transition group-hover:text-amber-600" />
              </div>
              <p className="mt-3 font-display text-3xl font-semibold text-[#1b2466]">{c.n}</p>
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
            </a>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI status */}
        <Panel title="AI assistance" className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${aiConf.cls}`}>{aiConf.icon}</span>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{aiConf.title}</p>
              <p>{ai.message}</p>
              {ai.provider && <p className="text-xs text-slate-500">Provider: {ai.provider}</p>}
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed">
                <strong>Signing in with Google does not give this app ChatGPT or OpenAI access.</strong> AI requests go only through this
                application&apos;s secure server; no AI keys are stored in your browser. When AI is unavailable, suggestions are labeled
                <em> demonstration output</em>. Manual editing always works.
              </p>
              <a href={href("/settings")} className="inline-flex items-center gap-1 text-xs font-medium text-[#1b2466] hover:underline">
                AI settings <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </Panel>

        {/* Sign-in mode */}
        <Panel title="Sign-in mode">
          <div className="flex items-start gap-4">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${session?.mode === "google" ? "bg-sky-100 text-sky-700" : "bg-fuchsia-100 text-fuchsia-700"}`}
            >
              {session?.mode === "google" ? <LogIn className="size-5" /> : <FlaskConical className="size-5" />}
            </span>
            <div className="space-y-1 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{session?.mode === "google" ? "Signed in with Google" : "Demonstration mode"}</p>
              <p>{session?.mode === "google" ? session.email : "You entered without a Google account."}</p>
              <p className="text-xs text-slate-500">
                In both modes your records are saved in this browser (IndexedDB). Export a backup from Templates and Settings → Data.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Continue */}
        <Panel title="Continue where you left off" description="Recently updated syllabi, exams and tables of specifications.">
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Nothing yet. Start with a new syllabus or exam.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.id}>
                    <a href={href(r.link)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>
                        <span className="text-xs text-slate-500">
                          {r.kind} · updated {formatDateTime(r.updatedAt)}
                        </span>
                      </span>
                      {r.isDemo && <DemoBadge className="hidden sm:inline-flex" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Attention */}
        <Panel title="Needs attention" description="Tables of specifications to review and syllabi with open validation issues.">
          {tosReview.length === 0 && sylIssues.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="size-4" /> No open issues.
            </p>
          ) : (
            <ul className="space-y-2">
              {tosReview.map(({ t, needsReview, errors }) => (
                <li key={t.id}>
                  <a href={href(`/tos/${t.id}`)} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm hover:bg-amber-50">
                    <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-amber-700" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{t.title}</span>
                      <span className="text-xs text-amber-900">
                        {needsReview && "Source exam changed — review mappings. "}
                        {errors > 0 && `${errors} error(s) in totals or mappings.`}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
              {sylIssues.map(({ s, count, firstStep }) => (
                <li key={s.id}>
                  <a
                    href={href(`/syllabi/${s.id}${firstStep ? `?step=${firstStep}` : ""}`)}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">
                        {s.courseCode || "Untitled"} — {s.descriptiveTitle || "Untitled syllabus"}
                      </span>
                      <span className="text-xs text-slate-500">{count} validation issue(s) to resolve</span>
                    </span>
                    {s.isDemo && <DemoBadge className="hidden sm:inline-flex" />}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Workflow */}
      <Panel
        title="Sample workflow"
        description="A guided path through the whole process. The demonstration syllabus, exam and TOS let you try each step immediately."
      >
        <ol className="grid gap-3 md:grid-cols-2">
          {steps.map((st, i) => (
            <li key={st.title} className="flex gap-3 rounded-xl border border-slate-200 bg-[#fbfaf6] p-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${st.done ? "bg-emerald-600 text-white" : "bg-[#1b2466] text-amber-300"}`}
                aria-label={st.done ? "Completed" : `Step ${i + 1}`}
              >
                {st.done ? <CheckCircle2 className="size-4" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{st.title}</p>
                <p className="text-xs text-slate-500">{st.detail}</p>
                {st.link && (
                  <a href={href(st.link)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1b2466] hover:underline">
                    Open <ArrowRight className="size-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 px-4 py-3 text-xs text-fuchsia-900">
          <DemoBadge />
          <span>
            Demonstration records are labeled throughout the app. They are examples only — remove them any time from{" "}
            <a href={href("/settings")} className="font-semibold underline">
              Templates and Settings → Data
            </a>
            .
          </span>
          <Badge variant="outline" className="ml-auto border-fuchsia-300 text-fuchsia-800">
            {data.syllabi.filter((s) => s.isDemo).length + data.exams.filter((e) => e.isDemo).length + data.tos.filter((t) => t.isDemo).length + data.resources.filter((r) => r.isDemo).length} demo records
          </Badge>
        </div>
      </Panel>
    </div>
  );
}
