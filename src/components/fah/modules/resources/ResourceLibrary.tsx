"use client";

import { useMemo, useRef, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  FileType2,
  Globe,
  Library,
  Link2,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  ScanText,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { store, useAppData } from "@/lib/fah/store";
import { nowIso, uid } from "@/lib/fah/ids";
import type { Resource, ResourceStatus, ResourceType } from "@/lib/fah/types";
import {
  MAX_CONTENT_CHARS,
  STATUS_INFO,
  extractDocx,
  extractPdf,
  extractTextFile,
  extractUrl,
  fromPastedText,
  type ExtractionResult,
} from "@/lib/fah/services/extraction";
import { DemoBadge, EmptyState, Field, PageHeader, Panel } from "../../common/ui";
import { href } from "../../common/router";
import { formatDate } from "../../common/utils";

const TYPE_META: Record<ResourceType, { label: string; icon: ComponentType<{ className?: string }> }> = {
  pdf: { label: "PDF", icon: FileText },
  docx: { label: "Word (DOCX)", icon: FileType2 },
  text: { label: "Text", icon: NotebookPen },
  url: { label: "Website", icon: Globe },
  book: { label: "Book / reference", icon: BookMarked },
};

const PURPOSE_LABEL: Record<Resource["purpose"], string> = {
  instructional: "Instructional resource",
  "exam-template": "Exam template",
  "institutional-template": "Institutional template",
};

const STATUS_STYLE: Record<ResourceStatus, string> = {
  processing: "border-slate-300 bg-slate-50 text-slate-700",
  extracted: "border-emerald-300 bg-emerald-50 text-emerald-800",
  "metadata-only": "border-sky-300 bg-sky-50 text-sky-800",
  "needs-ocr": "border-amber-300 bg-amber-50 text-amber-900",
  failed: "border-red-300 bg-red-50 text-red-800",
  inaccessible: "border-orange-300 bg-orange-50 text-orange-900",
};

function StatusBadge({ status }: { status: ResourceStatus }) {
  const icon =
    status === "processing" ? (
      <Loader2 className="size-3 animate-spin" />
    ) : status === "extracted" ? (
      <CheckCircle2 className="size-3" />
    ) : status === "metadata-only" ? (
      <BookOpen className="size-3" />
    ) : status === "needs-ocr" ? (
      <ScanText className="size-3" />
    ) : status === "failed" ? (
      <XCircle className="size-3" />
    ) : (
      <AlertTriangle className="size-3" />
    );
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      {icon} {STATUS_INFO[status].label}
    </Badge>
  );
}

interface Meta {
  title: string;
  authors: string;
  year: string;
  publisher: string;
  edition: string;
  doi: string;
  url: string;
  notes: string;
  purpose: Resource["purpose"];
}

const EMPTY_META: Meta = { title: "", authors: "", year: "", publisher: "", edition: "", doi: "", url: "", notes: "", purpose: "instructional" };

function MetaFields({ meta, onChange, showUrl = true, idPrefix }: { meta: Meta; onChange: (m: Meta) => void; showUrl?: boolean; idPrefix: string }) {
  const f = (k: keyof Meta, label: string, opts: { required?: boolean; hint?: string; className?: string; placeholder?: string } = {}) => (
    <Field label={label} htmlFor={`${idPrefix}-${k}`} required={opts.required} hint={opts.hint} className={opts.className}>
      <Input id={`${idPrefix}-${k}`} value={meta[k]} placeholder={opts.placeholder} onChange={(e) => onChange({ ...meta, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {f("title", "Title", { className: "sm:col-span-2", hint: "Leave blank for files to use the document's own title if it has one." })}
      {f("authors", "Authors", { placeholder: "Surname, A. B., & Surname, C." })}
      {f("year", "Year")}
      {f("publisher", "Publisher")}
      {f("edition", "Edition", { placeholder: "e.g. 3" })}
      {f("doi", "DOI")}
      {showUrl && f("url", "URL")}
      <Field label="Notes" htmlFor={`${idPrefix}-notes`} className="sm:col-span-2">
        <Textarea id={`${idPrefix}-notes`} rows={2} value={meta.notes} onChange={(e) => onChange({ ...meta, notes: e.target.value })} />
      </Field>
    </div>
  );
}

function PurposeSelect({ value, onChange, id }: { value: Resource["purpose"]; onChange: (v: Resource["purpose"]) => void; id: string }) {
  return (
    <Field
      label="Purpose"
      htmlFor={id}
      hint={
        value === "institutional-template"
          ? "Institutional templates define required wording and format. They are references for layout, not course content."
          : value === "exam-template"
            ? "Exam templates show the expected exam format. They can be selected when building an exam."
            : "Instructional resources feed course content — lessons, references and AI suggestions."
      }
    >
      <Select value={value} onValueChange={(v) => onChange(v as Resource["purpose"])}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="instructional">{PURPOSE_LABEL.instructional}</SelectItem>
          <SelectItem value="exam-template">{PURPOSE_LABEL["exam-template"]}</SelectItem>
          <SelectItem value="institutional-template">{PURPOSE_LABEL["institutional-template"]}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Add resource                                                        */
/* ------------------------------------------------------------------ */

type AddTab = "pdf" | "docx" | "text" | "url" | "book";

function AddResource({ onDone }: { onDone?: () => void }) {
  const [tab, setTab] = useState<AddTab>("pdf");
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMeta(EMPTY_META);
    setFile(null);
    setPasted("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const baseRecord = (type: ResourceType, extra: Partial<Resource> = {}): Resource => {
    const t = nowIso();
    return {
      id: uid("res"),
      createdAt: t,
      updatedAt: t,
      title: meta.title.trim(),
      type,
      purpose: meta.purpose,
      authors: meta.authors.trim(),
      year: meta.year.trim(),
      publisher: meta.publisher.trim(),
      edition: meta.edition.trim(),
      doi: meta.doi.trim(),
      url: meta.url.trim(),
      status: "processing",
      statusMessage: STATUS_INFO.processing.explanation,
      content: "",
      wordCount: 0,
      linkedSyllabusIds: [],
      linkedExamIds: [],
      notes: meta.notes.trim(),
      ...extra,
    };
  };

  const applyResult = (rec: Resource, r: ExtractionResult & { pageTitle?: string }) => {
    const cur = store.get("resources", rec.id) ?? rec;
    const next: Resource = {
      ...cur,
      status: r.status,
      statusMessage: r.statusMessage,
      content: r.content,
      wordCount: r.wordCount,
      pageCount: r.pageCount,
      title: cur.title || r.meta?.title || r.pageTitle || cur.fileName || cur.url || "Untitled resource",
      authors: cur.authors || r.meta?.authors || "",
    };
    store.upsert("resources", next);
    console.log("[resources] processed", rec.id, r.status, { words: r.wordCount, pages: r.pageCount });
    if (r.status === "extracted") toast.success(`“${next.title}” is ready: ${r.wordCount.toLocaleString()} words${r.truncated ? " (shortened)" : ""}.`);
    else toast.warning(`“${next.title}”: ${STATUS_INFO[r.status].label}. See the explanation in the list.`);
  };

  const submit = async () => {
    try {
      if (tab === "pdf" || tab === "docx" || (tab === "text" && file)) {
        if (!file) {
          toast.error("Choose a file first.");
          return;
        }
        const type: ResourceType = tab === "text" ? "text" : tab;
        const rec = baseRecord(type, { fileName: file.name, fileSize: file.size });
        store.upsert("resources", rec);
        setBusy(true);
        console.log("[resources] processing file", file.name, type);
        const r = tab === "pdf" ? await extractPdf(file) : tab === "docx" ? await extractDocx(file) : await extractTextFile(file);
        applyResult(rec, r);
      } else if (tab === "text") {
        if (!pasted.trim()) {
          toast.error("Paste some text or upload a .txt / .md file.");
          return;
        }
        if (!meta.title.trim()) {
          toast.error("Enter a title for the pasted text.");
          return;
        }
        const rec = baseRecord("text");
        store.upsert("resources", rec);
        applyResult(rec, fromPastedText(pasted, "Text pasted by the user."));
      } else if (tab === "url") {
        const url = meta.url.trim();
        if (!/^https?:\/\//i.test(url)) {
          toast.error("Enter a web address starting with http:// or https://.");
          return;
        }
        const rec = baseRecord("url");
        store.upsert("resources", rec);
        setBusy(true);
        const r = await extractUrl(url);
        applyResult(rec, r);
      } else {
        if (!meta.title.trim()) {
          toast.error("Enter the book or reference title.");
          return;
        }
        const rec = baseRecord("book", {
          status: "metadata-only",
          statusMessage: STATUS_INFO["metadata-only"].explanation,
        });
        store.upsert("resources", rec);
        console.log("[resources] book entry added", rec.id);
        toast.success("Bibliographic entry added.");
      }
      reset();
      onDone?.();
    } catch (e) {
      console.error("[resources] add failed", e);
      toast.error(`Could not add the resource: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (accept: string, label: string) => (
    <Field label={label} htmlFor="res-file" hint="Files are processed in your browser. Only the extracted text is stored, not the file itself.">
      <label
        htmlFor="res-file"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-600 transition hover:border-[#1b2466]/50 hover:bg-white"
      >
        <Upload className="size-5 text-[#1b2466]" />
        {file ? (
          <span>
            <strong>{file.name}</strong> · {(file.size / 1024).toFixed(0)} KB
          </span>
        ) : (
          <span>Click to choose a file</span>
        )}
      </label>
      <input
        ref={fileRef}
        id="res-file"
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </Field>
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v as AddTab);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }}
    >
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1">
        {(["pdf", "docx", "text", "url", "book"] as AddTab[]).map((t) => {
          const Icon = TYPE_META[t].icon;
          const label = { pdf: "PDF upload", docx: "DOCX upload", text: "Text", url: "Website link", book: "Book / reference" }[t];
          return (
            <TabsTrigger key={t} value={t} className="gap-1.5">
              <Icon className="size-4" /> {label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <TabsContent value="pdf" className="mt-0">
            {fileInput("application/pdf,.pdf", "PDF file")}
            <p className="mt-2 text-xs text-slate-500">Scanned PDFs without a text layer are flagged as needing OCR — you can then enter the text manually.</p>
          </TabsContent>
          <TabsContent value="docx" className="mt-0">
            {fileInput(".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word document (.docx)")}
          </TabsContent>
          <TabsContent value="text" className="mt-0 space-y-3">
            {fileInput(".txt,.md,text/plain,text/markdown", "Text file (.txt or .md) — optional")}
            <Field label="…or paste text" htmlFor="res-paste" hint={file ? "The uploaded file will be used instead of pasted text." : undefined}>
              <Textarea id="res-paste" rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste lecture notes, chapter excerpts or other readable content…" />
            </Field>
          </TabsContent>
          <TabsContent value="url" className="mt-0 space-y-2">
            <Field label="Web address" htmlFor="res-url" required hint="The page is fetched by this app's server and converted to readable text.">
              <Input id="res-url" type="url" placeholder="https://…" value={meta.url} onChange={(e) => setMeta({ ...meta, url: e.target.value })} />
            </Field>
            <p className="text-xs text-slate-500">
              Pages that require sign-in, block automated access or are built entirely with JavaScript may not be readable. Links to PDF files must be downloaded and uploaded.
            </p>
          </TabsContent>
          <TabsContent value="book" className="mt-0">
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <strong>Bibliographic information only — not analyzed source material.</strong> The entry can be cited in syllabi. Add text later (“Enter text manually”) to
              enable AI use.
            </div>
          </TabsContent>
          <PurposeSelect id="res-purpose" value={meta.purpose} onChange={(purpose) => setMeta({ ...meta, purpose })} />
          <Button onClick={() => void submit()} disabled={busy} className="w-full bg-[#1b2466] hover:bg-[#262f7a]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {busy ? "Processing…" : tab === "book" ? "Add bibliographic entry" : tab === "url" ? "Fetch and add link" : "Add and process"}
          </Button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-[#fbfaf6] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Bibliographic details</p>
          <MetaFields idPrefix="add" meta={meta} onChange={setMeta} showUrl={tab !== "url"} />
        </div>
      </div>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

export function ResourceLibrary() {
  const data = useAppData();
  const [showAdd, setShowAdd] = useState(data.resources.length === 0);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState<"all" | ResourceType>("all");
  const [fStatus, setFStatus] = useState<"all" | "readable" | "not-readable">("all");
  const [fPurpose, setFPurpose] = useState<"all" | Resource["purpose"]>("all");
  const [view, setView] = useState<Resource | null>(null);
  const [edit, setEdit] = useState<{ r: Resource; meta: Meta } | null>(null);
  const [manual, setManual] = useState<{ r: Resource; text: string } | null>(null);
  const [link, setLink] = useState<Resource | null>(null);
  const [del, setDel] = useState<Resource | null>(null);

  const linkedSyl = (r: Resource) => data.syllabi.filter((s) => s.resourceIds.includes(r.id) || r.linkedSyllabusIds.includes(s.id));
  const linkedEx = (r: Resource) => data.exams.filter((e) => e.resourceIds.includes(r.id) || r.linkedExamIds.includes(e.id) || e.templateResourceId === r.id);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.resources
      .filter((r) => fType === "all" || r.type === fType)
      .filter((r) => fPurpose === "all" || r.purpose === fPurpose)
      .filter((r) => (fStatus === "all" ? true : fStatus === "readable" ? r.status === "extracted" : r.status !== "extracted"))
      .filter((r) => !n || `${r.title} ${r.authors} ${r.publisher} ${r.url} ${r.fileName ?? ""}`.toLowerCase().includes(n));
  }, [data.resources, q, fType, fStatus, fPurpose]);

  const saveEdit = () => {
    if (!edit) return;
    if (!edit.meta.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const m = edit.meta;
    store.upsert("resources", {
      ...edit.r,
      title: m.title.trim(),
      authors: m.authors.trim(),
      year: m.year.trim(),
      publisher: m.publisher.trim(),
      edition: m.edition.trim(),
      doi: m.doi.trim(),
      url: m.url.trim(),
      notes: m.notes.trim(),
      purpose: m.purpose,
    });
    console.log("[resources] metadata saved", edit.r.id);
    toast.success("Details saved.");
    setEdit(null);
  };

  const saveManual = () => {
    if (!manual) return;
    const r = fromPastedText(manual.text, "Manually entered text.");
    if (r.status !== "extracted") {
      toast.error("Enter some text first.");
      return;
    }
    store.upsert("resources", {
      ...manual.r,
      content: r.content,
      wordCount: r.wordCount,
      status: "extracted",
      statusMessage: r.statusMessage,
      notes: manual.r.notes.includes("Manually entered text") ? manual.r.notes : [manual.r.notes, "Manually entered text"].filter(Boolean).join(" · "),
    });
    console.log("[resources] manual text saved", manual.r.id, r.wordCount);
    toast.success(`Text saved (${r.wordCount.toLocaleString()} words).`);
    setManual(null);
  };

  const toggleSyllabus = (r: Resource, sylId: string, on: boolean) => {
    const cur = store.get("resources", r.id) ?? r;
    const syl = store.get("syllabi", sylId);
    store.upsert("resources", {
      ...cur,
      linkedSyllabusIds: on ? [...new Set([...cur.linkedSyllabusIds, sylId])] : cur.linkedSyllabusIds.filter((x) => x !== sylId),
    });
    if (syl) {
      store.upsert("syllabi", {
        ...syl,
        resourceIds: on ? [...new Set([...syl.resourceIds, r.id])] : syl.resourceIds.filter((x) => x !== r.id),
      });
    }
    console.log("[resources] link syllabus", r.id, sylId, on);
  };

  const toggleExam = (r: Resource, examId: string, on: boolean) => {
    const cur = store.get("resources", r.id) ?? r;
    const ex = store.get("exams", examId);
    store.upsert("resources", {
      ...cur,
      linkedExamIds: on ? [...new Set([...cur.linkedExamIds, examId])] : cur.linkedExamIds.filter((x) => x !== examId),
    });
    if (ex) {
      store.upsert("exams", {
        ...ex,
        resourceIds: on ? [...new Set([...ex.resourceIds, r.id])] : ex.resourceIds.filter((x) => x !== r.id),
      });
    }
    console.log("[resources] link exam", r.id, examId, on);
  };

  const doDelete = (r: Resource) => {
    data.syllabi
      .filter((s) => s.resourceIds.includes(r.id))
      .forEach((s) => store.upsert("syllabi", { ...s, resourceIds: s.resourceIds.filter((x) => x !== r.id) }));
    data.exams
      .filter((e) => e.resourceIds.includes(r.id) || e.templateResourceId === r.id)
      .forEach((e) =>
        store.upsert("exams", {
          ...e,
          resourceIds: e.resourceIds.filter((x) => x !== r.id),
          templateResourceId: e.templateResourceId === r.id ? undefined : e.templateResourceId,
        })
      );
    store.remove("resources", r.id);
    console.log("[resources] deleted", r.id);
    toast.success(`“${r.title}” deleted.`);
    setDel(null);
  };

  const liveLink = link ? (data.resources.find((x) => x.id === link.id) ?? link) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Sources"
        title="Resource Library"
        description="Upload course materials or record bibliographic references. Only resources with readable, extracted text are sent to AI; bibliographic-only entries can be cited but are never treated as analyzed content."
        actions={
          <Button onClick={() => setShowAdd((v) => !v)} className="bg-[#1b2466] hover:bg-[#262f7a]">
            <Plus className="size-4" /> {showAdd ? "Hide add form" : "Add resource"}
          </Button>
        }
      />

      {showAdd && (
        <Panel title="Add a resource" className="mb-6">
          <AddResource />
        </Panel>
      )}

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search resources" placeholder="Search title, author, publisher…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={fType} onValueChange={(v) => setFType(v as typeof fType)}>
          <SelectTrigger aria-label="Filter by type" className="w-full md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(TYPE_META) as ResourceType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={(v) => setFStatus(v as typeof fStatus)}>
          <SelectTrigger aria-label="Filter by content" className="w-full md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any content status</SelectItem>
            <SelectItem value="readable">Readable content</SelectItem>
            <SelectItem value="not-readable">No readable content</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fPurpose} onValueChange={(v) => setFPurpose(v as typeof fPurpose)}>
          <SelectTrigger aria-label="Filter by purpose" className="w-full md:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purposes</SelectItem>
            <SelectItem value="instructional">{PURPOSE_LABEL.instructional}</SelectItem>
            <SelectItem value="exam-template">{PURPOSE_LABEL["exam-template"]}</SelectItem>
            <SelectItem value="institutional-template">{PURPOSE_LABEL["institutional-template"]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Library className="size-6" />}
          title={data.resources.length ? "No resources match the filters" : "No resources yet"}
          description="Upload PDFs, Word documents or text, add a website link, or record a book reference."
          action={
            !showAdd && (
              <Button variant="outline" onClick={() => setShowAdd(true)}>
                <Plus className="size-4" /> Add resource
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const Icon = TYPE_META[r.type].icon;
            const syl = linkedSyl(r);
            const ex = linkedEx(r);
            const readable = r.status === "extracted";
            const biblio = [r.authors, r.year && `(${r.year})`, r.edition && `${r.edition} ed.`, r.publisher].filter(Boolean).join(" ");
            return (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", readable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-semibold text-[#1b2466]">{r.title || "Untitled resource"}</h3>
                      {r.isDemo && <DemoBadge />}
                    </div>
                    <p className="text-sm text-slate-600">{biblio || <span className="italic text-slate-400">No bibliographic details</span>}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <Badge variant="outline" className="text-slate-600">
                        {TYPE_META[r.type].label}
                      </Badge>
                      <Badge variant="outline" className="text-slate-600">
                        {PURPOSE_LABEL[r.purpose]}
                      </Badge>
                      <StatusBadge status={r.status} />
                      <span className={cn("font-medium", readable ? "text-emerald-700" : "text-slate-500")}>
                        {readable ? `Readable content · ${r.wordCount.toLocaleString()} words${r.pageCount ? ` · ${r.pageCount} pages` : ""}` : "Bibliographic only — no readable content"}
                      </span>
                    </div>
                    {r.status !== "extracted" && (
                      <p className={cn("rounded-lg border px-2.5 py-1.5 text-xs", STATUS_STYLE[r.status])}>{r.statusMessage || STATUS_INFO[r.status].explanation}</p>
                    )}
                    {r.status === "extracted" && r.statusMessage && <p className="text-xs text-slate-500">{r.statusMessage}</p>}
                    {(r.url || r.doi || r.fileName) && (
                      <p className="truncate text-xs text-slate-500">
                        {r.fileName && <span>File: {r.fileName} · </span>}
                        {r.doi && <span>DOI: {r.doi} · </span>}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-[#1b2466] underline-offset-2 hover:underline">
                            {r.url}
                          </a>
                        )}
                      </p>
                    )}
                    {r.notes && <p className="text-xs italic text-slate-500">{r.notes}</p>}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {syl.map((s) => (
                        <a key={s.id} href={href(`/syllabi/${s.id}`)} className="rounded-full bg-[#1b2466]/5 px-2 py-0.5 text-xs font-medium text-[#1b2466] hover:bg-[#1b2466]/10">
                          Syllabus: {s.courseCode || s.descriptiveTitle || "Untitled"}
                        </a>
                      ))}
                      {ex.map((e) => (
                        <a key={e.id} href={href(`/exams/${e.id}`)} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200">
                          Exam: {e.courseCode} {e.title || e.term}
                        </a>
                      ))}
                      {!syl.length && !ex.length && <span className="text-xs text-slate-400">Not linked to any syllabus or exam</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 md:w-44 md:flex-col md:items-stretch">
                    {readable && (
                      <Button variant="outline" size="sm" onClick={() => setView(r)}>
                        <Eye className="size-4" /> View content
                      </Button>
                    )}
                    <Button variant={readable ? "ghost" : "outline"} size="sm" onClick={() => setManual({ r, text: r.content })}>
                      <NotebookPen className="size-4" /> {readable ? "Replace text" : "Enter text manually"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEdit({
                          r,
                          meta: { title: r.title, authors: r.authors, year: r.year, publisher: r.publisher, edition: r.edition, doi: r.doi, url: r.url, notes: r.notes, purpose: r.purpose },
                        })
                      }
                    >
                      <Pencil className="size-4" /> Edit details
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setLink(r)}>
                      <Link2 className="size-4" /> Link / unlink
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDel(r)}>
                      <XCircle className="size-4" /> Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-right text-[11px] text-slate-400">Added {formatDate(r.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* View content */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{view?.title}</DialogTitle>
            <DialogDescription>
              {view?.wordCount.toLocaleString()} words{view?.pageCount ? ` · ${view.pageCount} pages` : ""}. This is the exact text available to AI features.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-[#fbfaf6] p-4 text-sm leading-relaxed text-slate-700" tabIndex={0}>
            {view?.content}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit metadata */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit resource details</DialogTitle>
            <DialogDescription>Bibliographic details are used when citing this resource. Syllabi keep the reference text they already copied.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <MetaFields idPrefix="edit" meta={edit.meta} onChange={(meta) => setEdit({ ...edit, meta })} />
              <PurposeSelect id="edit-purpose" value={edit.meta.purpose} onChange={(purpose) => setEdit({ ...edit, meta: { ...edit.meta, purpose } })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} className="bg-[#1b2466] hover:bg-[#262f7a]">
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual text */}
      <Dialog open={!!manual} onOpenChange={(o) => !o && setManual(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Enter text manually</DialogTitle>
            <DialogDescription>
              Paste or type the readable content of “{manual?.r.title}”. It will be marked as extracted (manually entered text) and can then be used by AI features.
            </DialogDescription>
          </DialogHeader>
          {manual && (
            <Field
              label="Text content"
              htmlFor="manual-text"
              hint={`${manual.text.trim() ? manual.text.trim().split(/\s+/).length.toLocaleString() : 0} words${manual.text.length > MAX_CONTENT_CHARS ? ` — longer than ${MAX_CONTENT_CHARS.toLocaleString()} characters; the rest will be cut off` : ""}`}
            >
              <Textarea id="manual-text" rows={14} value={manual.text} onChange={(e) => setManual({ ...manual, text: e.target.value })} className="max-h-[50vh]" />
            </Field>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManual(null)}>
              Cancel
            </Button>
            <Button onClick={saveManual} className="bg-[#1b2466] hover:bg-[#262f7a]">
              Save text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link */}
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Link “{liveLink?.title}”</DialogTitle>
            <DialogDescription>Linked resources are offered as sources in the syllabus and exam editors. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          {liveLink && (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Syllabi</legend>
                {data.syllabi.length === 0 && <p className="text-xs text-slate-400">No syllabi yet.</p>}
                <div className="space-y-2">
                  {data.syllabi.map((s) => {
                    const on = s.resourceIds.includes(liveLink.id) || liveLink.linkedSyllabusIds.includes(s.id);
                    const id = `lnk-s-${s.id}`;
                    return (
                      <label key={s.id} htmlFor={id} className="flex items-start gap-2 text-sm">
                        <Checkbox id={id} checked={on} onCheckedChange={(v) => toggleSyllabus(liveLink, s.id, v === true)} />
                        <span>
                          <strong>{s.courseCode || "Untitled"}</strong> {s.descriptiveTitle}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Exams</legend>
                {data.exams.length === 0 && <p className="text-xs text-slate-400">No exams yet.</p>}
                <div className="space-y-2">
                  {data.exams.map((e) => {
                    const on = e.resourceIds.includes(liveLink.id) || liveLink.linkedExamIds.includes(e.id);
                    const id = `lnk-e-${e.id}`;
                    return (
                      <label key={e.id} htmlFor={id} className="flex items-start gap-2 text-sm">
                        <Checkbox id={id} checked={on} onCheckedChange={(v) => toggleExam(liveLink, e.id, v === true)} />
                        <span>
                          <strong>{e.courseCode || "—"}</strong> {e.title || e.term}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
          {liveLink && liveLink.status !== "extracted" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This resource has no readable content. It can be cited, but it will be excluded from AI requests until text is added.
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => setLink(null)} className="bg-[#1b2466] hover:bg-[#262f7a]">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{del?.title}”?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>The resource and its extracted text will be removed permanently.</p>
                {del && (linkedSyl(del).length > 0 || linkedEx(del).length > 0) && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    It is linked to {linkedSyl(del).length} syllab{linkedSyl(del).length === 1 ? "us" : "i"} and {linkedEx(del).length} exam(s). The links will be removed.
                    References already copied into a syllabus stay as written.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => del && doDelete(del)}>
              Delete resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
