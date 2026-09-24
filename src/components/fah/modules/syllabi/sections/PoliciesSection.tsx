"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Lock, Plus, RotateCcw, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dimensionIssues, dimensionTotals, gradingIssues, gradingTotal } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";
import type { DimensionRow, GradingRow, PolicyItem, Syllabus } from "@/lib/fah/types";
import { ConfirmDialog, DeleteIconButton, IssueList, NumberInput, Panel, ReorderButtons, ScrollTable } from "../../../common/ui";
import { href } from "../../../common/router";
import { moveItem } from "../../../common/utils";
import type { SectionProps } from "./types";

function letter(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function ResetButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-slate-600" onClick={onClick} aria-label={`Reset ${label} to template wording`}>
      <RotateCcw className="size-3.5" /> Reset to template wording
    </Button>
  );
}

function SubHeading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-display text-base font-semibold text-[#1b2466]">{children}</h3>
      {actions && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
    </div>
  );
}

const pctText = (v: number) => `${v}%`;

export function PoliciesSection({ syllabus, update, data }: SectionProps) {
  const inst = data.institutional;
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => void } | null>(null);

  const ask = (title: string, run: () => void) =>
    setConfirm({ title: `Reset ${title}?`, description: `Your wording for “${title}” will be replaced with the institutional template wording. You can still undo by discarding unsaved changes.`, run });

  const setReq = (fn: (l: PolicyItem[]) => PolicyItem[]) => update((s) => ({ ...s, requirements: fn(s.requirements) }));
  const setPol = (fn: (l: PolicyItem[]) => PolicyItem[]) => update((s) => ({ ...s, classPolicies: fn(s.classPolicies) }));
  const setGrading = (patch: Partial<Syllabus["grading"]>) => update((s) => ({ ...s, grading: { ...s.grading, ...patch } }));
  const setGradeRows = (fn: (l: GradingRow[]) => GradingRow[]) => update((s) => ({ ...s, grading: { ...s.grading, rows: fn(s.grading.rows) } }));
  const setDim = (fn: (l: DimensionRow[]) => DimensionRow[]) => update((s) => ({ ...s, dimensionEvaluation: fn(s.dimensionEvaluation) }));
  const setPS = (patch: Partial<Syllabus["policySections"]>) => update((s) => ({ ...s, policySections: { ...s.policySections, ...patch } }));

  const gIssues = gradingIssues(syllabus.grading.rows);
  const gTotal = gradingTotal(syllabus.grading.rows);
  const dTotals = dimensionTotals(syllabus.dimensionEvaluation);
  const dIssues = dimensionIssues(syllabus.dimensionEvaluation);
  const gradingCount = syllabus.classPolicies.filter((p) => p.kind === "grading").length;

  const resetRequirements = () => setReq(() => inst.defaultRequirements.map((text) => ({ id: uid("req"), kind: "text" as const, text })));
  const resetPolicies = () =>
    setPol((l) => {
      const grading = l.find((p) => p.kind === "grading") ?? { id: uid("pol"), kind: "grading" as const, text: "Grading System:" };
      return [...inst.defaultClassPolicies.map((text) => ({ id: uid("pol"), kind: "text" as const, text })), { ...grading, text: "Grading System:" }];
    });
  const resetGrading = () =>
    setGrading({ rows: inst.defaultGrading.map((g) => ({ id: uid("gr"), component: g.component, weight: g.weight })), passingRate: inst.defaultPassingRate });
  const resetDim = () => setDim(() => inst.defaultDimensionEvaluation.map((d) => ({ id: uid("dim"), ...d })));

  const addGradingItem = () => {
    setPol((l) => [...l, { id: uid("pol"), kind: "grading", text: "Grading System:" }]);
    toast.success("Grading System item restored");
  };

  const gradingBlock = (item: PolicyItem) => (
    <div className="space-y-3 rounded-xl border border-[#1b2466]/15 bg-[#1b2466]/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="size-4 text-[#1b2466]" />
        <label htmlFor={`gs-${item.id}`} className="sr-only">
          Grading System label
        </label>
        <Input id={`gs-${item.id}`} value={item.text} onChange={(e) => setPol((l) => l.map((p) => (p.id === item.id ? { ...p, text: e.target.value } : p)))} className="h-8 max-w-xs bg-white font-medium" />
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Lock className="size-3" /> Required item — can be reordered, not deleted
        </span>
        <div className="ml-auto">
          <ResetButton label="grading system" onClick={() => ask("the grading system", resetGrading)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-2 py-2" />
              <th className="px-2 py-2">Component</th>
              <th className="w-36 px-2 py-2">Weight (%)</th>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {syllabus.grading.rows.map((r, i) => {
              const badW = r.weight === null || r.weight === undefined || Number.isNaN(r.weight) || r.weight < 0 || r.weight > 100;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-1 py-1">
                    <ReorderButtons index={i} count={syllabus.grading.rows.length} label={r.component || `component ${i + 1}`} onMove={(a, b) => setGradeRows((l) => moveItem(l, a, b))} />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      aria-label={`Grading component ${i + 1}`}
                      value={r.component}
                      aria-invalid={!r.component.trim() || undefined}
                      onChange={(e) => setGradeRows((l) => l.map((x) => (x.id === r.id ? { ...x, component: e.target.value } : x)))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumberInput
                      ariaLabel={`Weight of ${r.component || `component ${i + 1}`} in percent`}
                      value={r.weight}
                      min={0}
                      max={100}
                      invalid={badW}
                      onChange={(v) => setGradeRows((l) => l.map((x) => (x.id === r.id ? { ...x, weight: v } : x)))}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <DeleteIconButton label={`Remove ${r.component || "component"}`} onClick={() => setGradeRows((l) => l.filter((x) => x.id !== r.id))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td />
              <td className="px-2 py-2">Total</td>
              <td className={cn("px-2 py-2", Math.abs(gTotal - 100) > 0.001 ? "text-red-700" : "text-emerald-700")}>{pctText(gTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setGradeRows((l) => [...l, { id: uid("gr"), component: "", weight: null }])}>
          <Plus className="size-4" /> Add component
        </Button>
        <div className="min-w-60 flex-1">
          <label htmlFor="passing-rate" className="mb-1 block text-xs font-medium text-slate-600">
            Passing rate (printed text)
          </label>
          <Input id="passing-rate" value={syllabus.grading.passingRate} onChange={(e) => setGrading({ passingRate: e.target.value })} className="bg-white" />
        </div>
      </div>
      <IssueList issues={gIssues} />
    </div>
  );

  const textList = (
    items: PolicyItem[],
    setter: (fn: (l: PolicyItem[]) => PolicyItem[]) => void,
    marker: (i: number) => string,
    kindLabel: string,
    prefix: string
  ) => (
    <ol className="space-y-2">
      {items.map((p, i) => (
        <li key={p.id} className="flex items-start gap-2">
          <ReorderButtons index={i} count={items.length} label={`${kindLabel} ${marker(i)}`} onMove={(a, b) => setter((l) => moveItem(l, a, b))} />
          <span className="mt-2 w-7 shrink-0 text-right text-sm font-semibold text-slate-600">{marker(i)}</span>
          <div className="min-w-0 flex-1">
            {p.kind === "grading" ? (
              gradingBlock(p)
            ) : (
              <Textarea
                aria-label={`${kindLabel} ${marker(i)}`}
                value={p.text}
                rows={1}
                className={cn("min-h-9 bg-white", !p.text.trim() && "border-amber-400 bg-amber-50/40")}
                onChange={(e) => setter((l) => l.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))}
              />
            )}
          </div>
          {p.kind !== "grading" ? <DeleteIconButton label={`Delete ${kindLabel} ${marker(i)}`} onClick={() => setter((l) => l.filter((x) => x.id !== p.id))} /> : <span className="w-8" />}
        </li>
      ))}
      <li>
        <Button type="button" variant="outline" size="sm" className="ml-9" onClick={() => setter((l) => [...l, { id: uid(prefix), kind: "text", text: "" }])}>
          <Plus className="size-4" /> Add {kindLabel}
        </Button>
      </li>
    </ol>
  );

  const gad = syllabus.policySections.gadThemes;

  return (
    <div className="space-y-6">
      <Panel title="Course Management and Class Policies">
        <div className="space-y-6">
          <div>
            <SubHeading actions={<ResetButton label="requirements" onClick={() => ask("Requirements", resetRequirements)} />}>Requirements</SubHeading>
            {textList(syllabus.requirements, setReq, (i) => `${i + 1}.`, "requirement", "req")}
          </div>
          <div>
            <SubHeading actions={<ResetButton label="class policies" onClick={() => ask("Class Policies", resetPolicies)} />}>Class Policies</SubHeading>
            <p className="mb-3 text-xs text-slate-500">Printed as lettered items under “Class Policies”. The template places “Grading System” last (item i.).</p>
            {gradingCount === 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                The Grading System item is missing.
                <Button size="sm" variant="outline" className="bg-white" onClick={addGradingItem}>
                  Restore Grading System item
                </Button>
              </div>
            )}
            {textList(syllabus.classPolicies, setPol, (i) => `${letter(i)}.`, "class policy", "pol")}
          </div>
        </div>
      </Panel>

      <Panel title="Other policy sections" description="Printed after the class policies, in this order.">
        <div className="space-y-5">
          {(
            [
              ["circulatingMaterials", "Circulating or Selling Class Materials", inst.circulatingMaterials],
              ["swdStatement", "Accommodation for Students with Disabilities (SWD)", inst.swdStatement],
              ["attendanceStatement", "Attendance and Absences", inst.attendanceStatement],
            ] as const
          ).map(([k, title, def]) => (
            <div key={k}>
              <SubHeading actions={<ResetButton label={title} onClick={() => ask(title, () => setPS({ [k]: def } as Partial<Syllabus["policySections"]>))} />}>
                <label htmlFor={`ps-${k}`}>{title}</label>
              </SubHeading>
              <Textarea id={`ps-${k}`} value={syllabus.policySections[k]} onChange={(e) => setPS({ [k]: e.target.value } as Partial<Syllabus["policySections"]>)} className="bg-white" />
            </div>
          ))}
          <div>
            <SubHeading actions={<ResetButton label="GAD Themes" onClick={() => ask("GAD Themes", () => setPS({ gadThemes: [...inst.gadThemes] }))} />}>GAD Themes</SubHeading>
            <ul className="space-y-1.5">
              {gad.map((t, i) => (
                <li key={`gad-${i}`} className="flex items-center gap-2">
                  <ReorderButtons index={i} count={gad.length} label={`GAD theme ${i + 1}`} onMove={(a, b) => setPS({ gadThemes: moveItem(gad, a, b) })} />
                  <span aria-hidden className="text-slate-500">
                    ●
                  </span>
                  <Input aria-label={`GAD theme ${i + 1}`} value={t} onChange={(e) => setPS({ gadThemes: gad.map((x, j) => (j === i ? e.target.value : x)) })} className="bg-white" />
                  <DeleteIconButton label={`Remove GAD theme ${i + 1}`} onClick={() => setPS({ gadThemes: gad.filter((_, j) => j !== i) })} />
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPS({ gadThemes: [...gad, ""] })}>
              <Plus className="size-4" /> Add theme
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Dimension Evaluation"
        description={`Subtitle printed: “${inst.dimensionEvaluationSubtitle || "Example"}”. Percentages per cognitive learning domain; each column should total 100%.`}
        actions={<ResetButton label="dimension evaluation" onClick={() => ask("Dimension Evaluation", resetDim)} />}
      >
        <ScrollTable minWidth={640}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2" />
                <th className="px-2 py-2">Cognitive Learning Domain</th>
                <th className="w-28 px-2 py-2">Prelim</th>
                <th className="w-28 px-2 py-2">Midterm</th>
                <th className="w-28 px-2 py-2">Finals</th>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {syllabus.dimensionEvaluation.map((r, i) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-1 py-1">
                    <ReorderButtons index={i} count={syllabus.dimensionEvaluation.length} label={r.level || `row ${i + 1}`} onMove={(a, b) => setDim((l) => moveItem(l, a, b))} />
                  </td>
                  <td className="px-2 py-1">
                    <Input aria-label={`Domain name, row ${i + 1}`} value={r.level} onChange={(e) => setDim((l) => l.map((x) => (x.id === r.id ? { ...x, level: e.target.value } : x)))} />
                  </td>
                  {(["prelim", "midterm", "finals"] as const).map((k) => (
                    <td key={k} className="px-2 py-1">
                      <NumberInput
                        ariaLabel={`${r.level || `Row ${i + 1}`} ${k} percent`}
                        value={r[k]}
                        min={0}
                        max={100}
                        placeholder="—"
                        invalid={r[k] !== null && (r[k]! < 0 || r[k]! > 100)}
                        onChange={(v) => setDim((l) => l.map((x) => (x.id === r.id ? { ...x, [k]: v } : x)))}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <DeleteIconButton label={`Remove ${r.level || "row"}`} onClick={() => setDim((l) => l.filter((x) => x.id !== r.id))} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                <td />
                <td className="px-2 py-2">Total</td>
                {(["prelim", "midterm", "finals"] as const).map((k) => (
                  <td key={k} className={cn("px-3 py-2", Math.abs(dTotals[k] - 100) > 0.001 ? "text-red-700" : "text-emerald-700")}>
                    {pctText(dTotals[k])}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </ScrollTable>
        <div className="mt-3 flex flex-col gap-3">
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setDim((l) => [...l, { id: uid("dim"), level: "", prelim: null, midterm: null, finals: null }])}>
            <Plus className="size-4" /> Add domain
          </Button>
          <IssueList issues={dIssues} />
        </div>
      </Panel>

      <Panel
        title="Final grade, criteria and transmutation"
        description={
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Institutional — edited in{" "}
            <a href={href("/settings")} className="font-medium text-[#1b2466] underline underline-offset-2">
              Templates &amp; Settings
            </a>
            .
          </span>
        }
      >
        <p className="mb-4 text-sm font-semibold text-slate-800">{inst.finalGradeStatement}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Criteria for Grading</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {inst.criteriaForGrading.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Transmutation Table</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 font-semibold">Final Grade</th>
                  <th className="py-1 font-semibold">Total Percentage Score Range</th>
                </tr>
              </thead>
              <tbody>
                {inst.transmutation.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-1 font-semibold">{t.grade}</td>
                    <td className="py-1 font-semibold">{t.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel="Reset"
        destructive
        onConfirm={() => {
          console.log("[policies] reset", confirm?.title);
          confirm?.run();
          setConfirm(null);
        }}
      />
    </div>
  );
}
