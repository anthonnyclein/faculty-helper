"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, FilePlus2, Link2, Link2Off, Pencil, Plus, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { citationRuns, formatReference, missingReferenceFields } from "@/lib/fah/citations";
import { uid } from "@/lib/fah/ids";
import { store } from "@/lib/fah/store";
import type { CitationStyle, ReferenceEntry, Resource } from "@/lib/fah/types";
import { ConfirmDialog, DeleteIconButton, EmptyState, Field, Panel, ReorderButtons } from "../../../common/ui";
import { href } from "../../../common/router";
import { moveItem } from "../../../common/utils";
import type { SectionProps } from "./types";

const STYLES: CitationStyle[] = ["APA 7", "IEEE", "MLA 9", "Chicago"];

export function Citation({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {citationRuns(text).map((r, i) => (r.italic ? <i key={i}>{r.text}</i> : <span key={i}>{r.text}</span>))}
    </span>
  );
}

function MissingChips({ fields }: { fields: string[] }) {
  if (!fields.length) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">Needs: {fields.join(", ")}</span>
  );
}

function fromResource(r: Resource): ReferenceEntry {
  return {
    id: uid("ref"),
    resourceId: r.id,
    origin: "resource",
    authors: r.authors?.trim() ?? "",
    year: r.year?.trim() ?? "",
    title: r.title?.trim() ?? "",
    edition: r.edition?.trim() || undefined,
    publisher: r.publisher?.trim() || undefined,
    doi: r.doi?.trim() || undefined,
    url: r.url?.trim() || undefined,
  };
}

const EMPTY: Omit<ReferenceEntry, "id"> = { origin: "manual", authors: "", year: "", title: "", edition: "", publisher: "", doi: "", url: "", accessed: "", manualText: "" };

function ReferenceDialog({
  open,
  onOpenChange,
  initial,
  style,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ReferenceEntry | null;
  style: CitationStyle;
  onSave: (r: ReferenceEntry) => void;
}) {
  const [draft, setDraft] = useState<ReferenceEntry>(() => initial ?? { id: uid("ref"), ...EMPTY });
  const [verbatim, setVerbatim] = useState(!!initial?.manualText?.trim());
  const set = (patch: Partial<ReferenceEntry>) => setDraft((d) => ({ ...d, ...patch }));
  const effective: ReferenceEntry = verbatim ? draft : { ...draft, manualText: "" };
  const preview = formatReference(effective, style);
  const missing = missingReferenceFields(effective);
  const canSave = verbatim ? !!draft.manualText?.trim() : !!(draft.title.trim() || draft.authors.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1b2466]">{initial ? "Edit reference" : "Add reference"}</DialogTitle>
          <DialogDescription>Enter only the details you can verify. Missing information is flagged, never invented.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Switch id="ref-verbatim" checked={verbatim} onCheckedChange={setVerbatim} />
          <label htmlFor="ref-verbatim" className="text-sm text-slate-700">
            Print verbatim text instead of a formatted citation
          </label>
        </div>
        {verbatim ? (
          <Field label="Reference text (printed exactly)" htmlFor="ref-manual" hint="Wrap a title in *asterisks* to print it in italics.">
            <Textarea id="ref-manual" rows={3} value={draft.manualText ?? ""} onChange={(e) => set({ manualText: e.target.value })} />
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Author(s)" htmlFor="ref-authors" hint="As printed, e.g. Stringer, E. T., Christensen, L. M., & Baldwin, S. C." className="sm:col-span-4">
              <Input id="ref-authors" value={draft.authors} onChange={(e) => set({ authors: e.target.value })} />
            </Field>
            <Field label="Year" htmlFor="ref-year" className="sm:col-span-2">
              <Input id="ref-year" value={draft.year} onChange={(e) => set({ year: e.target.value })} placeholder="2021" />
            </Field>
            <Field label="Title" htmlFor="ref-title" className="sm:col-span-4">
              <Input id="ref-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Edition" htmlFor="ref-ed" className="sm:col-span-2">
              <Input id="ref-ed" value={draft.edition ?? ""} onChange={(e) => set({ edition: e.target.value })} placeholder="5th" />
            </Field>
            <Field label="Publisher" htmlFor="ref-pub" className="sm:col-span-3">
              <Input id="ref-pub" value={draft.publisher ?? ""} onChange={(e) => set({ publisher: e.target.value })} />
            </Field>
            <Field label="DOI" htmlFor="ref-doi" className="sm:col-span-3">
              <Input id="ref-doi" value={draft.doi ?? ""} onChange={(e) => set({ doi: e.target.value })} placeholder="10.xxxx/xxxxx" />
            </Field>
            <Field label="URL" htmlFor="ref-url" className="sm:col-span-4">
              <Input id="ref-url" value={draft.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="Accessed date" htmlFor="ref-acc" hint="For web sources" className="sm:col-span-2">
              <Input id="ref-acc" value={draft.accessed ?? ""} onChange={(e) => set({ accessed: e.target.value })} placeholder="January 5, 2026" />
            </Field>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 bg-[#fffef9] px-3 py-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preview · {style}</p>
          <p className="font-serif text-sm text-slate-900">{preview ? <Citation text={preview} /> : <span className="italic text-slate-400">Nothing to preview yet.</span>}</p>
          {missing.length > 0 && (
            <div className="mt-1.5">
              <MissingChips fields={missing} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            className="bg-[#1b2466] hover:bg-[#262f7a]"
            onClick={() => {
              const clean: ReferenceEntry = verbatim ? { ...draft, manualText: draft.manualText?.trim() } : { ...draft, manualText: undefined };
              console.log("[references] save", clean.id);
              onSave(clean);
              onOpenChange(false);
            }}
          >
            Save reference
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReferencesSection({ syllabus, update, data }: SectionProps) {
  const [editing, setEditing] = useState<{ ref: ReferenceEntry | null; key: string } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const refs = syllabus.references;
  const style = syllabus.citationStyle || "APA 7";

  const planSourceIds = useMemo(() => new Set(syllabus.learningPlan.flatMap((l) => l.sourceResourceIds ?? [])), [syllabus.learningPlan]);
  const linkedIds = useMemo(() => new Set([...syllabus.resourceIds, ...planSourceIds]), [syllabus.resourceIds, planSourceIds]);
  const referencedIds = useMemo(() => new Set(refs.map((r) => r.resourceId).filter(Boolean) as string[]), [refs]);
  const candidates = useMemo(
    () => data.resources.filter((r) => r.purpose === "instructional" && (showAll || linkedIds.has(r.id))),
    [data.resources, showAll, linkedIds]
  );

  const setRefs = (fn: (l: ReferenceEntry[]) => ReferenceEntry[]) => update((s) => ({ ...s, references: fn(s.references) }));

  const saveRef = (r: ReferenceEntry) =>
    setRefs((l) => (l.some((x) => x.id === r.id) ? l.map((x) => (x.id === r.id ? r : x)) : [...l, r]));

  const draftFromPicked = () => {
    const chosen = data.resources.filter((r) => picked.includes(r.id) && !referencedIds.has(r.id));
    if (!chosen.length) {
      toast.info("Nothing to draft", { description: "The selected resources are already in the reference list." });
      return;
    }
    const drafted = chosen.map(fromResource);
    const incomplete = drafted.filter((d) => missingReferenceFields(d).length).length;
    console.log("[references] drafted from resources", drafted.map((d) => d.resourceId));
    setRefs((l) => [...l, ...drafted]);
    setPicked([]);
    toast.success(`${drafted.length} reference(s) drafted from resource metadata`, {
      description: incomplete ? `${incomplete} need missing details — look for the amber “Needs” flags.` : "Review the formatted citations below.",
    });
  };

  const toggleLink = (r: Resource, on: boolean) => {
    update((s) => ({ ...s, resourceIds: on ? Array.from(new Set([...s.resourceIds, r.id])) : s.resourceIds.filter((x) => x !== r.id) }));
    const linked = on ? Array.from(new Set([...(r.linkedSyllabusIds ?? []), syllabus.id])) : (r.linkedSyllabusIds ?? []).filter((x) => x !== syllabus.id);
    try {
      store.upsert("resources", { ...r, linkedSyllabusIds: linked });
      console.log("[references] resource link", r.id, on);
    } catch (e) {
      console.error("[references] failed to update resource link", e);
      toast.error("Could not update the resource link");
      throw e;
    }
  };

  const refreshFromResource = (ref: ReferenceEntry) => {
    const r = data.resources.find((x) => x.id === ref.resourceId);
    if (!r) return;
    const fresh = fromResource(r);
    saveRef({ ...ref, authors: fresh.authors, year: fresh.year, title: fresh.title, edition: fresh.edition, publisher: fresh.publisher, doi: fresh.doi, url: fresh.url });
    toast.success("Reference refreshed from the Resource Library metadata");
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Suggested References"
        description="Heading printed as ‘Suggested References:’ in the template."
        actions={
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="cit-style" className="text-xs font-medium text-slate-600">
                Citation style
              </label>
              <Select value={style} onValueChange={(v) => update((s) => ({ ...s, citationStyle: v as CitationStyle }))}>
                <SelectTrigger id="cit-style" className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="bg-[#1b2466] hover:bg-[#262f7a]" onClick={() => setEditing({ ref: null, key: uid("dlg") })}>
              <Plus className="size-4" /> Add reference
            </Button>
          </>
        }
      >
        {refs.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="No references yet"
            description="Draft them from the resources linked to this syllabus, or add one manually."
          />
        ) : (
          <ol className="space-y-2">
            {refs.map((r, i) => {
              const missing = missingReferenceFields(r);
              const text = formatReference(r, style);
              const res = r.resourceId ? data.resources.find((x) => x.id === r.resourceId) : undefined;
              return (
                <li key={r.id} className={cn("flex gap-2 rounded-xl border bg-white p-3", missing.length ? "border-amber-200" : "border-slate-200")}>
                  <ReorderButtons index={i} count={refs.length} label={`reference ${i + 1}`} onMove={(a, b) => setRefs((l) => moveItem(l, a, b))} />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[15px] leading-snug text-slate-900" style={{ paddingLeft: "1.5em", textIndent: "-1.5em" }}>
                      {text ? <Citation text={text} /> : <span className="italic text-slate-400">Empty reference</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={r.origin === "resource" ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-300 bg-slate-50 text-slate-700"}>
                        {r.origin === "resource" ? "From resource metadata" : "Manual"}
                      </Badge>
                      {r.manualText?.trim() && <Badge variant="outline">Printed verbatim</Badge>}
                      {r.resourceId && !res && <Badge variant="outline" className="border-amber-300 text-amber-800">Resource removed</Badge>}
                      <MissingChips fields={missing} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-0.5">
                    {res && (
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Refresh from resource metadata" title="Refresh from resource metadata" onClick={() => refreshFromResource(r)}>
                        <RefreshCw className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit reference ${i + 1}`} title="Edit" onClick={() => setEditing({ ref: r, key: r.id + uid("k") })}>
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteIconButton label={`Remove reference ${i + 1}`} onClick={() => setRemoveId(r.id)} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel
        title="Draft from linked resources"
        description="Entries use only the metadata stored in the Resource Library (authors, year, title, edition, publisher, DOI, URL). Nothing is invented."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch id="ref-show-all" checked={showAll} onCheckedChange={setShowAll} />
              <label htmlFor="ref-show-all" className="text-xs font-medium text-slate-600">
                Show all instructional resources
              </label>
            </div>
            <Button size="sm" variant="outline" disabled={!picked.length} onClick={draftFromPicked}>
              <Wand2 className="size-4" /> Draft {picked.length || ""} reference{picked.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={<FilePlus2 className="size-6" />}
            title={showAll ? "No instructional resources" : "No linked resources"}
            description={
              <>
                {showAll ? "Add books, files or links in the " : "Turn on “Show all instructional resources” to link some, or add them in the "}
                <a href={href("/resources")} className="font-medium text-[#1b2466] underline underline-offset-2">
                  Resource Library
                </a>
                .
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {candidates.map((r) => {
              const already = referencedIds.has(r.id);
              const linked = syllabus.resourceIds.includes(r.id);
              const inPlan = planSourceIds.has(r.id);
              const preview = formatReference(fromResource(r), style);
              const missing = missingReferenceFields(fromResource(r));
              return (
                <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Checkbox
                      id={`pick-${r.id}`}
                      className="mt-1"
                      disabled={already}
                      checked={already || picked.includes(r.id)}
                      onCheckedChange={(c) => setPicked((p) => (c ? [...p, r.id] : p.filter((x) => x !== r.id)))}
                      aria-label={`Draft a reference from ${r.title}`}
                    />
                    <label htmlFor={`pick-${r.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <p className="text-sm font-medium text-slate-800">{r.title || "Untitled resource"}</p>
                      <p className="mt-0.5 font-serif text-xs text-slate-600">
                        <Citation text={preview} />
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {already && <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">Already referenced</Badge>}
                        {inPlan && <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">Used in learning plan</Badge>}
                        <MissingChips fields={missing} />
                      </div>
                    </label>
                  </div>
                  <Button variant="ghost" size="sm" className={cn("shrink-0", linked ? "text-emerald-700" : "text-slate-600")} onClick={() => toggleLink(r, !linked)} aria-pressed={linked}>
                    {linked ? <Link2 className="size-4" /> : <Link2Off className="size-4" />}
                    {linked ? "Linked to syllabus" : "Link to syllabus"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {editing && (
        <ReferenceDialog key={editing.key} open onOpenChange={(o) => !o && setEditing(null)} initial={editing.ref} style={style} onSave={saveRef} />
      )}
      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove this reference?"
        description="It will no longer be printed in the syllabus. The resource itself stays in the Resource Library."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          setRefs((l) => l.filter((x) => x.id !== removeId));
          setRemoveId(null);
        }}
      />
    </div>
  );
}
