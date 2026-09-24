"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Info, RefreshCw, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppData, Person, PersonRole, SignatoryRef, Syllabus } from "@/lib/fah/types";
import { ConfirmDialog, DeleteIconButton, Field, Panel, ReorderButtons, useStableId } from "../../../common/ui";
import { href } from "../../../common/router";
import { moveItem } from "../../../common/utils";
import type { SectionProps } from "./types";

const NONE = "__manual";

const ROLE_LABEL: Record<PersonRole, string> = { faculty: "Faculty", chair: "Department Chairperson", dean: "Dean" };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SignatoryEditor({
  value,
  onChange,
  role,
  people,
  heading,
  actions,
}: {
  value: SignatoryRef;
  onChange: (v: SignatoryRef) => void;
  role: PersonRole;
  people: Person[];
  heading: string;
  actions?: React.ReactNode;
}) {
  const uid = useStableId("sig");
  const person = value.personId ? people.find((p) => p.id === value.personId) : undefined;
  const matching = people.filter((p) => p.roles.includes(role));
  const others = people.filter((p) => !p.roles.includes(role));
  const roleMismatch = person && !person.roles.includes(role);
  const nameChanged = person && person.name.trim() !== value.name.trim();
  const personMissing = value.personId && !person;

  const select = (id: string) => {
    if (id === NONE) {
      console.log("[signatories] unlink person", heading);
      onChange({ ...value, personId: undefined });
      return;
    }
    const p = people.find((x) => x.id === id);
    if (!p) return;
    console.log("[signatories] select", heading, p.id);
    onChange({ ...value, personId: p.id, name: p.name, title: value.title?.trim() ? value.title : ROLE_LABEL[role] });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</p>
        {actions}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Select person" htmlFor={`${uid}-p`} className="sm:col-span-2">
          <Select value={value.personId && person ? value.personId : NONE} onValueChange={select}>
            <SelectTrigger id={`${uid}-p`} className="w-full bg-white">
              <SelectValue placeholder="Choose from Faculty and Signatories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Type the name manually —</SelectItem>
              <SelectGroup>
                <SelectLabel>{ROLE_LABEL[role]}</SelectLabel>
                {matching.length === 0 && <p className="px-2 py-1 text-xs italic text-slate-400">No one has this role yet.</p>}
                {matching.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {others.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other people (different role)</SelectLabel>
                  {others.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.roles.map((r) => ROLE_LABEL[r]).join(", ") || "no role"}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Printed name" htmlFor={`${uid}-n`}>
          <Input id={`${uid}-n`} className="bg-white font-semibold uppercase" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="e.g. DR. JUAN DELA CRUZ" />
        </Field>
        <Field label="Title / designation" htmlFor={`${uid}-t`}>
          <Input id={`${uid}-t`} className="bg-white" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder={ROLE_LABEL[role]} />
        </Field>
        <Field label="Date Signed" htmlFor={`${uid}-d`} hint="Optional — leave blank to print an empty line." className="sm:col-span-2">
          <div className="flex gap-2">
            <Input id={`${uid}-d`} className="bg-white" value={value.dateSigned} onChange={(e) => onChange({ ...value, dateSigned: e.target.value })} placeholder="e.g. 2026-01-15 or January 15, 2026" />
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => onChange({ ...value, dateSigned: todayIso() })}>
              <CalendarDays className="size-4" /> Today
            </Button>
            {value.dateSigned && (
              <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Clear date signed" onClick={() => onChange({ ...value, dateSigned: "" })}>
                <X className="size-4" />
              </Button>
            )}
          </div>
        </Field>
      </div>
      {nameChanged && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <AlertTriangle className="size-3.5" />
          <span>
            Name in Faculty and Signatories changed → <strong>{person!.name}</strong>
          </span>
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7 bg-white text-xs" onClick={() => onChange({ ...value, name: person!.name })}>
            <RefreshCw className="size-3.5" /> Update
          </Button>
        </div>
      )}
      {roleMismatch && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="size-3.5" /> {person!.name} is not listed as {ROLE_LABEL[role]} in Faculty and Signatories.
        </p>
      )}
      {personMissing && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <AlertTriangle className="size-3.5" /> The linked person was removed from Faculty and Signatories. The name below is kept as entered.
        </p>
      )}
    </div>
  );
}

function defaultsFrom(data: AppData) {
  const d = data.settings.defaultSignatories;
  const ref = (id: string | undefined, title: string): SignatoryRef => {
    const p = id ? data.people.find((x) => x.id === id) : undefined;
    return { personId: p?.id, name: p?.name ?? "", title, dateSigned: "" };
  };
  return {
    preparedBy: (d.facultyIds.length ? d.facultyIds : [undefined]).map((id) => ref(id, "Faculty")),
    reviewedBy: ref(d.chairId, "Department Chairperson"),
    approvedBy: ref(d.deanId, "Dean"),
  };
}

export function SignatoriesSection({ syllabus, update, data }: SectionProps) {
  const [confirmDefaults, setConfirmDefaults] = useState(false);
  const people = data.people;
  const rev = syllabus.revision;
  const setRev = (patch: Partial<Syllabus["revision"]>) => update((s) => ({ ...s, revision: { ...s.revision, ...patch } }));
  const setPrepared = (fn: (l: SignatoryRef[]) => SignatoryRef[]) => update((s) => ({ ...s, preparedBy: fn(s.preparedBy) }));
  const hasDefaults = !!(data.settings.defaultSignatories.facultyIds.length || data.settings.defaultSignatories.chairId || data.settings.defaultSignatories.deanId);

  const applyDefaults = () => {
    const d = defaultsFrom(data);
    console.log("[signatories] apply defaults", d);
    update((s) => ({ ...s, ...d }));
    toast.success("Default signatories applied", { description: "Date Signed fields were cleared." });
  };

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        These are document fields. Entering a name does not indicate that review or approval has occurred.
      </p>

      <Panel
        title="Signatories"
        description="Printed at the end of the syllabus as Prepared by · Reviewed by · Approved by."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={href("/people")}>
                <Users className="size-4" /> Manage people
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDefaults(true)} disabled={!hasDefaults} title={hasDefaults ? undefined : "No default signatories are set in Templates & Settings"}>
              <RefreshCw className="size-4" /> Apply default signatories
            </Button>
          </>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <h3 className="mb-2 font-display text-base font-semibold text-[#1b2466]">Prepared by</h3>
            <div className="space-y-3">
              {syllabus.preparedBy.map((p, i) => (
                <div key={`prep-${i}`} className="flex gap-2">
                  <ReorderButtons index={i} count={syllabus.preparedBy.length} label={`faculty ${i + 1}`} onMove={(a, b) => setPrepared((l) => moveItem(l, a, b))} />
                  <div className="min-w-0 flex-1">
                    <SignatoryEditor
                      heading={`Faculty ${i + 1}`}
                      role="faculty"
                      people={people}
                      value={p}
                      onChange={(v) => setPrepared((l) => l.map((x, j) => (j === i ? v : x)))}
                      actions={
                        syllabus.preparedBy.length > 1 ? (
                          <DeleteIconButton label={`Remove faculty ${i + 1}`} onClick={() => setPrepared((l) => l.filter((_, j) => j !== i))} />
                        ) : undefined
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPrepared((l) => [...l, { name: "", title: "Faculty", dateSigned: "" }])}>
              <UserPlus className="size-4" /> Add faculty
            </Button>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-display text-base font-semibold text-[#1b2466]">Reviewed by</h3>
              <SignatoryEditor heading="Department Chairperson" role="chair" people={people} value={syllabus.reviewedBy} onChange={(v) => update((s) => ({ ...s, reviewedBy: v }))} />
            </div>
            <div>
              <h3 className="mb-2 font-display text-base font-semibold text-[#1b2466]">Approved by</h3>
              <SignatoryEditor heading="Dean" role="dean" people={people} value={syllabus.approvedBy} onChange={(v) => update((s) => ({ ...s, approvedBy: v }))} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Revision information" description="Preserved when saved or duplicated. Leave blank to print empty lines.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Revision Number" htmlFor="rev-number">
            <Input id="rev-number" value={rev.number} onChange={(e) => setRev({ number: e.target.value })} placeholder="e.g. 01" />
          </Field>
          <Field label="Date Revised" htmlFor="rev-date">
            <Input id="rev-date" value={rev.dateRevised} onChange={(e) => setRev({ dateRevised: e.target.value })} placeholder="e.g. January 5, 2026" />
          </Field>
          <Field label="Effectivity" htmlFor="rev-eff">
            <Input id="rev-eff" value={rev.effectivity} onChange={(e) => setRev({ effectivity: e.target.value })} placeholder="e.g. 2nd Semester, AY 2025-2026" />
          </Field>
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmDefaults}
        onOpenChange={setConfirmDefaults}
        title="Apply default signatories?"
        description="Prepared by, Reviewed by and Approved by will be replaced with the defaults from Templates & Settings, and Date Signed fields will be cleared."
        confirmLabel="Apply defaults"
        onConfirm={applyDefaults}
      />
    </div>
  );
}
