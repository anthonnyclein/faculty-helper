"use client";

import { useRef, useState } from "react";
import { Database, Download, FlaskConical, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { store, useAppData, useStoreState } from "@/lib/fah/store";
import { storageService } from "@/lib/fah/services/storage";
import { buildInitialData } from "@/lib/fah/seed";
import { emptyAppData } from "@/lib/fah/factories";
import type { AppData } from "@/lib/fah/types";
import { ConfirmDialog, Panel } from "../../common/ui";
import { downloadText, formatDateTime } from "../../common/utils";

const COLLECTIONS = ["syllabi", "libraryPOs", "resources", "people", "exams", "tos"] as const;

function validateBackup(v: unknown): { ok: true; data: AppData } | { ok: false; error: string } {
  if (!v || typeof v !== "object") return { ok: false, error: "The file is not a JSON object." };
  const d = v as Partial<AppData>;
  if (d.version !== 1) return { ok: false, error: `Unsupported backup version (${String(d.version)}). Expected version 1.` };
  for (const c of COLLECTIONS) {
    if (!Array.isArray(d[c])) return { ok: false, error: `The backup is missing the “${c}” list.` };
    if ((d[c] as unknown[]).some((r) => !r || typeof (r as { id?: unknown }).id !== "string")) return { ok: false, error: `A record in “${c}” has no id.` };
  }
  if (!d.settings || typeof d.settings !== "object") return { ok: false, error: "The backup has no settings." };
  if (!d.institutional || typeof d.institutional !== "object") return { ok: false, error: "The backup has no institutional configuration." };
  return { ok: true, data: d as AppData };
}

export function DataTab() {
  const data = useAppData();
  const { persist } = useStoreState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; data: AppData } | null>(null);
  const [confirmRemoveDemo, setConfirmRemoveDemo] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);

  const json = JSON.stringify(data);
  const sizeKb = Math.round(new Blob([json]).size / 1024);
  const demoCount = COLLECTIONS.reduce((a, c) => a + (data[c] as { isDemo?: boolean }[]).filter((r) => r.isDemo).length, 0);

  const exportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`faculty-academic-helper-backup-${stamp}.json`, JSON.stringify(data, null, 2));
    console.log("[settings] exported backup", sizeKb, "KB");
    toast.success("Backup downloaded.");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as unknown;
      const v = validateBackup(parsed);
      if (v.ok === true) setPendingImport({ name: f.name, data: v.data });
      else {
        const err = (v as { error: string }).error;
        console.error("[settings] import rejected", err);
        toast.error(`Cannot import: ${err}`);
      }
    } catch (e) {
      console.error("[settings] import parse failed", e);
      toast.error(`Cannot import: the file is not valid JSON (${e instanceof Error ? e.message : String(e)}).`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const persistNow = async (msg: string) => {
    try {
      await store.flush();
      toast.success(msg);
    } catch (e) {
      console.error("[settings] save after data action failed", e);
      toast.error(`Saving to browser storage failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Storage" description="Where your work is kept.">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#1b2466]/5 text-[#1b2466]">
            <Database className="size-5" />
          </span>
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Records are saved in <strong>this browser</strong> ({storageService.kind === "browser" ? "IndexedDB, with localStorage as a fallback" : "backend"}). They are not
              synchronized between devices or browsers. Clearing site data removes them — export a backup regularly.
            </p>
            <p className="text-xs text-slate-500">
              About {sizeKb.toLocaleString()} KB · {data.syllabi.length} syllabi · {data.exams.length} exams · {data.tos.length} TOS · {data.resources.length} resources ·{" "}
              {data.people.length} people · {data.libraryPOs.length} library outcomes
            </p>
            <p className="text-xs text-slate-500">
              Status: {persist.status === "error" ? <span className="font-semibold text-red-600">error — {persist.error}</span> : persist.status === "saving" ? "saving…" : "saved"}
              {persist.lastSavedAt && ` · last write ${formatDateTime(persist.lastSavedAt)}`}
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Backup" description="Export everything as a JSON file, or restore from a previous export.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportAll} className="bg-[#1b2466] hover:bg-[#262f7a]">
              <Download className="size-4" /> Export all data (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Import JSON…
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Import backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Importing replaces all current records after confirmation.</p>
        </Panel>

        <Panel title="Demonstration records" description={`${demoCount} demonstration record(s) currently stored.`}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!demoCount} onClick={() => setConfirmRemoveDemo(true)}>
              <FlaskConical className="size-4" /> Remove demonstration records
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                store.restoreDemoData();
                console.log("[settings] demo data restored");
                void persistNow("Demonstration records restored (existing records were kept).");
              }}
            >
              <RotateCcw className="size-4" /> Restore demonstration records
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Removing only affects records labeled “Demo record”. Your own records are never touched.</p>
        </Panel>
      </div>

      <Panel title="Reset" description="Start over with the initial setup.">
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-red-900">
            Deletes every syllabus, exam, TOS, resource and person, and restores default settings, the reference template wording, the template outcomes and the demonstration
            records. This cannot be undone — export a backup first.
          </p>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => setResetStep(1)}>
            <Trash2 className="size-4" /> Reset everything
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={!!pendingImport}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title="Replace all data with this backup?"
        description={
          pendingImport && (
            <div className="space-y-1">
              <p>
                <strong>{pendingImport.name}</strong> contains {pendingImport.data.syllabi.length} syllabi, {pendingImport.data.exams.length} exams, {pendingImport.data.tos.length} TOS
                and {pendingImport.data.resources.length} resources.
              </p>
              <p>All current records in this browser will be replaced.</p>
            </div>
          )
        }
        confirmLabel="Replace data"
        destructive
        onConfirm={() => {
          if (!pendingImport) return;
          store.replaceAll(pendingImport.data);
          console.log("[settings] imported backup", pendingImport.name);
          setPendingImport(null);
          void persistNow("Backup imported.");
        }}
      />

      <ConfirmDialog
        open={confirmRemoveDemo}
        onOpenChange={setConfirmRemoveDemo}
        title="Remove demonstration records?"
        description={`${demoCount} record(s) labeled as demonstration data will be deleted. Records you created are kept. You can restore the demonstration records later.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          store.removeDemoData();
          console.log("[settings] demo data removed");
          void persistNow("Demonstration records removed.");
        }}
      />

      <ConfirmDialog
        open={resetStep === 1}
        onOpenChange={(o) => !o && setResetStep(0)}
        title="Reset everything?"
        description="All your syllabi, exams, tables of specifications, resources and people will be deleted from this browser."
        confirmLabel="Continue"
        destructive
        onConfirm={() => setTimeout(() => setResetStep(2), 50)}
      />
      <ConfirmDialog
        open={resetStep === 2}
        onOpenChange={(o) => !o && setResetStep(0)}
        title="Are you absolutely sure?"
        description="This is the final confirmation. The data cannot be recovered unless you exported a backup."
        confirmLabel="Yes, delete everything"
        destructive
        onConfirm={() => {
          store.replaceAll(buildInitialData(emptyAppData()));
          setResetStep(0);
          console.log("[settings] all data reset");
          void persistNow("All data was reset to the initial setup.");
        }}
      />
    </div>
  );
}
