"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Info, Pencil, Plus, Search, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { store, useAppData } from "@/lib/fah/store";
import { nowIso, uid } from "@/lib/fah/ids";
import type { LibraryPO, LibraryPOCategory, Syllabus } from "@/lib/fah/types";
import { DeleteIconButton, EmptyState, Field, PageHeader, Panel, ScrollTable } from "../../common/ui";
import { href } from "../../common/router";
import { formatDate } from "../../common/utils";

const CATEGORY_LABEL: Record<LibraryPOCategory, string> = {
  discipline: "Common to the Discipline",
  "it-specific": "Specific to the Information Technology Program",
};

interface Usage {
  syllabi: Syllabus[];
  alignedSyllabi: Syllabus[]; // syllabi whose CLOs map to this PO
}

function usageOf(id: string, syllabi: Syllabus[]): Usage {
  const using = syllabi.filter((s) => s.programOutcomes.some((p) => p.libraryId === id));
  const aligned = using.filter((s) => {
    const spoIds = s.programOutcomes.filter((p) => p.libraryId === id).map((p) => p.id);
    return s.clos.some((c) => c.poIds.some((pid) => spoIds.includes(pid))) || s.addressedPoIds.some((pid) => spoIds.includes(pid));
  });
  return { syllabi: using, alignedSyllabi: aligned };
}

interface FormState {
  id?: string;
  code: string;
  description: string;
  category: LibraryPOCategory;
}

export function OutcomesLibrary() {
  const data = useAppData();
  const [cat, setCat] = useState<"all" | LibraryPOCategory>("all");
  const [status, setStatus] = useState<"all" | "active" | "archived">("active");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<{ code?: string; description?: string }>({});
  const [blocked, setBlocked] = useState<{ po: LibraryPO; usage: Usage } | null>(null);
  const [confirmDel, setConfirmDel] = useState<LibraryPO | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, Usage>();
    data.libraryPOs.forEach((p) => m.set(p.id, usageOf(p.id, data.syllabi)));
    return m;
  }, [data.libraryPOs, data.syllabi]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.libraryPOs
      .filter((p) => (cat === "all" ? true : p.category === cat))
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => !needle || `${p.code} ${p.description}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.category === b.category ? a.code.localeCompare(b.code, undefined, { numeric: true }) : a.category === "discipline" ? -1 : 1));
  }, [data.libraryPOs, cat, status, q]);

  const openNew = () => {
    setErrors({});
    setForm({ code: "", description: "", category: "it-specific" });
  };
  const openEdit = (p: LibraryPO) => {
    setErrors({});
    setForm({ id: p.id, code: p.code, description: p.description, category: p.category });
  };

  const save = () => {
    if (!form) return;
    const e: typeof errors = {};
    const code = form.code.trim();
    if (!code) e.code = "Code is required.";
    else if (data.libraryPOs.some((p) => p.id !== form.id && p.code.trim().toLowerCase() === code.toLowerCase()))
      e.code = `Another outcome already uses the code “${code}”.`;
    if (!form.description.trim()) e.description = "Description is required.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const existing = form.id ? data.libraryPOs.find((p) => p.id === form.id) : undefined;
    if (existing) {
      const descChanged = existing.description.trim() !== form.description.trim();
      store.upsert("libraryPOs", {
        ...existing,
        code,
        description: form.description.trim(),
        category: form.category,
        version: descChanged ? existing.version + 1 : existing.version,
      });
      console.log("[outcomes] updated", existing.id, { descChanged });
      toast.success(descChanged ? `${code} updated to version ${existing.version + 1}` : `${code} updated`);
    } else {
      const t = nowIso();
      const rec: LibraryPO = {
        id: uid("lpo"),
        createdAt: t,
        updatedAt: t,
        code,
        description: form.description.trim(),
        category: form.category,
        status: "active",
        version: 1,
      };
      store.upsert("libraryPOs", rec);
      console.log("[outcomes] created", rec.id);
      toast.success(`${code} added to the library`);
    }
    setForm(null);
  };

  const requestDelete = (p: LibraryPO) => {
    const u = usage.get(p.id)!;
    if (u.syllabi.length) {
      console.log("[outcomes] delete blocked", p.id, u.syllabi.length);
      setBlocked({ po: p, usage: u });
    } else setConfirmDel(p);
  };

  const setArchived = (p: LibraryPO, archived: boolean) => {
    store.upsert("libraryPOs", { ...p, status: archived ? "archived" : "active" });
    console.log("[outcomes] status", p.id, archived ? "archived" : "active");
    toast.success(`${p.code} ${archived ? "archived" : "restored"}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="IT Program Outcomes"
        description="Program Outcomes common to the discipline and specific to the Information Technology program. Syllabi copy an outcome when it is selected, so changes here never alter saved syllabi. Syllabi show a notice and update only when you choose to."
        actions={
          <Button onClick={openNew} className="bg-[#1b2466] hover:bg-[#262f7a]">
            <Plus className="size-4" /> Add outcome
          </Button>
        }
      />

      <Panel>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Search outcomes" placeholder="Search code or description…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={cat} onValueChange={(v) => setCat(v as typeof cat)}>
            <SelectTrigger aria-label="Filter by category" className="w-full md:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="discipline">{CATEGORY_LABEL.discipline}</SelectItem>
              <SelectItem value="it-specific">{CATEGORY_LABEL["it-specific"]}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger aria-label="Filter by status" className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Target className="size-6" />}
            title="No outcomes match"
            description="Change the filters or add a new outcome."
            action={
              <Button variant="outline" onClick={openNew}>
                <Plus className="size-4" /> Add outcome
              </Button>
            }
          />
        ) : (
          <ScrollTable minWidth={960}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Code</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Version</th>
                  <th className="px-3 py-2.5 font-semibold">Used by</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const u = usage.get(p.id)!;
                  return (
                    <tr key={p.id} className={p.status === "archived" ? "bg-slate-50/60 text-slate-500" : undefined}>
                      <td className="whitespace-nowrap px-3 py-3 align-top font-semibold text-[#1b2466]">{p.code}</td>
                      <td className="px-3 py-3 align-top">
                        <p className="leading-relaxed">{p.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {p.fromTemplate && (
                            <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
                              From template
                            </Badge>
                          )}
                          {p.referencePeos?.length ? (
                            <span className="text-xs text-slate-500" title="PEO mapping printed in the reference template — a hint only; each syllabus sets its own mapping.">
                              Reference PEOs: {p.referencePeos.join(", ")}
                            </span>
                          ) : null}
                        </div>
                        {p.referenceNote && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-amber-800">
                            <Info className="mt-0.5 size-3 shrink-0" /> {p.referenceNote}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-xs">{CATEGORY_LABEL[p.category]}</td>
                      <td className="px-3 py-3 align-top">
                        <Badge
                          variant="outline"
                          className={p.status === "active" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}
                        >
                          {p.status === "active" ? "Active" : "Archived"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 align-top text-xs">
                        v{p.version}
                        <span className="block text-slate-400">{formatDate(p.updatedAt)}</span>
                      </td>
                      <td className="px-3 py-3 align-top text-xs">
                        {u.syllabi.length ? (
                          <span title={u.syllabi.map((s) => s.courseCode || s.descriptiveTitle).join(", ")}>
                            {u.syllabi.length} syllab{u.syllabi.length === 1 ? "us" : "i"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not used</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${p.code}`} title="Edit" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        {p.status === "active" ? (
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Archive ${p.code}`} title="Archive" onClick={() => setArchived(p, true)}>
                            <Archive className="size-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Restore ${p.code}`} title="Restore" onClick={() => setArchived(p, false)}>
                            <ArchiveRestore className="size-4" />
                          </Button>
                        )}
                        <DeleteIconButton label={`Delete ${p.code}`} onClick={() => requestDelete(p)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Changes never alter saved syllabi. Syllabi show a notice and update only when you choose to. Archived outcomes stay in syllabi that already use them but
          are hidden when selecting outcomes for new syllabi.
        </p>
      </Panel>

      {/* Add / edit */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit program outcome" : "Add program outcome"}</DialogTitle>
            <DialogDescription>
              {form?.id ? "Changing the description creates a new version. Syllabi that use the previous version will show a notice." : "New outcomes become available when selecting outcomes in a syllabus."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <Field label="Code" required htmlFor="po-code" error={errors.code} hint="For example “PO 17”. Must be unique.">
                <Input id="po-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Category" htmlFor="po-cat">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as LibraryPOCategory })}>
                  <SelectTrigger id="po-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discipline">{CATEGORY_LABEL.discipline}</SelectItem>
                    <SelectItem value="it-specific">{CATEGORY_LABEL["it-specific"]}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description" required htmlFor="po-desc" error={errors.description}>
                <Textarea id="po-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save} className="bg-[#1b2466] hover:bg-[#262f7a]">
              Save outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete blocked */}
      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{blocked?.po.code} cannot be deleted</DialogTitle>
            <DialogDescription>
              This outcome is used by {blocked?.usage.syllabi.length} syllab{blocked?.usage.syllabi.length === 1 ? "us" : "i"}
              {blocked?.usage.alignedSyllabi.length ? `, and ${blocked.usage.alignedSyllabi.length} of them align CLOs or addressed outcomes to it` : ""}. Deleting it
              would break those references. Archive it instead to hide it from new selections while keeping existing syllabi intact.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {blocked?.usage.syllabi.map((s) => (
              <li key={s.id}>
                <a
                  href={href(`/syllabi/${s.id}?step=outcomes`)}
                  onClick={() => setBlocked(null)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="truncate">
                    <strong>{s.courseCode || "Untitled"}</strong> — {s.descriptiveTitle || "Untitled syllabus"}
                  </span>
                  {blocked.usage.alignedSyllabi.includes(s) && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Aligned
                    </Badge>
                  )}
                </a>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlocked(null)}>
              Close
            </Button>
            {blocked?.po.status === "active" && (
              <Button
                onClick={() => {
                  setArchived(blocked.po, true);
                  setBlocked(null);
                }}
                className="bg-[#1b2466] hover:bg-[#262f7a]"
              >
                <Archive className="size-4" /> Archive instead
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {confirmDel?.code}?</DialogTitle>
            <DialogDescription>No syllabus uses this outcome. It will be removed from the library permanently.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!confirmDel) return;
                store.remove("libraryPOs", confirmDel.id);
                console.log("[outcomes] deleted", confirmDel.id);
                toast.success(`${confirmDel.code} deleted`);
                setConfirmDel(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
