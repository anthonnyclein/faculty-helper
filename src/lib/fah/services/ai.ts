"use client";
// Replaceable AI service. Live requests go through the app's secure backend (/api/ai).
// When AI is unavailable or the user chose demonstration mode, callers may supply a
// deterministic demo generator — its output is always labeled as demonstration output.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { store, useAppData } from "../store";
import type { Resource } from "../types";

export type AiState = "checking" | "connected" | "unavailable" | "demo";

export interface AiStatus {
  state: AiState;
  provider?: string;
  message: string;
}

let cachedStatus: AiStatus | null = null;
let statusPromise: Promise<AiStatus> | null = null;

async function fetchServerStatus(): Promise<AiStatus> {
  if (cachedStatus) return cachedStatus;
  if (!statusPromise) {
    statusPromise = api.get<{ state: "connected" | "unavailable"; provider: string; message: string }>("/api/ai/status").then((r) => {
      const s: AiStatus = r.ok && r.data ? { state: r.data.state, provider: r.data.provider, message: r.data.message } : { state: "unavailable", message: "Could not reach the AI status endpoint." };
      cachedStatus = s;
      return s;
    });
  }
  return statusPromise;
}

export async function getAiStatus(): Promise<AiStatus> {
  const server = await fetchServerStatus();
  if (store.getState().data.settings.aiMode === "demo") {
    return {
      state: "demo",
      provider: server.provider,
      message: "Demonstration mode is on. Suggestions are produced by simple built-in rules, not by an AI model.",
    };
  }
  return server;
}

export function useAiStatus(): AiStatus {
  const data = useAppData();
  const [status, setStatus] = useState<AiStatus>({ state: "checking", message: "Checking AI service…" });
  useEffect(() => {
    let alive = true;
    getAiStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [data.settings.aiMode]);
  return status;
}

export type AiMode = "live" | "demo";

export type AiRunResult<T> =
  | { ok: true; data: T; mode: AiMode; model?: string }
  | { ok: false; error: string; mode: AiMode; canUseDemo: boolean };

/**
 * Run an AI task.
 * - Live: POST /api/ai { task, input } → parsed JSON result.
 * - Demo: only when AI is unavailable/demo mode (or forceDemo) AND a demo generator is given.
 * Failures never touch the caller's data — callers keep the user's work and offer Retry.
 */
export async function runAi<T>(
  task: string,
  input: unknown,
  opts: { demo?: () => T | Promise<T>; forceDemo?: boolean; validate?: (v: unknown) => T } = {}
): Promise<AiRunResult<T>> {
  const status = await getAiStatus();
  const useDemo = opts.forceDemo || status.state !== "connected";
  if (useDemo) {
    if (!opts.demo) {
      return { ok: false, error: "AI is not available and this feature has no demonstration output.", mode: "demo", canUseDemo: false };
    }
    try {
      await new Promise((r) => setTimeout(r, 450)); // visible processing state
      const data = await opts.demo();
      console.log(`[ai] demo output for ${task}`);
      return { ok: true, data, mode: "demo" };
    } catch (e) {
      console.error(`[ai] demo generator failed for ${task}`, e);
      return { ok: false, error: e instanceof Error ? e.message : String(e), mode: "demo", canUseDemo: false };
    }
  }
  console.log(`[ai] live request ${task}`);
  const res = await api.post<{ result: unknown; model: string }>("/api/ai", { task, input });
  if (!res.ok || !res.data) {
    const error = typeof res.error === "string" ? res.error : "The AI request failed.";
    console.error(`[ai] ${task} failed`, error);
    return { ok: false, error, mode: "live", canUseDemo: !!opts.demo };
  }
  try {
    const data = opts.validate ? opts.validate(res.data.result) : (res.data.result as T);
    return { ok: true, data, mode: "live", model: res.data.model };
  } catch (e) {
    console.error(`[ai] ${task} returned an unexpected shape`, e, res.data.result);
    return { ok: false, error: "The AI response did not have the expected structure. Try again.", mode: "live", canUseDemo: !!opts.demo };
  }
}

/* ------------------------------------------------------------------ */
/* Source context                                                      */
/* ------------------------------------------------------------------ */

export interface SourceContext {
  sources: { id: string; title: string; text: string; truncated: boolean }[];
  excluded: { id: string; title: string; reason: string }[];
  warnings: string[];
}

/**
 * Only successfully processed (status "extracted") content is sent to AI.
 * Bibliographic-only records, failed extractions and OCR-required files are excluded and reported.
 */
export function buildSourceContext(resources: Resource[], ids: string[], budgetChars = 48000): SourceContext {
  const selected = resources.filter((r) => ids.includes(r.id));
  const usable = selected.filter((r) => r.status === "extracted" && r.content.trim().length > 0);
  const excluded = selected
    .filter((r) => !usable.includes(r))
    .map((r) => ({
      id: r.id,
      title: r.title,
      reason:
        r.status === "metadata-only"
          ? "bibliographic information only — no readable content"
          : r.status === "needs-ocr"
            ? "scanned file requires OCR"
            : r.status === "inaccessible"
              ? "link could not be accessed"
              : r.status === "failed"
                ? "text extraction failed"
                : "still processing",
    }));
  const per = usable.length ? Math.floor(budgetChars / usable.length) : 0;
  const sources = usable.map((r) => ({
    id: r.id,
    title: r.title,
    text: r.content.slice(0, per),
    truncated: r.content.length > per,
  }));
  const warnings: string[] = [];
  if (!selected.length) warnings.push("No instructional resources were selected. Output will rely only on the course details you entered.");
  else if (!usable.length) warnings.push("None of the selected resources has readable content. Add text or process the files first.");
  if (excluded.length) warnings.push(`${excluded.length} selected resource(s) were excluded: ${excluded.map((e) => `${e.title} (${e.reason})`).join("; ")}.`);
  if (sources.some((s) => s.truncated)) warnings.push("Some long resources were shortened to fit the AI request; coverage of later chapters may be incomplete.");
  return { sources, excluded, warnings };
}

export function sourcesToPrompt(ctx: SourceContext): string {
  if (!ctx.sources.length) return "SOURCES: none provided.";
  return ctx.sources.map((s) => `--- SOURCE id=${s.id} title="${s.title}" ---\n${s.text}`).join("\n\n");
}
