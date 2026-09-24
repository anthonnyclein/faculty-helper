"use client";
// Client application store: in-memory state + persistence through the storage service.
// Components read with useAppData(); edit records through useRecordDraft() (explicit Save + autosave).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { storageService } from "./services/storage";
import { emptyAppData, DEFAULT_SETTINGS } from "./factories";
import { buildInitialData } from "./seed";
import { examSignature } from "./calc";
import { nowIso } from "./ids";
import type { AppData, AppSettings, BaseRecord, CollectionKey, Exam, InstitutionalConfig } from "./types";

type RecordOf<K extends CollectionKey> = AppData[K][number];

export type PersistStatus = "idle" | "saving" | "saved" | "error";

interface StoreState {
  ready: boolean;
  data: AppData;
  persist: { status: PersistStatus; lastSavedAt?: string; error?: string };
}

let state: StoreState = { ready: false, data: emptyAppData(), persist: { status: "idle" } };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: Promise<void> | null = null;
let initStarted = false;
const examSigs = new Map<string, string>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  emit();
}

function setData(data: AppData) {
  state = { ...state, data };
  emit();
  schedulePersist();
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  setState({ persist: { ...state.persist, status: "saving" } });
  saveTimer = setTimeout(() => void flush(), 250);
}

async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const snapshot = state.data;
  pendingSave = (async () => {
    try {
      await storageService.save(snapshot);
      setState({ persist: { status: "saved", lastSavedAt: nowIso() } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[store] persist failed", e);
      setState({ persist: { status: "error", error: msg, lastSavedAt: state.persist.lastSavedAt } });
      throw e;
    }
  })();
  return pendingSave;
}

/** Fill in fields added in newer versions so old saved data keeps working. */
function migrate(d: AppData): AppData {
  const base = emptyAppData();
  return {
    ...base,
    ...d,
    settings: { ...DEFAULT_SETTINGS, ...d.settings, examWeeks: { ...DEFAULT_SETTINGS.examWeeks, ...d.settings?.examWeeks } },
    institutional: { ...base.institutional, ...d.institutional },
  };
}

export const store = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async init() {
    if (initStarted) return;
    initStarted = true;
    try {
      const loaded = await storageService.load();
      const data = loaded ? migrate(loaded) : buildInitialData(emptyAppData());
      data.exams.forEach((e) => examSigs.set(e.id, examSignature(e)));
      state = { ...state, ready: true, data };
      emit();
      if (!loaded) await flush();
      console.log("[store] ready", {
        syllabi: data.syllabi.length,
        exams: data.exams.length,
        tos: data.tos.length,
        resources: data.resources.length,
        restored: !!loaded,
      });
    } catch (e) {
      console.error("[store] init failed", e);
      setState({ ready: true, persist: { status: "error", error: e instanceof Error ? e.message : String(e) } });
    }
  },

  flush,

  upsert<K extends CollectionKey>(key: K, record: RecordOf<K>) {
    const list = state.data[key] as unknown as BaseRecord[];
    const rec = { ...(record as BaseRecord), updatedAt: nowIso() } as BaseRecord;
    if (key === "exams") {
      const ex = rec as unknown as Exam;
      const sig = examSignature(ex);
      const prev = examSigs.get(ex.id);
      const existing = (state.data.exams as Exam[]).find((e) => e.id === ex.id);
      if (existing && prev !== undefined && prev !== sig) ex.revision = Math.max(existing.revision, ex.revision) + 1;
      examSigs.set(ex.id, sig);
    }
    const idx = list.findIndex((r) => r.id === rec.id);
    const next = idx >= 0 ? list.map((r, i) => (i === idx ? rec : r)) : [rec, ...list];
    setData({ ...state.data, [key]: next } as AppData);
    return rec as RecordOf<K>;
  },

  upsertMany<K extends CollectionKey>(key: K, records: RecordOf<K>[]) {
    records.forEach((r) => store.upsert(key, r));
  },

  remove<K extends CollectionKey>(key: K, id: string) {
    const list = state.data[key] as unknown as BaseRecord[];
    setData({ ...state.data, [key]: list.filter((r) => r.id !== id) } as AppData);
  },

  get<K extends CollectionKey>(key: K, id: string | undefined): RecordOf<K> | undefined {
    if (!id) return undefined;
    return (state.data[key] as unknown as BaseRecord[]).find((r) => r.id === id) as RecordOf<K> | undefined;
  },

  setSettings(patch: Partial<AppSettings>) {
    setData({ ...state.data, settings: { ...state.data.settings, ...patch } });
  },

  setInstitutional(cfg: InstitutionalConfig) {
    setData({ ...state.data, institutional: cfg });
  },

  replaceAll(data: AppData) {
    examSigs.clear();
    data.exams.forEach((e) => examSigs.set(e.id, examSignature(e)));
    setData(migrate(data));
  },

  removeDemoData() {
    const d = state.data;
    const strip = <T extends BaseRecord>(l: T[]) => l.filter((r) => !r.isDemo);
    setData({
      ...d,
      syllabi: strip(d.syllabi),
      libraryPOs: strip(d.libraryPOs),
      resources: strip(d.resources),
      people: strip(d.people),
      exams: strip(d.exams),
      tos: strip(d.tos),
    });
  },

  restoreDemoData() {
    const d = state.data;
    const demo = buildInitialData(emptyAppData());
    const merge = <T extends BaseRecord>(cur: T[], add: T[]) => [...add.filter((a) => a.isDemo && !cur.some((c) => c.id === a.id)), ...cur];
    demo.exams.forEach((e) => examSigs.set(e.id, examSignature(e)));
    setData({
      ...d,
      syllabi: merge(d.syllabi, demo.syllabi),
      libraryPOs: merge(d.libraryPOs, demo.libraryPOs),
      resources: merge(d.resources, demo.resources),
      people: merge(d.people, demo.people),
      exams: merge(d.exams, demo.exams),
      tos: merge(d.tos, demo.tos),
    });
  },
};

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function useStoreState(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useAppData(): AppData {
  return useStoreState().data;
}

export type DraftStatus = "saved" | "unsaved" | "saving" | "error";

/**
 * Editable working copy of a record with explicit Save, optional autosave, and a clear
 * saved/unsaved indicator. Nothing reaches storage until save() (or autosave) runs.
 */
export function useRecordDraft<K extends CollectionKey>(key: K, id: string | undefined) {
  const { data, ready } = useStoreState();
  const settings = data.settings;
  const record = useMemo(
    () => (id ? ((data[key] as unknown as BaseRecord[]).find((r) => r.id === id) as RecordOf<K> | undefined) : undefined),
    [data, key, id]
  );
  const [draft, setDraftState] = useState<RecordOf<K> | undefined>(record);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("saved");
  const [error, setError] = useState<string | undefined>();
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(record?.updatedAt);
  const loadedId = useRef<string | undefined>(undefined);
  const dirtyRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Load when the record id changes, or sync external changes while there are no local edits.
  useEffect(() => {
    if (!record) return;
    if (loadedId.current !== record.id || !dirtyRef.current) {
      loadedId.current = record.id;
      setDraftState(record);
      setLastSavedAt(record.updatedAt);
      if (!dirtyRef.current) setStatus("saved");
    }
  }, [record]);

  const setDraft = useCallback((updater: RecordOf<K> | ((d: RecordOf<K>) => RecordOf<K>)) => {
    setDraftState((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? (updater as (d: RecordOf<K>) => RecordOf<K>)(prev) : updater;
      return next;
    });
    dirtyRef.current = true;
    setDirty(true);
    setStatus("unsaved");
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (!d) return false;
    setStatus("saving");
    try {
      const saved = store.upsert(key, d);
      await store.flush();
      dirtyRef.current = false;
      setDirty(false);
      setDraftState(saved);
      setLastSavedAt((saved as BaseRecord).updatedAt);
      setStatus("saved");
      setError(undefined);
      console.log(`[draft] saved ${key}/${(saved as BaseRecord).id}`);
      return true;
    } catch (e) {
      console.error(`[draft] save failed ${key}`, e);
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [key]);

  const discard = useCallback(() => {
    dirtyRef.current = false;
    setDirty(false);
    setDraftState(record);
    setStatus("saved");
  }, [record]);

  // Autosave (debounced) when enabled in settings.
  useEffect(() => {
    if (!settings.autosave || !dirty) return;
    const t = setTimeout(() => void save(), 2500);
    return () => clearTimeout(t);
  }, [draft, dirty, settings.autosave, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return { ready, record, draft, setDraft, dirty, status, error, lastSavedAt, save, discard, autosave: settings.autosave };
}
