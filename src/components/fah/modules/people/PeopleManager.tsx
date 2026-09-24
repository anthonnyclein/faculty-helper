"use client";

import { useMemo, useState } from "react";
import { Info, Pencil, Plus, Star, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { store, useAppData } from "@/lib/fah/store";
import { nowIso, uid } from "@/lib/fah/ids";
import type { AppData, Person, PersonRole } from "@/lib/fah/types";
import { DeleteIconButton, DemoBadge, EmptyState, Field, PageHeader, Panel, ReorderButtons } from "../../common/ui";
import { href } from "../../common/router";
import { moveItem } from "../../common/utils";

const ROLE_LABEL: Record<PersonRole, string> = { faculty: "Faculty", chair: "Department Chairperson", dean: "Dean" };
const ROLES: PersonRole[] = ["faculty", "chair", "dean"];
const NONE = "__none__";

interface UsageItem {
  kind: "Syllabus" | "TOS";
  id: string;
  label: string;
  as: string;
  link: string;
}

function usageOf(p: Person, data: AppData): UsageItem[] {
  const out: UsageItem[] = [];
  const norm = (s: string) => s.trim().toLowerCase();
  data.syllabi.forEach((s) => {
    const as: string[] = [];
    if (s.preparedBy.some((x) => x.personId === p.id)) as.push("Prepared by");
    if (s.reviewedBy.personId === p.id) as.push("Reviewed by");
    if (s.approvedBy.personId === p.id) as.push("Approved by");
    if (as.length)
      out.push({ kind: "Syllabus", id: s.id, label: `${s.courseCode || "Untitled"} — ${s.descriptiveTitle || "Untitled syllabus"}`, as: as.join(", "), link: `/syllabi/${s.id}?step=signatories` });
  });
  data.tos.forEach((t) => {
    const as: string[] = [];
    if (norm(t.preparedBy.name) === norm(p.name)) as.push("Prepared by");
    if (norm(t.reviewedBy.name) === norm(p.name)) as.push("Checked/Reviewed by");
    if (norm(t.approvedBy.name) === norm(p.name)) as.push("Approved by");
    if (as.length) out.push({ kind: "TOS", id: t.id, label: t.title || "Table of Specifications", as: `${as.join(", ")} (name match)`, link: `/tos/${t.id}` });
  });
  return out;
}

interface FormState {
  id?: string;
  name: string;
  department: string;
  roles: PersonRole[];
}

export function PeopleManager() {
  const data = useAppData();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<{ name?: string; roles?: string }>({});
  const [del, setDel] = useState<Person | null>(null);
  const defaults = data.settings.defaultSignatories;

  const usage = useMemo(() => {
    const m = new Map<string, UsageItem[]>();
    data.people.forEach((p) => m.set(p.id, usageOf(p, data)));
    return m;
  }, [data]);

  const byRole = (r: PersonRole) => data.people.filter((p) => p.roles.includes(r)).sort((a, b) => a.name.localeCompare(b.name));

  const openNew = () => {
    setErrors({});
    setForm({ name: "", department: data.settings.defaultDepartment, roles: ["faculty"] });
  };

  const save = () => {
    if (!form) return;
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.roles.length) e.roles = "Select at least one role.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const existing = form.id ? data.people.find((p) => p.id === form.id) : undefined;
    if (existing) {
      store.upsert("people", { ...existing, name: form.name.trim(), department: form.department.trim(), roles: form.roles });
      // Keep default signatories consistent with the roles.
      const d = data.settings.defaultSignatories;
      const patch = {
        facultyIds: form.roles.includes("faculty") ? d.facultyIds : d.facultyIds.filter((x) => x !== existing.id),
        chairId: d.chairId === existing.id && !form.roles.includes("chair") ? undefined : d.chairId,
        deanId: d.deanId === existing.id && !form.roles.includes("dean") ? undefined : d.deanId,
      };
      store.setSettings({ defaultSignatories: patch });
      console.log("[people] updated", existing.id);
      toast.success("Person updated. Saved syllabi keep their stored signatory details.");
    } else {
      const t = nowIso();
      const p: Person = { id: uid("per"), createdAt: t, updatedAt: t, name: form.name.trim(), department: form.department.trim(), roles: form.roles };
      store.upsert("people", p);
      console.log("[people] created", p.id);
      toast.success(`${p.name} added.`);
    }
    setForm(null);
  };

  const doDelete = (p: Person) => {
    store.remove("people", p.id);
    const d = data.settings.defaultSignatories;
    store.setSettings({
      defaultSignatories: {
        facultyIds: d.facultyIds.filter((x) => x !== p.id),
        chairId: d.chairId === p.id ? undefined : d.chairId,
        deanId: d.deanId === p.id ? undefined : d.deanId,
      },
    });
    console.log("[people] deleted", p.id);
    toast.success(`${p.name} removed.`);
    setDel(null);
  };

  const setDefaults = (patch: Partial<typeof defaults>) => {
    store.setSettings({ defaultSignatories: { ...defaults, ...patch } });
    console.log("[people] default signatories", { ...defaults, ...patch });
  };

  const faculty = byRole("faculty");
  const chairs = byRole("chair");
  const deans = byRole("dean");
  const availableFaculty = faculty.filter((p) => !defaults.facultyIds.includes(p.id));

  return (
    <div>
      <PageHeader
        eyebrow="Signatories"
        title="Faculty and Signatories"
        description="People who prepare, review and approve syllabi and tables of specifications. Saved syllabi keep their signatory details unless you update them in the syllabus."
        actions={
          <Button onClick={openNew} className="bg-[#1b2466] hover:bg-[#262f7a]">
            <Plus className="size-4" /> Add person
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {data.people.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No people yet"
              description="Add faculty members, the department chairperson and the dean."
              action={
                <Button variant="outline" onClick={openNew}>
                  <Plus className="size-4" /> Add person
                </Button>
              }
            />
          ) : (
            ROLES.map((role) => {
              const list = byRole(role);
              return (
                <Panel key={role} title={role === "faculty" ? "Faculty" : role === "chair" ? "Department Chairpersons" : "Deans"} description={`${list.length} ${list.length === 1 ? "person" : "people"}`}>
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-500">Nobody has this role yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {list.map((p) => {
                        const u = usage.get(p.id) ?? [];
                        const isDefault = role === "faculty" ? defaults.facultyIds.includes(p.id) : role === "chair" ? defaults.chairId === p.id : defaults.deanId === p.id;
                        return (
                          <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1b2466]/5 text-[#1b2466]">
                              <UserRound className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{p.name}</span>
                                {isDefault && (
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                                    <Star className="size-3" /> Default
                                  </Badge>
                                )}
                                {p.isDemo && <DemoBadge />}
                              </div>
                              <p className="text-xs text-slate-500">
                                {p.department || "No department"} · {p.roles.map((r) => ROLE_LABEL[r]).join(", ")}
                              </p>
                              {u.length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {u.map((x) => (
                                    <a
                                      key={`${x.kind}-${x.id}`}
                                      href={href(x.link)}
                                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200"
                                      title={x.as}
                                    >
                                      {x.kind}: {x.label}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1 text-[11px] text-slate-400">Not used in any saved document</p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Edit ${p.name}`}
                                onClick={() => {
                                  setErrors({});
                                  setForm({ id: p.id, name: p.name, department: p.department, roles: [...p.roles] });
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <DeleteIconButton label={`Delete ${p.name}`} onClick={() => setDel(p)} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              );
            })
          )}
        </div>

        <Panel title="Default signatories" description="Pre-filled in new syllabi. You can change them in each syllabus.">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Prepared by (faculty, in order)</p>
              {defaults.facultyIds.length === 0 && <p className="mb-2 text-xs text-slate-400">No default faculty selected.</p>}
              <ol className="space-y-1.5">
                {defaults.facultyIds.map((id, i) => {
                  const p = data.people.find((x) => x.id === id);
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                      <ReorderButtons index={i} count={defaults.facultyIds.length} label={p?.name ?? "faculty"} onMove={(a, b) => setDefaults({ facultyIds: moveItem(defaults.facultyIds, a, b) })} />
                      <span className="flex-1 truncate text-sm">
                        {i + 1}. {p?.name ?? <em className="text-red-600">Removed person</em>}
                      </span>
                      <DeleteIconButton label={`Remove ${p?.name ?? "faculty"} from defaults`} onClick={() => setDefaults({ facultyIds: defaults.facultyIds.filter((x) => x !== id) })} />
                    </li>
                  );
                })}
              </ol>
              {availableFaculty.length > 0 && (
                <Select value={NONE} onValueChange={(v) => v !== NONE && setDefaults({ facultyIds: [...defaults.facultyIds, v] })}>
                  <SelectTrigger aria-label="Add default faculty" className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Add faculty…</SelectItem>
                    {availableFaculty.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Field label="Reviewed by (Department Chairperson)" htmlFor="def-chair">
              <Select value={defaults.chairId && chairs.some((p) => p.id === defaults.chairId) ? defaults.chairId : NONE} onValueChange={(v) => setDefaults({ chairId: v === NONE ? undefined : v })}>
                <SelectTrigger id="def-chair" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {chairs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Approved by (Dean)" htmlFor="def-dean">
              <Select value={defaults.deanId && deans.some((p) => p.id === defaults.deanId) ? defaults.deanId : NONE} onValueChange={(v) => setDefaults({ deanId: v === NONE ? undefined : v })}>
                <SelectTrigger id="def-dean" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {deans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Info className="mt-0.5 size-3.5 shrink-0" /> Saved syllabi keep their signatory details unless you update them in the syllabus.
            </p>
          </div>
        </Panel>
      </div>

      {/* Add / edit */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit person" : "Add person"}</DialogTitle>
            <DialogDescription>Names are printed exactly as entered (the templates use capital letters).</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <Field label="Full name" required htmlFor="per-name" error={errors.name} hint="Include titles, e.g. “DR. JUAN A. DELA CRUZ”.">
                <Input id="per-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Department" htmlFor="per-dept">
                <Input id="per-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  Roles<span className="ml-0.5 text-red-600">*</span>
                </legend>
                <div className="flex flex-wrap gap-4">
                  {ROLES.map((r) => (
                    <label key={r} htmlFor={`role-${r}`} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`role-${r}`}
                        checked={form.roles.includes(r)}
                        onCheckedChange={(v) => setForm({ ...form, roles: v === true ? [...form.roles, r] : form.roles.filter((x) => x !== r) })}
                      />
                      {ROLE_LABEL[r]}
                    </label>
                  ))}
                </div>
                {errors.roles && (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    {errors.roles}
                  </p>
                )}
              </fieldset>
              {form.id && (usage.get(form.id)?.length ?? 0) > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This person appears in {usage.get(form.id)!.length} saved document(s). Those documents keep the name they stored; update them in each editor if needed.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save} className="bg-[#1b2466] hover:bg-[#262f7a]">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {del?.name}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {del && (usage.get(del.id)?.length ?? 0) > 0 ? (
                  <>
                    <p>This person is used in {usage.get(del.id)!.length} saved document(s):</p>
                    <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs">
                      {usage.get(del.id)!.map((x) => (
                        <li key={`${x.kind}-${x.id}`}>
                          {x.kind}: {x.label} — {x.as}
                        </li>
                      ))}
                    </ul>
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                      Removing is allowed. Saved documents keep their stored names — they are snapshots and will not change.
                    </p>
                  </>
                ) : (
                  <p>This person is not used in any saved document.</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => del && doDelete(del)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
