"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, FileText, KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStoreState } from "@/lib/fah/store";
import { examIssues, examTotals } from "@/lib/fah/calc";
import { buildExamDocument, examFileBase, EXAM_PAPERS, type ExamPaper } from "@/lib/fah/documents/exam";
import type { Exam } from "@/lib/fah/types";
import { cn } from "@/lib/utils";
import { PaginatedDocument } from "../../documents/PaginatedDocument";
import { DemoBadge, EmptyState, IssueList, LoadingBlock, PageHeader } from "../../common/ui";
import { navigate } from "../../common/router";
import { examDisplayTitle } from "./shared";

type DocKind = "student" | "key";

export function ExamPreview({ id }: { id: string }) {
  const { data, ready } = useStoreState();
  const exam = data.exams.find((e) => e.id === id) as Exam | undefined;
  const [kind, setKind] = useState<DocKind>("student");
  const [paper, setPaper] = useState<ExamPaper>("a4");

  const doc = useMemo(() => (exam ? buildExamDocument(exam, data, { kind, paper, includeAnswerKey: false }) : null), [exam, data, kind, paper]);

  if (!ready) return <LoadingBlock />;
  if (!exam || !doc)
    return (
      <EmptyState
        icon={<ClipboardList className="size-6" />}
        title="Exam not found"
        description="It may have been deleted."
        action={<Button onClick={() => navigate("/exams")}>Back to exams</Button>}
      />
    );

  const t = examTotals(exam);
  const issues = examIssues(exam);
  const base = examFileBase(exam);
  const title = kind === "student" ? `${examDisplayTitle(exam)} — Student copy` : `${examDisplayTitle(exam)} — Answer key & rubrics`;

  return (
    <div>
      <PageHeader
        eyebrow="Exam preview & export"
        title={examDisplayTitle(exam)}
        badges={
          <>
            {exam.isDemo && <DemoBadge />}
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
              {t.items} items · {t.points} points · revision {exam.revision}
            </span>
          </>
        }
        description="The preview shows the saved exam. The student copy never includes answer keys or rubrics; those are printed only in the separate faculty document."
        actions={
          <Button variant="outline" onClick={() => navigate(`/exams/${id}`)}>
            <ArrowLeft className="size-4" /> Back to editor
          </Button>
        }
      />

      {issues.length > 0 && <IssueList tone="warning" title="Check before printing" issues={issues.slice(0, 8).concat(issues.length > 8 ? [`…and ${issues.length - 8} more`] : [])} />}

      <div className="my-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Document" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(
            [
              ["student", "Student exam", <FileText key="i" className="size-4" />],
              ["key", "Answer key & rubrics", <KeyRound key="i" className="size-4" />],
            ] as const
          ).map(([k, label, icon]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                kind === k ? (k === "key" ? "bg-red-700 text-white" : "bg-[#1b2466] text-white") : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {icon} {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Paper
          <Select value={paper} onValueChange={(v) => setPaper(v as ExamPaper)}>
            <SelectTrigger aria-label="Paper size" className="h-9 w-56 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXAM_PAPERS) as ExamPaper[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EXAM_PAPERS[k].label} ({EXAM_PAPERS[k].w} × {EXAM_PAPERS[k].h} in)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <PaginatedDocument
        spec={doc.spec}
        blocks={doc.blocks}
        title={title}
        fileName={`${base}${kind === "key" ? "_ANSWER_KEY" : ""}.pdf`}
        notice={
          kind === "key" ? (
            <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
              <Lock className="size-4" /> ANSWER KEY — FOR FACULTY USE ONLY. Do not distribute this document to students.
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <Lock className="size-4" /> Student copy — answer keys and rubrics are excluded.
            </p>
          )
        }
      />
    </div>
  );
}
