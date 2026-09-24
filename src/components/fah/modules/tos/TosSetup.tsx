"use client";

import { useState } from "react";
import { ListRestart, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppData, ExamTerm, PersonRole, Syllabus, Tos } from "@/lib/fah/types";
import { EXAM_TERM_TO_TOS_PERIOD } from "@/lib/fah/template";
import type { TosComputed } from "@/lib/fah/calc";
import { uid } from "@/lib/fah/ids";
import { ConfirmDialog, DeleteIconButton, Field, NumberInput, Panel, ReorderButtons } from "../../common/ui";
import { moveItem } from "../../common/utils";
import { TOS_CODE_PLACEHOLDER } from "@/lib/fah/documents/tos";
import { NONE, sameLevels } from "./tos-utils";

type SetDraft = (u: (d: Tos) => Tos) => void;

const TERMS: ExamTerm[] = ["First Prelim", "Second Prelim", "Finals"];

export function TosDetails({ tos, setDraft }: { tos: Tos; setDraft: SetDraft }) {
  const set = (patch: Partial<Tos>) => setDraft((d) => ({ ...d, ...patch }));
  const text = (key: keyof Tos, label: string, opts: { placeholder?: string; hint?: string; className?: string } = {}) => (
    <Field label={label} htmlFor={`tos-${String(key)}`} hint={opts.hint} className={opts.className}>
      <Input id={`tos-${String(key)}`} value={(tos[key] as string) ?? ""} placeholder={opts.placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<Tos>)} className="bg-white" />
    </Field>
  );
  return (
    <Panel title="Document details" description="Printed in the information table at the top of the TOS.">
      <div className="grid gap-4 md:grid-cols-2">
        {text("title", "Record title (app only)", { className: "md:col-span-2" })}
        {text("college", "College")}
        {text("department", "Department")}
        {text("subjectCode", "Subject Code")}
        {text("descriptiveTitle", "Descriptive Title")}
        <Field label="Period of Examination" htmlFor="tos-period" hint="Printed as Prelim · Midterm · Final (institutional TOS wording).">
          <Select value={tos.period} onValueChange={(v) => set({ period: v as ExamTerm })}>
            <SelectTrigger id="tos-period" className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {`${t} → ${EXAM_TERM_TO_TOS_PERIOD[t]}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {text("semester", "Semester", { placeholder: "1st Semester" })}
        {text("academicYear", "Academic Year", { placeholder: "2025-2026" })}
        {text("tosCode", "TOS code", { placeholder: TOS_CODE_PLACEHOLDER, hint: "Printed in red at the top right. Left blank, the template pattern is printed." })}
      </div>
    </Panel>
  );
}

export function TosSignatures({ tos, data, setDraft }: { tos: Tos; data: AppData; setDraft: SetDraft }) {
  const rows: { key: "preparedBy" | "reviewedBy" | "approvedBy"; label: string; role: PersonRole; roleLabel: string }[] = [
    { key: "preparedBy", label: "Prepared by", role: "faculty", roleLabel: "Faculty" },
    { key: "reviewedBy", label: "Reviewed by", role: "chair", roleLabel: "Chairperson" },
    { key: "approvedBy", label: "Approved", role: "dean", roleLabel: "Dean" },
  ];
  return (
    <Panel title="Signatures" description="Choose from People or type a name. Dates are free text and may be left blank for signing by hand.">
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((r) => {
          const people = data.people.filter((p) => p.roles.includes(r.role));
          const sig = tos[r.key];
          const match = people.find((p) => p.name === sig.name);
          const set = (patch: Partial<typeof sig>) => setDraft((d) => ({ ...d, [r.key]: { ...d[r.key], ...patch } }));
          return (
            <div key={r.key} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-sm font-semibold text-[#1b2466]">
                {r.label} <span className="text-xs font-normal text-slate-500">({r.roleLabel})</span>
              </p>
              <Select value={match ? match.id : NONE} onValueChange={(v) => v !== NONE && set({ name: data.people.find((p) => p.id === v)?.name ?? "" })}>
                <SelectTrigger size="sm" className="w-full bg-white text-xs" aria-label={`${r.label}: choose from people`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{people.length ? "Choose from People…" : `No ${r.roleLabel.toLowerCase()} in People`}</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={sig.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" aria-label={`${r.label} name`} className="bg-white" />
              <Input value={sig.date} onChange={(e) => set({ date: e.target.value })} placeholder="Date (optional)" aria-label={`${r.label} date`} className="bg-white" />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function TosLevels({ tos, data, setDraft }: { tos: Tos; data: AppData; setDraft: SetDraft }) {
  const template = data.institutional.tosCognitiveLevels;
  const same = sameLevels(tos.levels, template);
  const lower = data.institutional.tosLowerOrderCount;
  return (
    <Panel
      title="Levels of thinking"
      description="Column headings of the TOS. The first levels are grouped as lower-order thinking and the rest as higher-order in the percentage row."
      actions={
        same ? (
          <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
            From institutional TOS template
          </Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Configurable draft
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  levels: [...template],
                  mappings: d.mappings.map((m) => (m.level && !template.includes(m.level) ? { ...m, level: null, mappingSource: "manual" } : m)),
                }))
              }
            >
              <RotateCcw className="size-4" /> Use template levels
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        {tos.levels.map((l, i) => (
          <span
            key={l}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${i < lower ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
          >
            {l}
          </span>
        ))}
      </div>
      {!same && (
        <p className="mt-2 text-xs text-amber-800">
          This TOS uses levels that differ from the institutional template ({template.join(", ")}). Using template levels clears any mapping whose level no longer exists.
        </p>
      )}
    </Panel>
  );
}

export function TosObjectives({
  tos,
  syllabus,
  computed,
  setDraft,
}: {
  tos: Tos;
  syllabus?: Syllabus;
  computed: TosComputed;
  setDraft: SetDraft;
}) {
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const updateObj = (id: string, patch: Partial<Tos["objectives"][number]>) =>
    setDraft((d) => ({ ...d, objectives: d.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const remove = (id: string) => {
    setDraft((d) => ({
      ...d,
      objectives: d.objectives.filter((o) => o.id !== id),
      mappings: d.mappings.map((m) => (m.objectiveId === id ? { ...m, objectiveId: null, mappingSource: "manual" } : m)),
    }));
    console.log("[tos] objective removed", id);
  };
  const add = () => setDraft((d) => ({ ...d, objectives: [...d.objectives, { id: uid("obj"), label: `${d.objectives.length + 1}. `, weight: null }] }));
  const renumber = () =>
    setDraft((d) => ({ ...d, objectives: d.objectives.map((o, i) => ({ ...o, label: `${i + 1}. ${o.label.replace(/^\s*\d+\s*[.)]\s*/, "")}` })) }));
  const pending = tos.objectives.find((o) => o.id === pendingRemove);
  const pendingCount = pending ? computed.rowTotals.get(pending.id)?.count ?? 0 : 0;

  return (
    <Panel
      title="Test objectives (rows)"
      description="Each objective becomes one row pair in the TOS. Link it to a syllabus CLO and/or a topic."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={renumber} disabled={!tos.objectives.length}>
            <ListRestart className="size-4" /> Renumber labels
          </Button>
          <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={add}>
            <Plus className="size-4" /> Add objective
          </Button>
        </>
      }
    >
      {tos.objectives.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">No objectives yet. Add at least one.</p>}
      <ol className="space-y-3">
        {tos.objectives.map((o, i) => {
          const count = computed.rowTotals.get(o.id)?.count ?? 0;
          return (
            <li key={o.id} className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <ReorderButtons index={i} count={tos.objectives.length} label={`objective ${i + 1}`} onMove={(f, t) => setDraft((d) => ({ ...d, objectives: moveItem(d.objectives, f, t) }))} />
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-12">
                <Field label={`Objective ${i + 1} (printed text)`} htmlFor={`obj-${o.id}`} className="md:col-span-12">
                  <Textarea id={`obj-${o.id}`} rows={2} value={o.label} onChange={(e) => updateObj(o.id, { label: e.target.value })} className="bg-white text-sm" />
                </Field>
                <Field label="Syllabus CLO" htmlFor={`clo-${o.id}`} className="md:col-span-5" hint={!syllabus ? "The source exam is not linked to a syllabus." : undefined}>
                  <Select
                    value={o.cloId && syllabus?.clos.some((c) => c.id === o.cloId) ? o.cloId : NONE}
                    disabled={!syllabus}
                    onValueChange={(v) => {
                      const clo = syllabus?.clos.find((c) => c.id === v);
                      updateObj(o.id, {
                        cloId: v === NONE ? undefined : v,
                        ...(clo && !o.label.replace(/^\s*\d+\s*[.)]\s*/, "").trim() ? { label: `${i + 1}. ${clo.statement}` } : {}),
                      });
                    }}
                  >
                    <SelectTrigger id={`clo-${o.id}`} className="w-full bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not linked</SelectItem>
                      {(syllabus?.clos ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {`${c.code}: ${c.statement.slice(0, 60)}${c.statement.length > 60 ? "…" : ""}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Topic" htmlFor={`topic-${o.id}`} className="md:col-span-4">
                  <Input id={`topic-${o.id}`} value={o.topic ?? ""} onChange={(e) => updateObj(o.id, { topic: e.target.value })} className="bg-white" />
                </Field>
                <Field label="Weight (optional, user-entered — never inferred)" htmlFor={`w-${o.id}`} className="md:col-span-3">
                  <NumberInput id={`w-${o.id}`} value={o.weight ?? null} min={0} onChange={(v) => updateObj(o.id, { weight: v })} />
                </Field>
                <p className="text-xs text-slate-500 md:col-span-12">
                  {count} mapped item{count === 1 ? "" : "s"} · {computed.rowTotals.get(o.id)?.points ?? 0} point(s)
                </p>
              </div>
              <DeleteIconButton label={`Remove objective ${i + 1}`} onClick={() => (count ? setPendingRemove(o.id) : remove(o.id))} />
            </li>
          );
        })}
      </ol>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPendingRemove(null)}
        title="Remove this objective?"
        confirmLabel="Remove objective"
        destructive
        onConfirm={() => {
          if (pending) remove(pending.id);
          setPendingRemove(null);
        }}
        description={<p className="text-sm">{pendingCount} item(s) are mapped to it. They will become unassigned and must be mapped to another objective.</p>}
      />
    </Panel>
  );
}
