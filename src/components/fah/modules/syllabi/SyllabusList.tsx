"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpenText, CalendarDays, Copy, Eye, FilePlus2, FlaskConical, Link2, ListChecks, PencilLine, Search, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { store, useStoreState } from "@/lib/fah/store";
import { duplicateSyllabus, newSyllabus } from "@/lib/fah/factories";
import type { Syllabus } from "@/lib/fah/types";
import { ConfirmDialog, DemoBadge, EmptyState, LoadingBlock, PageHeader } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { formatDate } from "../../common/utils";

export function SyllabusList() {
  const { data, ready } = useStoreState();
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Syllabus | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = [...data.syllabi].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    if (!t) return list;
    return list.filter((s) =>
      [s.courseCode, s.descriptiveTitle, s.semester, s.academicYear, s.syllabusCode, s.collegeName].some((v) => (v || "").toLowerCase().includes(t))
    );
  }, [data.syllabi, q]);

  const own = filtered.filter((s) => !s.isDemo);
  const demo = filtered.filter((s) => s.isDemo);

  const onNew = async () => {
    try {
      const s = newSyllabus(data);
      store.upsert("syllabi", s);
      await store.flush();
      console.log("[syllabi] created", s.id);
      navigate(`/syllabi/${s.id}`);
    } catch (e) {
      console.error("[syllabi] create failed", e);
      toast.error("Could not create the syllabus", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const onDuplicate = async (s: Syllabus) => {
    try {
      const copy = duplicateSyllabus(s);
      store.upsert("syllabi", copy);
      await store.flush();
      console.log("[syllabi] duplicated", s.id, "→", copy.id);
      toast.success("Syllabus duplicated", { description: "Revision information was preserved in the copy." });
      navigate(`/syllabi/${copy.id}`);
    } catch (e) {
      console.error("[syllabi] duplicate failed", e);
      toast.error("Could not duplicate the syllabus", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const linkedExams = pendingDelete ? data.exams.filter((e) => e.syllabusId === pendingDelete.id) : [];
  const linkedTos = pendingDelete ? data.tos.filter((t) => t.syllabusId === pendingDelete.id) : [];
  const blocked = linkedExams.length + linkedTos.length > 0;

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (blocked) {
      setPendingDelete(null);
      return;
    }
    try {
      store.remove("syllabi", pendingDelete.id);
      await store.flush();
      console.log("[syllabi] deleted", pendingDelete.id);
      toast.success("Syllabus deleted");
    } catch (e) {
      console.error("[syllabi] delete failed", e);
      toast.error("Could not delete the syllabus", { description: e instanceof Error ? e.message : String(e) });
    }
    setPendingDelete(null);
  };

  if (!ready) return <LoadingBlock />;

  return (
    <div>
      <PageHeader
        eyebrow="Course syllabi"
        title="Syllabi"
        description="Create outcomes-based course syllabi from the institutional template. Each syllabus keeps its own copy of the institutional statements and program outcomes."
        actions={
          <Button onClick={onNew} className="bg-[#1b2466] hover:bg-[#262f7a]">
            <FilePlus2 className="size-4" /> New syllabus
          </Button>
        }
      />

      {data.syllabi.length === 0 ? (
        <EmptyState
          icon={<BookOpenText className="size-6" />}
          title="No syllabi yet"
          description="Start a new syllabus. Institutional statements, PEOs and the template-prescribed program outcomes are filled in for you."
          action={
            <Button onClick={onNew} className="bg-[#1b2466] hover:bg-[#262f7a]">
              <FilePlus2 className="size-4" /> New syllabus
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative mb-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="syllabus-search" className="sr-only">
              Search syllabi
            </label>
            <Input
              id="syllabus-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by course code, title, semester or year…"
              className="bg-white pl-9"
            />
          </div>

          {filtered.length === 0 && (
            <EmptyState icon={<Search className="size-6" />} title="No matching syllabi" description={`Nothing matches “${q}”. Try another course code or title.`} />
          )}

          {own.length > 0 && (
            <Group title="Your syllabi" count={own.length}>
              {own.map((s) => (
                <SyllabusCard key={s.id} s={s} onDuplicate={() => void onDuplicate(s)} onDelete={() => setPendingDelete(s)} />
              ))}
            </Group>
          )}
          {filtered.length > 0 && own.length === 0 && !q && (
            <div className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm text-slate-600">
              You have not created your own syllabus yet. Use <strong>New syllabus</strong>, or duplicate a demonstration syllabus to start from an example.
            </div>
          )}

          {demo.length > 0 && (
            <Group
              title="Demonstration syllabi"
              count={demo.length}
              note={
                <span className="inline-flex items-center gap-1">
                  <FlaskConical className="size-3.5" /> Sample content — can be removed in Templates & Settings.
                </span>
              }
            >
              {demo.map((s) => (
                <SyllabusCard key={s.id} s={s} onDuplicate={() => void onDuplicate(s)} onDelete={() => setPendingDelete(s)} />
              ))}
            </Group>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={blocked ? "This syllabus cannot be deleted yet" : "Delete this syllabus?"}
        confirmLabel={blocked ? "OK" : "Delete syllabus"}
        destructive={!blocked}
        onConfirm={() => void onConfirmDelete()}
        description={
          pendingDelete &&
          (blocked ? (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{pendingDelete.courseCode || "Untitled"}</strong> is linked to the records below. Deleting it would leave them pointing to a missing
                syllabus. Open each record and change or clear its linked syllabus first, then delete.
              </p>
              <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                {linkedExams.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <Link2 className="size-3.5 shrink-0" /> Exam:{" "}
                    <a className="font-medium underline" href={href(`/exams/${e.id}`)} onClick={() => setPendingDelete(null)}>
                      {e.title || `${e.courseCode} ${e.term}`.trim() || "Untitled exam"}
                    </a>
                  </li>
                ))}
                {linkedTos.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <Link2 className="size-3.5 shrink-0" /> Table of Specifications:{" "}
                    <a className="font-medium underline" href={href(`/tos/${t.id}`)} onClick={() => setPendingDelete(null)}>
                      {t.title || "Untitled TOS"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm">
              <strong>
                {pendingDelete.courseCode || "Untitled"}
                {pendingDelete.descriptiveTitle ? ` · ${pendingDelete.descriptiveTitle}` : ""}
              </strong>{" "}
              and all its outcomes, learning plan and references will be permanently removed. This cannot be undone.
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

function SyllabusCard({ s, onDuplicate, onDelete }: { s: Syllabus; onDuplicate: () => void; onDelete: () => void }) {
  const lessons = s.learningPlan.filter((l) => l.kind === "lesson").length;
  const term = [s.semester, s.academicYear ? `AY ${s.academicYear}` : ""].filter(Boolean).join(" · ");
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1.5 bg-gradient-to-r from-[#1b2466] via-[#2d3a8c] to-amber-400" aria-hidden />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="rounded-md bg-[#1b2466]/5 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-[#1b2466]">{s.courseCode || "No course code"}</span>
          {s.isDemo && <DemoBadge />}
        </div>
        <a href={href(`/syllabi/${s.id}`)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40">
          <h3 className="font-display text-base font-semibold leading-snug text-slate-900 group-hover:text-[#1b2466]">{s.descriptiveTitle || "Untitled syllabus"}</h3>
        </a>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="size-3.5" /> {term || "Semester / AY not set"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900">
            <Target className="size-3" /> {s.clos.length} CLO{s.clos.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-900">
            <ListChecks className="size-3" /> {lessons} plan item{lessons === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Updated {formatDate(s.updatedAt)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={() => navigate(`/syllabi/${s.id}`)}>
            <PencilLine className="size-4" /> Open
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/syllabi/${s.id}/preview`)}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button size="sm" variant="ghost" onClick={onDuplicate} aria-label={`Duplicate ${s.courseCode || "syllabus"}`} title="Duplicate">
            <Copy className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
            aria-label={`Delete ${s.courseCode || "syllabus"}`}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
