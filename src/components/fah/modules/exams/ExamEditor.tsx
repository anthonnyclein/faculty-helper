"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Eye, FileSpreadsheet, FileUp, ListChecks, Lock, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData, useRecordDraft } from "@/lib/fah/store";
import type { Exam } from "@/lib/fah/types";
import { AiStatusBadge, DemoBadge, EmptyState, LoadingBlock, PageHeader, SaveBar, SourceBadge } from "../../common/ui";
import { href, navigate } from "../../common/router";
import { examDisplayTitle, hashQuery } from "./shared";
import { ExamDetailsPanel } from "./ExamDetailsPanel";
import { ExamSummaryBar } from "./ExamSummaryBar";
import { SectionsEditor } from "./SectionsEditor";
import { ExamGeneratePanel } from "./ExamGeneratePanel";
import { ExamRegeneratePanel } from "./ExamRegeneratePanel";
import { ExamImportPanel } from "./ExamImportPanel";

export type ExamUpdater = (updater: Exam | ((e: Exam) => Exam)) => void;

export function ExamEditor({ id }: { id: string }) {
  const data = useAppData();
  const { ready, record, draft, setDraft, save, discard, status, error, lastSavedAt, autosave } = useRecordDraft("exams", id);
  const [tab, setTab] = useState("questions");
  const [selected, setSelected] = useState<string[]>([]);
  const [regenRequest, setRegenRequest] = useState(0);

  // Workflow hand-off from the list (?mode=generate | ?mode=import).
  useEffect(() => {
    const mode = hashQuery("mode");
    if (mode === "generate") setTab("generate");
    else if (mode === "import") setTab("import");
    if (mode) {
      console.log("[exam-editor] opened with mode", mode);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/exams/${id}`);
    }
  }, [id]);

  const exam = draft as Exam | undefined;

  // A brand-new manual exam opens on its details first.
  const initialTabSet = useRef(false);
  useEffect(() => {
    if (initialTabSet.current || !record) return;
    initialTabSet.current = true;
    const r = record as Exam;
    if (!hashQuery("mode") && r.source === "manual" && !r.courseCode && !r.title && r.sections.every((s) => !s.questions.length)) setTab("details");
  }, [record]);
  const setExam: ExamUpdater = useCallback((u) => setDraft(u as Exam | ((e: Exam) => Exam)), [setDraft]);

  // Drop selections for questions that no longer exist.
  const allIds = useMemo(() => new Set((exam?.sections ?? []).flatMap((s) => s.questions.map((q) => q.id))), [exam]);
  useEffect(() => {
    setSelected((sel) => (sel.every((x) => allIds.has(x)) ? sel : sel.filter((x) => allIds.has(x))));
  }, [allIds]);

  if (!ready) return <LoadingBlock />;
  if (!record || !exam)
    return (
      <EmptyState
        icon={<ClipboardList className="size-6" />}
        title="Exam not found"
        description="It may have been deleted. Return to the Exam Builder to open another exam."
        action={<Button onClick={() => navigate("/exams")}>Back to exams</Button>}
      />
    );

  const onSave = async () => {
    const ok = await save();
    if (ok) toast.success("Exam saved");
    else toast.error("Save failed — your changes are still on screen. Try again.");
  };

  const onPreview = async () => {
    if (status !== "saved") {
      const ok = await save();
      if (!ok) {
        toast.error("Save failed — the preview uses the saved exam, so fix the save error first.");
        return;
      }
    }
    navigate(`/exams/${id}/preview`);
  };

  const flagged = exam.sections.reduce((a, s) => a + s.questions.filter((q) => q.flags?.length).length, 0);
  const totalQ = exam.sections.reduce((a, s) => a + s.questions.length, 0);

  return (
    <div>
      <SaveBar status={status} lastSavedAt={lastSavedAt} autosave={autosave} error={error} onSave={() => void onSave()} onDiscard={discard}>
        <Button size="sm" variant="outline" asChild>
          <a href={href(`/tos?fromExam=${id}`)}>
            <FileSpreadsheet className="size-4" /> Create TOS
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => void onPreview()}>
          <Eye className="size-4" /> Preview & export
        </Button>
      </SaveBar>

      <PageHeader
        eyebrow="Exam Builder"
        title={examDisplayTitle(exam)}
        badges={
          <>
            {exam.isDemo && <DemoBadge />}
            <SourceBadge source={exam.source === "ai" ? "ai" : exam.source === "import" ? "import" : "manual"} />
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">Revision {exam.revision}</span>
            <AiStatusBadge />
          </>
        }
        description={
          <span className="inline-flex items-start gap-1.5">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
            Answer keys and scoring rubrics are kept separate from the student-facing exam: they are printed only in the “Answer key & rubrics” document.
          </span>
        }
      />

      <ExamSummaryBar exam={exam} />

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white p-1 shadow-sm ring-1 ring-slate-200">
          <TabsTrigger value="details" className="data-[state=active]:bg-[#1b2466] data-[state=active]:text-white">
            <Settings2 className="size-4" /> Exam details
          </TabsTrigger>
          <TabsTrigger value="questions" className="data-[state=active]:bg-[#1b2466] data-[state=active]:text-white">
            <ListChecks className="size-4" /> Sections & questions
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-700">{totalQ}</span>
            {flagged > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-amber-950">{flagged} flagged</span>}
          </TabsTrigger>
          <TabsTrigger value="generate" className="data-[state=active]:bg-[#1b2466] data-[state=active]:text-white">
            <Sparkles className="size-4" /> Generate with AI
          </TabsTrigger>
          <TabsTrigger value="import" className="data-[state=active]:bg-[#1b2466] data-[state=active]:text-white">
            <FileUp className="size-4" /> Import exam
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <ExamDetailsPanel exam={exam} setExam={setExam} data={data} />
        </TabsContent>

        <TabsContent value="questions" className="mt-4 space-y-4">
          <ExamRegeneratePanel exam={exam} setExam={setExam} data={data} selected={selected} setSelected={setSelected} runRequest={regenRequest} />
          <SectionsEditor
            exam={exam}
            setExam={setExam}
            data={data}
            selected={selected}
            setSelected={setSelected}
            onReplace={(qid) => {
              setSelected([qid]);
              setRegenRequest((n) => n + 1);
            }}
          />
        </TabsContent>

        <TabsContent value="generate" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ExamGeneratePanel exam={exam} setExam={setExam} data={data} onDone={() => setTab("questions")} />
        </TabsContent>

        <TabsContent value="import" forceMount className="mt-4 data-[state=inactive]:hidden">
          <ExamImportPanel exam={exam} setExam={setExam} data={data} onDone={() => setTab("questions")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
