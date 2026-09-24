"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Copy,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  Link2,
  Loader2,
  PencilLine,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { store, useStoreState } from "@/lib/fah/store";
import { newExam } from "@/lib/fah/factories";
import { examTotals } from "@/lib/fah/calc";
import { extractTextFromFile, IMPORT_ACCEPT } from "@/lib/fah/services/exam-import";
import type { AppData, Exam, ExamTerm } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, DemoBadge, EmptyState, Field, LoadingBlock, PageHeader, SourceBadge } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { formatDate } from "../../common/utils";
import { applySyllabusToExam, duplicateExam, EXAM_TERMS, examDisplayTitle, NONE, pendingImports } from "./shared";

type Workflow = "manual" | "ai" | "import";

export function ExamList() {
  const { data, ready } = useStoreState();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Exam | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = [...data.exams].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    if (!t) return list;
    return list.filter((e) => [e.courseCode, e.courseTitle, e.title, e.term, e.semester, e.academicYear].some((v) => (v || "").toLowerCase().includes(t)));
  }, [data.exams, q]);
  const own = filtered.filter((e) => !e.isDemo);
  const demo = filtered.filter((e) => e.isDemo);

  const onDuplicate = async (e: Exam) => {
    try {
      const copy = duplicateExam(e);
      store.upsert("exams", copy);
      await store.flush();
      console.log("[exams] duplicated", e.id, "→", copy.id);
      toast.success("Exam duplicated", { description: "Answer keys, rubrics and images were copied. Linked TOS were not." });
      navigate(`/exams/${copy.id}`);
    } catch (err) {
      console.error("[exams] duplicate failed", err);
      toast.error("Could not duplicate the exam", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const linkedTos = pendingDelete ? data.tos.filter((t) => t.examId === pendingDelete.id) : [];
  const blocked = linkedTos.length > 0;

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (blocked) {
      setPendingDelete(null);
      return;
    }
    try {
      store.remove("exams", pendingDelete.id);
      await store.flush();
      console.log("[exams] deleted", pendingDelete.id);
      toast.success("Exam deleted");
    } catch (err) {
      console.error("[exams] delete failed", err);
      toast.error("Could not delete the exam", { description: err instanceof Error ? err.message : String(err) });
    }
    setPendingDelete(null);
  };

  if (!ready) return <LoadingBlock />;

  const newBtn = (
    <Button onClick={() => setCreateOpen(true)} className="bg-[#1b2466] hover:bg-[#262f7a]">
      <FilePlus2 className="size-4" /> New exam
    </Button>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Assessment"
        title="Exam Builder"
        description="Build examinations manually, generate questions from your processed resources with AI, or import an existing exam. Answer keys and rubrics are kept separate from the student paper."
        actions={newBtn}
      />

      {data.exams.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="No exams yet"
          description="Create an exam manually, generate one from your resources, or import an existing exam file."
          action={newBtn}
        />
      ) : (
        <>
          <div className="relative mb-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="exam-search" className="sr-only">
              Search exams
            </label>
            <Input id="exam-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by course, title, term or year…" className="bg-white pl-9" />
          </div>
          {filtered.length === 0 && <EmptyState icon={<Search className="size-6" />} title="No matching exams" description={`Nothing matches “${q}”.`} />}
          {own.length > 0 && (
            <Group title="Your exams" count={own.length}>
              {own.map((e) => (
                <ExamCard key={e.id} e={e} data={data} onDuplicate={() => void onDuplicate(e)} onDelete={() => setPendingDelete(e)} />
              ))}
            </Group>
          )}
          {demo.length > 0 && (
            <Group
              title="Demonstration exams"
              count={demo.length}
              note={
                <span className="inline-flex items-center gap-1">
                  <FlaskConical className="size-3.5" /> Sample content — can be removed in Templates & Settings.
                </span>
              }
            >
              {demo.map((e) => (
                <ExamCard key={e.id} e={e} data={data} onDuplicate={() => void onDuplicate(e)} onDelete={() => setPendingDelete(e)} />
              ))}
            </Group>
          )}
        </>
      )}

      <CreateExamDialog open={createOpen} onOpenChange={setCreateOpen} data={data} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={blocked ? "This exam cannot be deleted yet" : "Delete this exam?"}
        confirmLabel={blocked ? "OK" : "Delete exam"}
        destructive={!blocked}
        onConfirm={() => void onConfirmDelete()}
        description={
          pendingDelete &&
          (blocked ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{examDisplayTitle(pendingDelete)}</strong> is the source of the Table(s) of Specifications below. Deleting it would leave them without a
                source exam. Delete each TOS or link it to another exam first, then delete this exam.
              </p>
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                {linkedTos.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Link2 className="size-3.5 shrink-0" />
                    <a className="font-medium underline" href={href(`/tos/${t.id}`)} onClick={() => setPendingDelete(null)}>
                      {t.title || "Untitled TOS"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              <strong>{examDisplayTitle(pendingDelete)}</strong> with all its sections, questions, answer keys and rubrics will be permanently removed. This cannot be
              undone.
            </p>
          ))
        }
      />
    </div>
  );
}

function Group({ title, count, note, children }: { title: string; count: number; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-lg font-semibold text-[#1b2466]">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">{count}</span>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
    </section>
  );
}

function ExamCard({ e, data, onDuplicate, onDelete }: { e: Exam; data: AppData; onDuplicate: () => void; onDelete: () => void }) {
  const t = examTotals(e);
  const syl = e.syllabusId ? data.syllabi.find((s) => s.id === e.syllabusId) : undefined;
  const tosCount = data.tos.filter((x) => x.examId === e.id).length;
  const flagged = e.sections.reduce((a, s) => a + s.questions.filter((q) => q.flags?.length).length, 0);
  const term = [e.semester, e.academicYear ? `AY ${e.academicYear}` : ""].filter(Boolean).join(" · ");
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1.5 bg-gradient-to-r from-[#1b2466] via-[#2d3a8c] to-amber-400" aria-hidden />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <span className="rounded-md bg-[#1b2466]/5 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-[#1b2466]">{e.courseCode || "No course code"}</span>
          <div className="flex flex-wrap gap-1">
            {e.isDemo && <DemoBadge />}
            <SourceBadge source={e.source === "ai" ? "ai" : e.source === "import" ? "import" : "manual"} />
          </div>
        </div>
        <a href={href(`/exams/${e.id}`)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40">
          <h3 className="font-display text-base font-semibold leading-snug text-slate-900 group-hover:text-[#1b2466]">{examDisplayTitle(e)}</h3>
        </a>
        {e.courseTitle && <p className="mt-0.5 text-sm text-slate-600">{e.courseTitle}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="size-3.5" /> {e.term}
          {term ? ` · ${term}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
            <ClipboardList className="size-3" /> {t.items} item{t.items === 1 ? "" : "s"} · {t.points} pt{t.points === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-900">
            <FileSpreadsheet className="size-3" /> {tosCount} TOS linked
          </span>
          {flagged > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 font-medium text-orange-900">{flagged} flagged</span>}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <BookOpenText className="size-3.5" />
          {syl ? (
            <a className="truncate underline-offset-2 hover:underline" href={href(`/syllabi/${syl.id}`)}>
              {syl.courseCode} {syl.descriptiveTitle}
            </a>
          ) : (
            "No linked syllabus"
          )}
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Updated {formatDate(e.updatedAt)} · revision {e.revision}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={() => navigate(`/exams/${e.id}`)}>
            <PencilLine className="size-4" /> Open
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/exams/${e.id}/preview`)}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button size="sm" variant="ghost" onClick={onDuplicate} aria-label={`Duplicate ${examDisplayTitle(e)}`} title="Duplicate">
            <Copy className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={onDelete} aria-label={`Delete ${examDisplayTitle(e)}`} title="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Create dialog (3 workflows)                                         */
/* ------------------------------------------------------------------ */

function CreateExamDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: AppData }) {
  const [workflow, setWorkflow] = useState<Workflow>("manual");
  const [syllabusId, setSyllabusId] = useState<string>(NONE);
  const [term, setTerm] = useState<ExamTerm>("First Prelim");
  const [templateId, setTemplateId] = useState<string>(NONE);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const templates = data.resources.filter((r) => r.purpose === "exam-template");

  const reset = () => {
    setWorkflow("manual");
    setSyllabusId(NONE);
    setTerm("First Prelim");
    setTemplateId(NONE);
    setText("");
    setFileName(undefined);
    setFileWarnings([]);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    try {
      const r = await extractTextFromFile(f);
      setText(r.text);
      setFileName(r.fileName);
      setFileWarnings(r.warnings);
      console.log("[exams] import file read", { file: r.fileName, chars: r.text.length, kind: r.kind });
      toast.success("File read", { description: `${r.text.length.toLocaleString()} characters extracted from ${r.fileName}.` });
    } catch (e) {
      console.error("[exams] import file failed", e);
      toast.error("Could not read the file", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const create = async () => {
    if (workflow === "import" && !text.trim()) {
      toast.error("Paste the exam text or upload a file first.");
      return;
    }
    setBusy(true);
    try {
      let exam = newExam();
      exam.term = term;
      exam.source = workflow;
      const syl = syllabusId !== NONE ? data.syllabi.find((s) => s.id === syllabusId) : undefined;
      if (syl) exam = applySyllabusToExam(exam, syl);
      if (templateId !== NONE) exam.templateResourceId = templateId;
      if (workflow === "import") exam.sections = [];
      store.upsert("exams", exam);
      await store.flush();
      console.log("[exams] created", { id: exam.id, workflow });
      if (workflow === "import") pendingImports.set(exam.id, { text, fileName });
      onOpenChange(false);
      reset();
      navigate(workflow === "manual" ? `/exams/${exam.id}` : `/exams/${exam.id}?mode=${workflow === "ai" ? "generate" : "import"}`);
    } catch (e) {
      console.error("[exams] create failed", e);
      toast.error("Could not create the exam", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const options: { key: Workflow; title: string; desc: string; icon: React.ReactNode }[] = [
    { key: "manual", title: "Create manually", desc: "Start with an empty section and write your own questions.", icon: <PencilLine className="size-5" /> },
    { key: "ai", title: "Generate with AI from resources", desc: "Plan sections, pick processed resources, then review AI-drafted questions before accepting.", icon: <Sparkles className="size-5" /> },
    { key: "import", title: "Import existing exam", desc: "Paste text or upload .txt, .docx or .pdf. Wording is kept exactly; uncertain items are flagged.", icon: <FileUp className="size-5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : (onOpenChange(false), reset()))}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[#1b2466]">New exam</DialogTitle>
          <DialogDescription>Choose how you want to start. You can combine workflows later — e.g. import an exam, then generate extra items.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Creation workflow" className="grid gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={workflow === o.key}
              onClick={() => setWorkflow(o.key)}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40",
                workflow === o.key ? "border-[#1b2466] bg-[#1b2466]/5 ring-1 ring-[#1b2466]" : "border-slate-200 bg-white hover:border-[#1b2466]/50"
              )}
            >
              <span className={cn("flex size-9 items-center justify-center rounded-lg", workflow === o.key ? "bg-[#1b2466] text-white" : "bg-amber-50 text-amber-800")}>{o.icon}</span>
              <span className="text-sm font-semibold text-slate-900">{o.title}</span>
              <span className="text-xs leading-snug text-slate-500">{o.desc}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Linked syllabus (optional)" hint="Fills in course code, title, semester and academic year.">
            <Select value={syllabusId} onValueChange={setSyllabusId}>
              <SelectTrigger aria-label="Linked syllabus" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No syllabus</SelectItem>
                {data.syllabi.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.courseCode || "No code"} · {s.descriptiveTitle || "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Term">
            <Select value={term} onValueChange={(v) => setTerm(v as ExamTerm)}>
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
        </div>

        {workflow === "import" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="sr-only" id="exam-import-file" onChange={(e) => void onFile(e.target.files?.[0])} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                {reading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload .txt / .docx / .pdf
              </Button>
              {fileName && <span className="text-xs text-slate-600">Loaded: {fileName}</span>}
            </div>
            <Field label="Exam text" htmlFor="exam-import-text" hint="Paste the full exam here, or upload a file above. The text is not rewritten.">
              <Textarea id="exam-import-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="bg-white font-mono text-xs" placeholder={"TEST I. MULTIPLE CHOICE\nDirections: Choose the letter of the best answer.\n1. …\n   a. …   b. …"} />
            </Field>
            {fileWarnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-900">
                {fileWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <Field label="Exam template resource (optional)" hint={templates.length ? "Used as a formatting hint when recognizing headings." : "No resource with purpose “Exam template” yet — add one in Resources."}>
              <Select value={templateId} onValueChange={setTemplateId} disabled={!templates.length}>
                <SelectTrigger aria-label="Exam template resource" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No template</SelectItem>
                  {templates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => (onOpenChange(false), reset())}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={busy || reading} className="bg-[#1b2466] hover:bg-[#262f7a]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : options.find((o) => o.key === workflow)?.icon}
            {workflow === "manual" ? "Create exam" : workflow === "ai" ? "Create & plan generation" : "Create & extract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
