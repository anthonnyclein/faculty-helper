"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Lock, LockOpen, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { store, useAppData } from "@/lib/fah/store";
import { DEFAULT_INSTITUTIONAL } from "@/lib/fah/template";
import { deepClone, uid } from "@/lib/fah/ids";
import type { InstitutionalConfig, InstitutionalPO, POCategory } from "@/lib/fah/types";
import { ChipSelect, ConfirmDialog, DeleteIconButton, Field, NumberInput, Panel, ReorderButtons } from "../../common/ui";
import { moveItem } from "../../common/utils";

function StringList({
  label,
  items,
  onChange,
  rows = 2,
  addLabel = "Add item",
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  rows?: number;
  addLabel?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-1">
          <ReorderButtons index={i} count={items.length} label={`${label} ${i + 1}`} onMove={(a, b) => onChange(moveItem(items, a, b))} />
          <Textarea aria-label={`${label} ${i + 1}`} rows={rows} value={t} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <DeleteIconButton label={`Remove ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
        <Plus className="size-4" /> {addLabel}
      </Button>
    </fieldset>
  );
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-display text-base font-semibold text-[#1b2466]">{title}</h3>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function InstitutionalTab() {
  const data = useAppData();
  const unlocked = data.settings.institutionalUnlocked;
  const [draft, setDraft] = useState<InstitutionalConfig>(() => deepClone(data.institutional));
  const [dirty, setDirty] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(deepClone(data.institutional));
  }, [data.institutional, dirty]);

  const up = (patch: Partial<InstitutionalConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const peoOptions = draft.peos.map((p) => ({ value: p.code, label: p.code, title: p.description }));

  const save = () => {
    if (draft.peos.some((p) => !p.code.trim())) {
      toast.error("Every PEO needs a code.");
      return;
    }
    if (!draft.tosCognitiveLevels.filter((l) => l.trim()).length) {
      toast.error("Add at least one TOS cognitive level.");
      return;
    }
    const cleaned: InstitutionalConfig = {
      ...draft,
      tosCognitiveLevels: draft.tosCognitiveLevels.map((l) => l.trim()).filter(Boolean),
      tosLowerOrderCount: Math.max(0, Math.min(draft.tosLowerOrderCount ?? 0, draft.tosCognitiveLevels.length)),
    };
    store.setInstitutional(cleaned);
    setDirty(false);
    console.log("[settings] institutional configuration saved");
    toast.success("Institutional configuration saved. Existing syllabi keep their copies until updated from the syllabus editor.");
  };

  const catList = (key: "category1" | "category4" | "category5", cat: POCategory) => {
    const list = draft[key];
    const set = (v: InstitutionalPO[]) => up({ [key]: v } as Partial<InstitutionalConfig>);
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">
          Category {cat}: {draft.poCategoryTitles[cat]}
        </p>
        {list.map((po, i) => (
          <div key={po.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start gap-1">
              <ReorderButtons index={i} count={list.length} label={`outcome ${i + 1}`} onMove={(a, b) => set(moveItem(list, a, b))} />
              <div className="flex-1 space-y-2">
                <Textarea aria-label={`Category ${cat} outcome ${i + 1}`} rows={2} value={po.description} onChange={(e) => set(list.map((x) => (x.id === po.id ? { ...x, description: e.target.value } : x)))} />
                <ChipSelect ariaLabel={`PEO mapping for category ${cat} outcome ${i + 1}`} options={peoOptions} value={po.peos} onChange={(peos) => set(list.map((x) => (x.id === po.id ? { ...x, peos } : x)))} />
              </div>
              <DeleteIconButton label={`Remove category ${cat} outcome ${i + 1}`} onClick={() => set(list.filter((x) => x.id !== po.id))} />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set([...list, { id: uid("ipo"), description: "", peos: [] }])}>
          <Plus className="size-4" /> Add category {cat} outcome
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center ${unlocked ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-700"}`}
      >
        {unlocked ? <LockOpen className="size-5 shrink-0" /> : <Lock className="size-5 shrink-0 text-[#1b2466]" />}
        <p className="flex-1 text-sm">
          {unlocked
            ? "Unlocked: you are editing prescribed institutional wording. Changes apply to new syllabi and TOS; existing syllabi keep their copies until updated from the syllabus editor."
            : "Locked. This wording is prescribed by the institutional template. Unlock only if the official template has changed."}
        </p>
        {unlocked ? (
          <Button
            variant="outline"
            onClick={() => {
              store.setSettings({ institutionalUnlocked: false });
              console.log("[settings] institutional locked");
            }}
          >
            <Lock className="size-4" /> Lock
          </Button>
        ) : (
          <Button onClick={() => setConfirmUnlock(true)} className="bg-[#1b2466] hover:bg-[#262f7a]">
            <LockOpen className="size-4" /> Unlock editing
          </Button>
        )}
      </div>

      <Panel
        title="Institutional configuration"
        actions={
          unlocked && (
            <>
              <Button variant="outline" onClick={() => setConfirmRestore(true)}>
                <RotateCcw className="size-4" /> Restore reference template wording
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(deepClone(data.institutional));
                    setDirty(false);
                  }}
                >
                  Discard
                </Button>
              )}
              <Button onClick={save} disabled={!dirty} className="bg-[#1b2466] hover:bg-[#262f7a]">
                <Save className="size-4" /> Save configuration
              </Button>
            </>
          )
        }
      >
        {dirty && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Unsaved changes to the institutional configuration.</p>}
        <fieldset disabled={!unlocked} className="space-y-6 disabled:opacity-80">
          <Section title="Vision, mission, goals and core values">
            <Field label="University name" htmlFor="inst-uni">
              <Input id="inst-uni" value={draft.universityName} onChange={(e) => up({ universityName: e.target.value })} />
            </Field>
            <Field label="Vision" htmlFor="inst-vision">
              <Textarea id="inst-vision" rows={2} value={draft.vision} onChange={(e) => up({ vision: e.target.value })} />
            </Field>
            <Field label="Mission" htmlFor="inst-mission">
              <Textarea id="inst-mission" rows={3} value={draft.mission} onChange={(e) => up({ mission: e.target.value })} />
            </Field>
            <StringList label="Goals" items={draft.goals} onChange={(goals) => up({ goals })} rows={2} addLabel="Add goal" />
            <StringList label="Core values" items={draft.coreValues} onChange={(coreValues) => up({ coreValues })} rows={1} addLabel="Add core value" />
          </Section>

          <Section title="Program Educational Objectives">
            <Field label="PEO introduction" htmlFor="inst-peo-intro">
              <Input id="inst-peo-intro" value={draft.peoIntro} onChange={(e) => up({ peoIntro: e.target.value })} />
            </Field>
            {draft.peos.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                <Input aria-label={`PEO ${i + 1} code`} value={p.code} onChange={(e) => up({ peos: draft.peos.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })} />
                <Textarea aria-label={`PEO ${i + 1} description`} rows={2} value={p.description} onChange={(e) => up({ peos: draft.peos.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                <DeleteIconButton label={`Remove PEO ${i + 1}`} onClick={() => up({ peos: draft.peos.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => up({ peos: [...draft.peos, { code: `PEO ${draft.peos.length + 1}`, description: "" }] })}>
              <Plus className="size-4" /> Add PEO
            </Button>
          </Section>

          <Section title="Program Outcome categories" description="Titles and optional introduction lines printed above each category.">
            {([1, 2, 3, 4, 5] as POCategory[]).map((c) => (
              <div key={c} className="grid gap-2 md:grid-cols-2">
                <Field label={`Category ${c} title`} htmlFor={`inst-cat-t-${c}`}>
                  <Input id={`inst-cat-t-${c}`} value={draft.poCategoryTitles[c]} onChange={(e) => up({ poCategoryTitles: { ...draft.poCategoryTitles, [c]: e.target.value } })} />
                </Field>
                <Field label={`Category ${c} introduction`} htmlFor={`inst-cat-i-${c}`}>
                  <Input
                    id={`inst-cat-i-${c}`}
                    value={draft.poCategoryIntros[c] ?? ""}
                    onChange={(e) => up({ poCategoryIntros: { ...draft.poCategoryIntros, [c]: e.target.value } })}
                  />
                </Field>
              </div>
            ))}
          </Section>

          <Section title="Prescribed outcomes (categories 1, 4 and 5)" description="Copied into every new syllabus with their PEO mappings. Categories 2 and 3 are managed in IT Program Outcomes.">
            {catList("category1", 1)}
            {catList("category4", 4)}
            {catList("category5", 5)}
          </Section>

          <Section title="Requirements and class policies">
            <StringList label="Default requirements" items={draft.defaultRequirements} onChange={(defaultRequirements) => up({ defaultRequirements })} rows={1} addLabel="Add requirement" />
            <StringList label="Default class policies" items={draft.defaultClassPolicies} onChange={(defaultClassPolicies) => up({ defaultClassPolicies })} rows={3} addLabel="Add policy" />
          </Section>

          <Section title="Grading defaults">
            {draft.defaultGrading.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2">
                <Input aria-label={`Grading component ${i + 1}`} value={g.component} onChange={(e) => up({ defaultGrading: draft.defaultGrading.map((x, j) => (j === i ? { ...x, component: e.target.value } : x)) })} />
                <NumberInput ariaLabel={`Grading weight ${i + 1} (%)`} value={g.weight} min={0} max={100} onChange={(v) => up({ defaultGrading: draft.defaultGrading.map((x, j) => (j === i ? { ...x, weight: v ?? 0 } : x)) })} />
                <DeleteIconButton label={`Remove grading component ${i + 1}`} onClick={() => up({ defaultGrading: draft.defaultGrading.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => up({ defaultGrading: [...draft.defaultGrading, { component: "", weight: 0 }] })}>
                <Plus className="size-4" /> Add component
              </Button>
              <span className={`text-xs font-medium ${draft.defaultGrading.reduce((a, g) => a + (g.weight || 0), 0) === 100 ? "text-emerald-700" : "text-red-600"}`}>
                Total: {draft.defaultGrading.reduce((a, g) => a + (g.weight || 0), 0)}% (must be 100%)
              </span>
            </div>
            <Field label="Passing rate statement" htmlFor="inst-pass">
              <Input id="inst-pass" value={draft.defaultPassingRate} onChange={(e) => up({ defaultPassingRate: e.target.value })} />
            </Field>
          </Section>

          <Section title="Dimension of evaluation defaults" description="Percentages per examination period.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1 pr-2 font-semibold">Level</th>
                    <th className="py-1 pr-2 font-semibold">Prelim</th>
                    <th className="py-1 pr-2 font-semibold">Midterm</th>
                    <th className="py-1 pr-2 font-semibold">Finals</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.defaultDimensionEvaluation.map((d, i) => {
                    const set = (patch: Partial<typeof d>) =>
                      up({ defaultDimensionEvaluation: draft.defaultDimensionEvaluation.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          <Input aria-label={`Dimension level ${i + 1}`} value={d.level} onChange={(e) => set({ level: e.target.value })} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput ariaLabel={`${d.level} prelim %`} value={d.prelim} onChange={(v) => set({ prelim: v })} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput ariaLabel={`${d.level} midterm %`} value={d.midterm} onChange={(v) => set({ midterm: v })} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput ariaLabel={`${d.level} finals %`} value={d.finals} onChange={(v) => set({ finals: v })} />
                        </td>
                        <td>
                          <DeleteIconButton label={`Remove level ${d.level}`} onClick={() => up({ defaultDimensionEvaluation: draft.defaultDimensionEvaluation.filter((_, j) => j !== i) })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => up({ defaultDimensionEvaluation: [...draft.defaultDimensionEvaluation, { level: "", prelim: null, midterm: null, finals: null }] })}
            >
              <Plus className="size-4" /> Add level
            </Button>
          </Section>

          <Section title="Final grade, criteria and transmutation">
            <Field label="Final grade statement" htmlFor="inst-final">
              <Textarea id="inst-final" rows={2} value={draft.finalGradeStatement} onChange={(e) => up({ finalGradeStatement: e.target.value })} />
            </Field>
            <StringList label="Criteria for grading" items={draft.criteriaForGrading} onChange={(criteriaForGrading) => up({ criteriaForGrading })} rows={2} addLabel="Add criterion" />
            <p className="text-sm font-medium text-slate-700">Transmutation table</p>
            {draft.transmutation.map((t, i) => (
              <div key={t.id} className="grid grid-cols-[110px_1fr_auto] gap-2">
                <Input aria-label={`Grade ${i + 1}`} value={t.grade} onChange={(e) => up({ transmutation: draft.transmutation.map((x) => (x.id === t.id ? { ...x, grade: e.target.value } : x)) })} />
                <Input aria-label={`Range ${i + 1}`} value={t.range} onChange={(e) => up({ transmutation: draft.transmutation.map((x) => (x.id === t.id ? { ...x, range: e.target.value } : x)) })} />
                <DeleteIconButton label={`Remove transmutation row ${i + 1}`} onClick={() => up({ transmutation: draft.transmutation.filter((x) => x.id !== t.id) })} />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => up({ transmutation: [...draft.transmutation, { id: uid("tr"), grade: "", range: "" }] })}>
              <Plus className="size-4" /> Add row
            </Button>
          </Section>

          <Section title="Other policy statements">
            <Field label="Circulating materials" htmlFor="inst-circ">
              <Textarea id="inst-circ" rows={2} value={draft.circulatingMaterials} onChange={(e) => up({ circulatingMaterials: e.target.value })} />
            </Field>
            <Field label="Students with disabilities" htmlFor="inst-swd">
              <Textarea id="inst-swd" rows={3} value={draft.swdStatement} onChange={(e) => up({ swdStatement: e.target.value })} />
            </Field>
            <Field label="Attendance" htmlFor="inst-att">
              <Textarea id="inst-att" rows={2} value={draft.attendanceStatement} onChange={(e) => up({ attendanceStatement: e.target.value })} />
            </Field>
            <StringList label="GAD themes" items={draft.gadThemes} onChange={(gadThemes) => up({ gadThemes })} rows={1} addLabel="Add theme" />
            <Field label="Schedule note" htmlFor="inst-sched">
              <Textarea id="inst-sched" rows={2} value={draft.scheduleNote} onChange={(e) => up({ scheduleNote: e.target.value })} />
            </Field>
            <Field
              label="Learning Commitment Agreement"
              htmlFor="inst-lca"
              hint="Tokens are replaced when printing: {courseCode} → course code, {semester} → semester, {academicYear} → academic year. Keep the braces exactly as shown."
            >
              <Textarea id="inst-lca" rows={4} value={draft.learningCommitmentAgreement} onChange={(e) => up({ learningCommitmentAgreement: e.target.value })} />
            </Field>
          </Section>

          <Section title="Table of Specifications" description="Cognitive levels (column order) and how many of the first levels count as lower-order.">
            <StringList label="Cognitive levels" items={draft.tosCognitiveLevels} onChange={(tosCognitiveLevels) => up({ tosCognitiveLevels })} rows={1} addLabel="Add level" />
            <Field label="Lower-order level count" htmlFor="inst-lower" hint={`The first ${draft.tosLowerOrderCount} level(s) are grouped as lower-order; the rest as higher-order.`}>
              <NumberInput
                id="inst-lower"
                className="max-w-32"
                value={draft.tosLowerOrderCount}
                min={0}
                max={draft.tosCognitiveLevels.length}
                onChange={(v) => up({ tosLowerOrderCount: v ?? 0 })}
              />
            </Field>
          </Section>
        </fieldset>
        <p className="mt-6 text-xs text-slate-500">Existing syllabi keep their copies of this wording until you update them from the syllabus editor.</p>
      </Panel>

      <ConfirmDialog
        open={confirmUnlock}
        onOpenChange={setConfirmUnlock}
        title="Unlock institutional configuration?"
        description="You are editing prescribed institutional wording. Changes should only reflect an official update of the institutional template. Existing syllabi are not changed."
        confirmLabel="Unlock"
        onConfirm={() => {
          store.setSettings({ institutionalUnlocked: true });
          console.log("[settings] institutional unlocked");
        }}
      />
      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restore reference template wording?"
        description="All institutional wording will be replaced with the text transcribed from the reference template. Your edits here will be lost. Existing syllabi keep their copies."
        confirmLabel="Restore"
        destructive
        onConfirm={() => {
          const d = deepClone(DEFAULT_INSTITUTIONAL);
          store.setInstitutional(d);
          setDraft(deepClone(d));
          setDirty(false);
          console.log("[settings] institutional restored to reference wording");
          toast.success("Reference template wording restored.");
        }}
      />
    </div>
  );
}
