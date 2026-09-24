"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  FileQuestion,
  FileSpreadsheet,
  FlaskConical,
  Grid3x3,
  Info,
  PencilLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { store, useStoreState } from "@/lib/fah/store";
import { blankTos } from "@/lib/fah/factories";
import { examTotals } from "@/lib/fah/calc";
import { EXAM_TERM_TO_TOS_PERIOD } from "@/lib/fah/template";
import type { AppData, Exam, Tos } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, DemoBadge, EmptyState, LoadingBlock, PageHeader } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { formatDate } from "../../common/utils";
import { examDisplayName, flaggedQuestions, initialObjectives, tosStatus, unassignedMappings } from "./tos-utils";

function readFromExamParam(): string | null {
  if (typeof window === "undefined") return null;
  const q = window.location.hash.split("?")[1];
  if (!q) return null;
  return new URLSearchParams(q).get("fromExam");
}

export function TosList() {
  const { data, ready } = useStoreState();
  const [genOpen, setGenOpen] = useState(false);
  const [preselect, setPreselect] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tos | null>(null);

  // Deep link: #/tos?fromExam=<examId>
  useEffect(() => {
    const on = () => {
      const id = readFromExamParam();
      if (id) {
        console.log("[tos] deep link fromExam", id);
        setPreselect(id);
        setGenOpen(true);
      }
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const list = useMemo(() => [...data.tos].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")), [data.tos]);
  const own = list.filter((t) => !t.isDemo);
  const demo = list.filter((t) => t.isDemo);

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      store.remove("tos", pendingDelete.id);
      await store.flush();
      console.log("[tos] deleted", pendingDelete.id);
      toast.success("Table of Specifications deleted");
    } catch (e) {
      console.error("[tos] delete failed", e);
      toast.error("Could not delete the TOS", { description: e instanceof Error ? e.message : String(e) });
    }
    setPendingDelete(null);
  };

  const openGenerate = () => {
    setPreselect(null);
    setGenOpen(true);
  };

  if (!ready) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        eyebrow="Assessment planning"
        title="Tables of Specifications"
        description="Generate a TOS from an exam. Every exam item is mapped to one test objective and one cognitive level; the Horizontal and Vertical Item Placement layouts are produced from the same mappings."
        actions={
          <Button onClick={openGenerate} className="bg-[#1b2466] hover:bg-[#262f7a]" disabled={!data.exams.length}>
            <Sparkles className="size-4" /> Generate TOS
          </Button>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="size-6" />}
          title="No Tables of Specifications yet"
          description={
            data.exams.length
              ? "Choose a source exam and the app will prepare the objectives, propose item mappings and compute both placement layouts."
              : "Create or import an exam first — a TOS is always generated from an existing exam."
          }
          action={
            data.exams.length ? (
              <Button onClick={openGenerate} className="bg-[#1b2466] hover:bg-[#262f7a]">
                <Sparkles className="size-4" /> Generate TOS
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/exams")}>
                <FileQuestion className="size-4" /> Go to exams
              </Button>
            )
          }
        />
      ) : (
        <>
          {own.length > 0 && (
            <Group title="Your tables" count={own.length}>
              {own.map((t) => (
                <TosCard key={t.id} t={t} data={data} onDelete={() => setPendingDelete(t)} />
              ))}
            </Group>
          )}
          {demo.length > 0 && (
            <Group
              title="Demonstration tables"
              count={demo.length}
              note={
                <span className="inline-flex items-center gap-1">
                  <FlaskConical className="size-3.5" /> Sample content — can be removed in Templates & Settings.
                </span>
              }
            >
              {demo.map((t) => (
                <TosCard key={t.id} t={t} data={data} onDelete={() => setPendingDelete(t)} />
              ))}
            </Group>
          )}
        </>
      )}

      <GenerateTosDialog open={genOpen} onOpenChange={setGenOpen} data={data} preselectExamId={preselect} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this Table of Specifications?"
        confirmLabel="Delete TOS"
        destructive
        onConfirm={() => void onConfirmDelete()}
        description={
          pendingDelete && (
            <p className="text-sm">
              <strong>{pendingDelete.title || "Untitled TOS"}</strong>, its objectives and all item mappings will be permanently removed. The source exam is not affected.
            </p>
          )
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

export function TosStatusPill({ tone, label }: { tone: "ok" | "error" | "review"; label: string }) {
  const cls = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
    error: "border-red-300 bg-red-50 text-red-800",
    review: "border-amber-300 bg-amber-50 text-amber-900",
  }[tone];
  const icon = tone === "ok" ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />;
  return (
    <Badge variant="outline" className={cls}>
      {icon} {label}
    </Badge>
  );
}

function TosCard({ t, data, onDelete }: { t: Tos; data: AppData; onDelete: () => void }) {
  const st = tosStatus(t, data);
  const syl = t.syllabusId ? data.syllabi.find((s) => s.id === t.syllabusId) : undefined;
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1.5 bg-gradient-to-r from-[#1b2466] via-[#2d3a8c] to-amber-400" aria-hidden />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <span className="rounded-md bg-[#1b2466]/5 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-[#1b2466]">{t.subjectCode || "No subject code"}</span>
          <div className="flex flex-wrap gap-1">
            {t.isDemo && <DemoBadge />}
            <TosStatusPill tone={st.tone} label={st.label} />
          </div>
        </div>
        <a href={href(`/tos/${t.id}`)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40">
          <h3 className="font-display text-base font-semibold leading-snug text-slate-900 group-hover:text-[#1b2466]">{t.title || "Untitled TOS"}</h3>
        </a>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="size-3.5" /> {EXAM_TERM_TO_TOS_PERIOD[t.period] ?? t.period} ({t.period}) · {[t.semester, t.academicYear].filter(Boolean).join(" · ") || "Semester / AY not set"}
        </p>
        <dl className="mt-3 space-y-1 text-xs text-slate-600">
          <div className="flex gap-1.5">
            <dt className="flex items-center gap-1 font-medium text-slate-500">
              <FileQuestion className="size-3.5" /> Exam:
            </dt>
            <dd className="min-w-0 truncate">
              {st.exam ? (
                <a className="font-medium text-[#1b2466] underline-offset-2 hover:underline" href={href(`/exams/${st.exam.id}`)}>
                  {examDisplayName(st.exam)}
                </a>
              ) : (
                <span className="text-red-700">missing</span>
              )}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="flex items-center gap-1 font-medium text-slate-500">
              <BookOpenText className="size-3.5" /> Syllabus:
            </dt>
            <dd className="min-w-0 truncate">
              {syl ? (
                <a className="text-[#1b2466] underline-offset-2 hover:underline" href={href(`/syllabi/${syl.id}`)}>
                  {syl.courseCode} {syl.descriptiveTitle}
                </a>
              ) : (
                <span className="text-slate-400">not linked</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-900">
            <Grid3x3 className="size-3" /> {st.computed.totalCount}/{st.computed.examItemCount} items
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
            {st.computed.totalPoints}/{st.computed.examPoints} points
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {t.objectives.length} objective{t.objectives.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Updated {formatDate(t.updatedAt)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={() => navigate(`/tos/${t.id}`)}>
            <PencilLine className="size-4" /> Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
            aria-label={`Delete ${t.title || "TOS"}`}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Generate dialog                                                     */
/* ------------------------------------------------------------------ */

function GenerateTosDialog({
  open,
  onOpenChange,
  data,
  preselectExamId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: AppData;
  preselectExamId: string | null;
}) {
  const [examId, setExamId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (preselectExamId && data.exams.some((e) => e.id === preselectExamId)) setExamId(preselectExamId);
    else if (preselectExamId) {
      toast.error("The linked exam was not found", { description: "Choose a source exam from the list." });
      setExamId(undefined);
    }
  }, [open, preselectExamId, data.exams]);

  const created = data.exams.filter((e) => e.source !== "import");
  const imported = data.exams.filter((e) => e.source === "import");
  const exam = data.exams.find((e) => e.id === examId);
  const flagged = exam && exam.source === "import" ? flaggedQuestions(exam) : [];
  const totals = exam ? examTotals(exam) : null;
  const syl = exam?.syllabusId ? data.syllabi.find((s) => s.id === exam.syllabusId) : undefined;
  const existing = exam ? data.tos.filter((t) => t.examId === exam.id) : [];
  const blocked = !exam || flagged.length > 0 || (totals?.items ?? 0) === 0;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o && window.location.hash.includes("fromExam=")) window.history.replaceState(null, "", "#/tos");
  };

  const onCreate = async (e: Exam) => {
    setBusy(true);
    try {
      const tos = blankTos(e, data);
      tos.objectives = initialObjectives(e, data);
      tos.mappings = unassignedMappings(e);
      store.upsert("tos", tos);
      await store.flush();
      console.log("[tos] created", tos.id, "from exam", e.id, `${tos.objectives.length} objective(s), ${tos.mappings.length} item(s)`);
      toast.success("TOS created", { description: "Review the proposed item mappings, then accept them." });
      onOpenChange(false);
      navigate(`/tos/${tos.id}?automap=1`);
    } catch (err) {
      console.error("[tos] create failed", err);
      toast.error("Could not create the TOS", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const label = (e: Exam) => `${e.courseCode ? `${e.courseCode} · ` : ""}${examDisplayName(e)} (${e.term})${e.isDemo ? " — demo" : ""}`;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1b2466]">Generate a Table of Specifications</DialogTitle>
          <DialogDescription>
            Choose the source exam. Objectives are prefilled from the linked syllabus CLOs (or from question topics), then item mappings are proposed for your review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="tos-source-exam">
              Source exam
            </label>
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger id="tos-source-exam" className="w-full bg-white">
                <SelectValue placeholder="Select an exam…" />
              </SelectTrigger>
              <SelectContent>
                {created.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Created in the app</SelectLabel>
                    {created.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {label(e)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {imported.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Imported (extraction must be reviewed)</SelectLabel>
                    {imported.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {label(e)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {imported.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Imported exams can be used only after every flagged question from the extraction has been reviewed and cleared.
              </p>
            )}
          </div>

          {exam && totals && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>
                <strong>{totals.items}</strong> item{totals.items === 1 ? "" : "s"} · <strong>{totals.points}</strong> points · {exam.sections.length} section
                {exam.sections.length === 1 ? "" : "s"} · period <strong>{EXAM_TERM_TO_TOS_PERIOD[exam.term]}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Objectives from:{" "}
                {syl && syl.clos.length ? (
                  <>
                    {syl.clos.length} CLO(s) of <strong>{syl.courseCode}</strong> syllabus
                  </>
                ) : (
                  "question topics (no linked syllabus with CLOs)"
                )}
              </p>
              {existing.length > 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  This exam already has {existing.length} TOS record(s). A new, separate TOS will be created.
                </p>
              )}
            </div>
          )}

          {exam && totals?.items === 0 && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              This exam has no items yet. Add questions before generating a TOS.
            </p>
          )}

          {flagged.length > 0 && exam && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" /> Extraction not fully reviewed
              </p>
              <p className="mt-1">
                {flagged.length} imported question(s) still carry extraction flags. Item counts and points could be wrong, so a TOS cannot be generated yet.
              </p>
              <ul className="mt-1 max-h-28 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                {flagged.slice(0, 12).map((f) => (
                  <li key={f.label}>
                    {f.label}: {f.flags.join("; ")}
                  </li>
                ))}
              </ul>
              <a className="mt-2 inline-block font-medium underline" href={href(`/exams/${exam.id}`)} onClick={() => close(false)}>
                Open the exam to review flagged questions
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button className={cn("bg-[#1b2466] hover:bg-[#262f7a]")} disabled={blocked || busy} onClick={() => exam && void onCreate(exam)}>
            <Sparkles className="size-4" /> {busy ? "Creating…" : "Create & map items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
