"use client";

import { Fragment, type ReactNode } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { splitOrdinal } from "@/lib/fah/calc";
import { Panel } from "../../../common/ui";
import { href } from "../../../common/router";
import type { SectionProps } from "./types";

type Tok = "courseCode" | "semester" | "academicYear";

function Missing({ label }: { label: string }) {
  return <span className="rounded bg-amber-100 px-1 font-sans text-xs font-semibold not-italic text-amber-900">[{label} missing]</span>;
}

function Semester({ value }: { value: string }) {
  const o = splitOrdinal(value);
  if (!o) return <>{value}</>;
  return (
    <>
      {o.before}
      <sup>{o.sup}</sup>
      {o.after}
    </>
  );
}

/**
 * Learning Commitment Agreement exactly as configured institutionally; only the tokens
 * {courseCode}, {semester} and {academicYear} are replaced. As in the template, the course code and
 * the run "{semester}, AY {academicYear}." are bold and the semester ordinal is superscript.
 */
export function AgreementSection({ syllabus, data }: SectionProps) {
  const text = data.institutional.learningCommitmentAgreement ?? "";
  const values: Record<Tok, string> = {
    courseCode: syllabus.courseCode.trim(),
    semester: syllabus.semester.trim(),
    academicYear: syllabus.academicYear.trim(),
  };
  const labels: Record<Tok, string> = { courseCode: "Course code", semester: "Semester", academicYear: "Academic year" };
  const used = (Object.keys(values) as Tok[]).filter((k) => text.includes(`{${k}}`));
  const missing = used.filter((k) => !values[k]);

  const renderTok = (k: Tok, key: string): ReactNode => {
    if (!values[k]) return <Missing key={key} label={labels[k]} />;
    return k === "semester" ? <Semester key={key} value={values[k]} /> : <Fragment key={key}>{values[k]}</Fragment>;
  };

  /** Renders a plain string containing tokens (no bolding decisions). */
  const renderPlain = (s: string, keyBase: string): ReactNode[] =>
    s.split(/(\{courseCode\}|\{semester\}|\{academicYear\})/g).map((part, i) => {
      const m = part.match(/^\{(courseCode|semester|academicYear)\}$/);
      return m ? renderTok(m[1] as Tok, `${keyBase}-${i}`) : <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>;
    });

  // Bold runs: "{courseCode}" and "{semester} … {academicYear}." (template formatting).
  const nodes: ReactNode[] = [];
  const re = /\{semester\}[^{}]*?\{academicYear\}\.?|\{courseCode\}|\{semester\}|\{academicYear\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={`t${n++}`}>{text.slice(last, m.index)}</Fragment>);
    nodes.push(<strong key={`b${n++}`}>{renderPlain(m[0], `b${n}`)}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={`t${n++}`}>{text.slice(last)}</Fragment>);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <span>
          Institutional wording — read-only. Only the course code, semester and academic year are filled in from Course information. The statement itself is
          maintained in{" "}
          <a href={href("/settings")} className="font-medium underline underline-offset-2">
            Templates &amp; Settings
          </a>
          .
        </span>
      </p>

      {missing.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Missing in Course information: <strong>{missing.map((k) => labels[k]).join(", ")}</strong>. The printed agreement will contain blanks until these are
            entered.
          </span>
        </div>
      )}

      <Panel className="bg-[#fffef9]">
        <div className="mx-auto max-w-5xl py-2 font-serif text-[15px] leading-relaxed text-slate-900" style={{ fontFamily: '"Book Antiqua", Palatino, "Palatino Linotype", serif' }}>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide">Learning Commitment Agreement</h3>
          <p className="text-justify">{nodes}</p>
          <div className="mt-12 flex justify-end">
            <div className="w-72 space-y-10 text-center text-sm">
              <div>
                <div className="border-b border-slate-800" aria-hidden />
                <p className="mt-1">Printed name and signature</p>
              </div>
              <div>
                <div className="border-b border-slate-800" aria-hidden />
                <p className="mt-1">Date</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
