"use client";

import { AlertTriangle, ExternalLink, FileText, Info, ShieldCheck } from "lucide-react";
import { files } from "@/assets/files";
import { TEMPLATE_DISCREPANCIES, TEMPLATE_SOURCE } from "@/lib/fah/template";
import { Panel, ScrollTable } from "../../common/ui";

export function ReferenceTemplatesTab() {
  const refs = [
    {
      title: "Syllabus Template",
      file: TEMPLATE_SOURCE.syllabus.file,
      url: files.syllabusTemplatePdf?.url,
      page: TEMPLATE_SOURCE.syllabus.pageSize.label,
      fonts: Object.entries(TEMPLATE_SOURCE.syllabus.fonts),
      used: "Course syllabus editor, preview and PDF export",
    },
    {
      title: "Horizontal TOS Template",
      file: TEMPLATE_SOURCE.tos.files[0],
      url: files.horizontalTosTemplatePdf?.url,
      page: TEMPLATE_SOURCE.tos.pageSize.label,
      fonts: Object.entries(TEMPLATE_SOURCE.tos.fonts),
      used: "TOS export with placement numbers running across each objective row",
    },
    {
      title: "Vertical TOS Template",
      file: TEMPLATE_SOURCE.tos.files[1],
      url: files.verticalTosTemplatePdf?.url,
      page: TEMPLATE_SOURCE.tos.pageSize.label,
      fonts: Object.entries(TEMPLATE_SOURCE.tos.fonts),
      used: "TOS export with placement numbers running down each cognitive-level column",
    },
  ];
  const fontLabel: Record<string, string> = {
    body: "Body",
    courseInfo: "Course information",
    collegeName: "College name",
    syllabusCode: "Syllabus code",
    title: "Title",
    code: "Document code",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <p>
          <strong>Exports are built to follow these reference files, but they must be checked against them before official use.</strong> Fonts, page breaks and spacing
          can differ between devices, and the differences listed below were resolved as described.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {refs.map((r) => (
          <Panel key={r.title} title={r.title}>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <FileText className="size-4 text-[#1b2466]" /> {r.file}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="font-semibold text-slate-700">Page</dt>
                <dd>{r.page}</dd>
                {r.fonts.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-semibold text-slate-700">{fontLabel[k] ?? k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
                <dt className="font-semibold text-slate-700">Used for</dt>
                <dd>{r.used}</dd>
              </dl>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1b2466] hover:underline">
                  Open reference PDF <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-xs text-red-600">Reference file link not available.</p>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Institutional header and footer" description="Transcribed from the syllabus reference and placed on every exported syllabus page.">
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="rounded-xl border border-slate-200 bg-white p-3">
            <img src={files.syllabusHeader.url} alt="Institutional header: MSU at Naawan logo and university name" className="w-full object-contain" />
            <figcaption className="mt-2 text-xs text-slate-500">Header</figcaption>
          </figure>
          <figure className="rounded-xl border border-slate-200 bg-white p-3">
            <img src={files.syllabusFooter.url} alt="Institutional footer: address, contact details and motto" className="w-full object-contain" />
            <figcaption className="mt-2 text-xs text-slate-500">Footer</figcaption>
          </figure>
        </div>
      </Panel>

      <Panel title="What was transcribed" description="Institutional wording is copied verbatim from the syllabus reference into the institutional configuration.">
        <ul className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          {[
            "University vision, mission, goals and core values",
            "Program Educational Objectives (PEO 1–4) and their introduction",
            "Program Outcome category titles and introductions",
            "Category 1, 4 and 5 outcomes with their printed PEO mappings",
            "Category 2 and 3 outcomes (seeded into the IT Program Outcomes library)",
            "Default requirements and class policies (items a–h) and Grading System",
            "Grading components, passing rate and dimension-of-evaluation example",
            "Criteria for grading, transmutation table and final-grade statement",
            "Circulating materials, students with disabilities, attendance and GAD themes",
            "Schedule note and the Learning Commitment Agreement",
            "TOS cognitive levels and lower/higher-order grouping",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" /> {t}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Differences between the references and the requirements" description="Each difference and how the app resolves it.">
        <ScrollTable minWidth={760}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Area</th>
                <th className="px-3 py-2.5 font-semibold">Difference</th>
                <th className="px-3 py-2.5 font-semibold">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TEMPLATE_DISCREPANCIES.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-3 py-3 align-top font-semibold text-[#1b2466]">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-amber-600" /> {d.area}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-600">{d.detail}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{d.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </Panel>

      <Panel title="Institutional templates vs. instructional resources">
        <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-[#fbfaf6] p-4">
            <p className="mb-1 font-semibold text-[#1b2466]">Institutional templates</p>
            <p>Define the required wording, structure and format of official documents (the three references above). They control layout and prescribed text — they are never used as course content.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-[#fbfaf6] p-4">
            <p className="mb-1 font-semibold text-[#1b2466]">Instructional resources</p>
            <p>
              Books, notes, articles and websites in the Resource Library. Their extracted text feeds course content (learning plans, exam questions) and references.
            </p>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <Info className="mt-0.5 size-3.5 shrink-0" /> The prescribed wording can be edited in the Institutional configuration tab after unlocking it.
        </p>
      </Panel>
    </div>
  );
}
