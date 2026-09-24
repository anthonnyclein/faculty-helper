"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Syllabus } from "@/lib/fah/types";
import { Field, NumberInput, Panel } from "../../../common/ui";
import { href } from "../../../common/router";
import type { SectionProps } from "./types";

const SEMESTERS = ["1st Semester", "2nd Semester", "Summer"];
const CUSTOM = "__custom__";

type TextKey = "collegeName" | "syllabusCode" | "courseCode" | "descriptiveTitle" | "prerequisite" | "corequisite" | "academicYear" | "courseDescription" | "semester";

export function CourseInfoSection({ syllabus, update, data }: SectionProps) {
  // Only show "required" errors after the user has interacted with a field (or it already has content issues).
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [customSemester, setCustomSemester] = useState(() => !!syllabus.semester && !SEMESTERS.includes(syllabus.semester));

  const set = <K extends keyof Syllabus>(k: K, v: Syllabus[K]) => update((s) => ({ ...s, [k]: v }));
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const requiredErr = (k: TextKey, label: string) => (touched[k] && !String(syllabus[k] ?? "").trim() ? `${label} is required.` : null);

  const unitsErr =
    touched.units && (syllabus.units === null || syllabus.units === undefined)
      ? "Number of Units is required."
      : syllabus.units !== null && syllabus.units !== undefined && syllabus.units <= 0
        ? "Number of Units must be greater than 0."
        : null;
  const lecErr = syllabus.lectureHours !== null && syllabus.lectureHours < 0 ? "Lecture hours cannot be negative." : null;
  const labErr = syllabus.labHours !== null && syllabus.labHours < 0 ? "Laboratory hours cannot be negative." : null;
  const ayErr =
    syllabus.academicYear && !/^\d{4}\s*[-–]\s*\d{4}$/.test(syllabus.academicYear.trim())
      ? "Academic Year should look like 2025-2026."
      : requiredErr("academicYear", "Academic Year");

  const text = (k: TextKey, label: string, opts: { placeholder?: string; required?: boolean; hint?: string; className?: string; mono?: boolean } = {}) => {
    const id = `course-${k}`;
    const err = opts.required ? requiredErr(k, label) : null;
    return (
      <Field label={label} required={opts.required} htmlFor={id} error={err} hint={opts.hint} className={opts.className}>
        <Input
          id={id}
          value={String(syllabus[k] ?? "")}
          placeholder={opts.placeholder}
          aria-invalid={!!err || undefined}
          className={opts.mono ? "font-mono text-sm" : undefined}
          onChange={(e) => set(k, e.target.value)}
          onBlur={() => touch(k)}
        />
      </Field>
    );
  };

  const semesterSelectValue = customSemester ? CUSTOM : SEMESTERS.includes(syllabus.semester) ? syllabus.semester : undefined;

  return (
    <div className="space-y-6">
      <Panel title="Identification" description="Printed in the page header and the course information table.">
        <div className="grid gap-4 md:grid-cols-2">
          {text("collegeName", "College Name", { required: true, placeholder: "College of Education and Social Sciences", className: "md:col-span-2" })}
          {text("syllabusCode", "Syllabus Code", {
            required: true,
            placeholder: "MSUN-CESS-SYL-ELE126-2026-REV00",
            hint: "Printed in small italics at the top of every page.",
            mono: true,
          })}
          {text("courseCode", "Course Code", { required: true, placeholder: "e.g. IT 126" })}
          {text("descriptiveTitle", "Descriptive Title", { required: true, placeholder: "e.g. Web Systems and Technologies", className: "md:col-span-2" })}
          {text("prerequisite", "Pre-requisite", { placeholder: "e.g. IT 112 or None" })}
          {text("corequisite", "Co-requisite", { placeholder: "e.g. None" })}
        </div>
      </Panel>

      <Panel title="Units, hours and term">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Number of Units" required htmlFor="course-units" error={unitsErr}>
            <NumberInput id="course-units" value={syllabus.units} min={0} step={0.5} placeholder="3" invalid={!!unitsErr} onChange={(v) => { touch("units"); set("units", v); }} />
          </Field>
          <Field label="Lecture Hours" htmlFor="course-lec" error={lecErr} hint="Per week">
            <NumberInput id="course-lec" value={syllabus.lectureHours} min={0} step={0.5} placeholder="2" invalid={!!lecErr} onChange={(v) => set("lectureHours", v)} />
          </Field>
          <Field label="Laboratory Hours" htmlFor="course-lab" error={labErr} hint="Per week">
            <NumberInput id="course-lab" value={syllabus.labHours} min={0} step={0.5} placeholder="3" invalid={!!labErr} onChange={(v) => set("labHours", v)} />
          </Field>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Lecture and laboratory hours are stored separately. The reference template prints only “No. of Units”; hours are{" "}
            <strong>{data.settings.showHoursInUnits ? "currently appended to the units cell" : "currently not printed"}</strong>. Change this in{" "}
            <a href={href("/settings")} className="font-medium underline underline-offset-2">
              Templates & Settings
            </a>
            .
          </span>
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Semester" required htmlFor="course-semester" error={requiredErr("semester", "Semester")}>
            <div className="flex flex-col gap-2">
              <Select
                value={semesterSelectValue}
                onValueChange={(v) => {
                  touch("semester");
                  if (v === CUSTOM) {
                    setCustomSemester(true);
                    if (SEMESTERS.includes(syllabus.semester)) set("semester", "");
                  } else {
                    setCustomSemester(false);
                    set("semester", v);
                  }
                }}
              >
                <SelectTrigger id="course-semester" className="w-full bg-white">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Other (type it)…</SelectItem>
                </SelectContent>
              </Select>
              {customSemester && (
                <Input
                  aria-label="Custom semester"
                  value={syllabus.semester}
                  placeholder="e.g. Midyear Term"
                  onChange={(e) => set("semester", e.target.value)}
                  onBlur={() => touch("semester")}
                />
              )}
            </div>
          </Field>
          <Field label="Academic Year" required htmlFor="course-academicYear" error={ayErr} hint="Format: 2025-2026">
            <Input
              id="course-academicYear"
              value={syllabus.academicYear}
              placeholder="2025-2026"
              inputMode="numeric"
              aria-invalid={!!ayErr || undefined}
              onChange={(e) => set("academicYear", e.target.value)}
              onBlur={() => touch("academicYear")}
            />
          </Field>
        </div>
      </Panel>

      <Panel title="Course Description">
        <Field
          label="Course Description"
          required
          htmlFor="course-courseDescription"
          error={requiredErr("courseDescription", "Course Description")}
          hint={`${syllabus.courseDescription.trim().split(/\s+/).filter(Boolean).length} words`}
        >
          <Textarea
            id="course-courseDescription"
            rows={7}
            value={syllabus.courseDescription}
            placeholder="Describe the scope, focus and intended competencies of the course, as approved in the curriculum."
            onChange={(e) => set("courseDescription", e.target.value)}
            onBlur={() => touch("courseDescription")}
            className="leading-relaxed"
          />
        </Field>
      </Panel>
    </div>
  );
}
