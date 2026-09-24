"use client";
// Replaceable data-storage service. The prototype persists to the browser (IndexedDB, with
// localStorage fallback). A backend implementation only needs to satisfy StorageService.

import type { AppData, AppSession } from "../types";

export interface StorageService {
  readonly kind: "browser" | "backend";
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "faculty-academic-helper";
const STORE = "kv";
const KEY = "app-data-v1";
const LS_KEY = "fah:app-data-v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class BrowserStorageService implements StorageService {
  readonly kind = "browser" as const;
  private useIdb = typeof indexedDB !== "undefined";

  async load(): Promise<AppData | null> {
    try {
      if (this.useIdb) {
        const v = await idbGet<AppData>(KEY);
        if (v) return v;
      }
    } catch (e) {
      console.error("[storage] IndexedDB load failed, falling back to localStorage", e);
      this.useIdb = false;
    }
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as AppData) : null;
  }

  async save(data: AppData): Promise<void> {
    if (this.useIdb) {
      try {
        await idbSet(KEY, data);
        return;
      } catch (e) {
        console.error("[storage] IndexedDB save failed, falling back to localStorage", e);
        this.useIdb = false;
      }
    }
    localStorage.setItem(LS_KEY, JSON.stringify(data)); // may throw QuotaExceededError — surfaced by the store
  }

  async clear(): Promise<void> {
    if (this.useIdb) await idbSet(KEY, null);
    localStorage.removeItem(LS_KEY);
  }
}

export const storageService: StorageService = new BrowserStorageService();

/* Demo session persistence (Google sessions come from Better Auth cookies). */
const SESSION_KEY = "fah:demo-session";
export const demoSessionStore = {
  get(): AppSession | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppSession) : null;
  },
  set(s: AppSession | null) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  },
};
