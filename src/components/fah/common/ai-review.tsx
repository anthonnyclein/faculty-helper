"use client";
// Consistent AI review flow used across modules:
//   Generate/Suggest → Preview → Edit → Accept | Reject → Regenerate selected content.
// Proposals never modify saved content until the user presses Accept.

import { useCallback, useState, type ReactNode } from "react";
import { AlertTriangle, Check, FlaskConical, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiMode, AiRunResult } from "@/lib/fah/services/ai";

export type ProposalStatus = "idle" | "running" | "ready" | "error";

export interface AiProposalState<T> {
  status: ProposalStatus;
  proposal: T | null;
  mode: AiMode | null;
  error: string | null;
  canUseDemo: boolean;
  warnings: string[];
}

export function useAiProposal<T>() {
  const [s, setS] = useState<AiProposalState<T>>({ status: "idle", proposal: null, mode: null, error: null, canUseDemo: false, warnings: [] });

  /** Runs a request; on failure the previous proposal (and all user data) is preserved. */
  const run = useCallback(async (fn: () => Promise<AiRunResult<T>>, warnings: string[] = []) => {
    setS((p) => ({ ...p, status: "running", error: null }));
    const r = await fn();
    if (r.ok === true) setS({ status: "ready", proposal: r.data, mode: r.mode, error: null, canUseDemo: false, warnings });
    else {
      const f = r as Extract<AiRunResult<T>, { ok: false }>;
      setS((p) => ({ ...p, status: "error", error: f.error, mode: f.mode, canUseDemo: f.canUseDemo, warnings }));
    }
    return r;
  }, []);

  const edit = useCallback((updater: T | ((p: T) => T)) => {
    setS((p) => (p.proposal === null ? p : { ...p, proposal: typeof updater === "function" ? (updater as (x: T) => T)(p.proposal) : updater }));
  }, []);

  const clear = useCallback(() => setS({ status: "idle", proposal: null, mode: null, error: null, canUseDemo: false, warnings: [] }), []);

  return { ...s, run, edit, clear, setState: setS };
}

export function AiModeNotice({ mode }: { mode: AiMode | null }) {
  if (mode === "demo")
    return (
      <p className="flex items-start gap-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1.5 text-xs text-fuchsia-900">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
        Demonstration output — produced by simple built-in rules, not by an AI model. Review carefully before accepting.
      </p>
    );
  if (mode === "live")
    return (
      <p className="flex items-start gap-2 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs text-violet-900">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        AI suggestion (OpenAI via secure backend). Nothing changes until you accept it.
      </p>
    );
  return null;
}

/**
 * Presentational wrapper. `children` renders the editable proposal preview when status is "ready".
 */
export function AiReviewPanel({
  title,
  description,
  status,
  mode,
  error,
  warnings,
  generateLabel = "Suggest",
  onGenerate,
  onAccept,
  onReject,
  onRegenerate,
  onUseDemo,
  canUseDemo,
  acceptLabel = "Accept",
  regenerateLabel = "Regenerate",
  controls,
  children,
  className,
  compact,
}: {
  title: ReactNode;
  description?: ReactNode;
  status: ProposalStatus;
  mode: AiMode | null;
  error: string | null;
  warnings?: string[];
  generateLabel?: string;
  onGenerate: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRegenerate?: () => void;
  onUseDemo?: () => void;
  canUseDemo?: boolean;
  acceptLabel?: string;
  regenerateLabel?: string;
  /** Inputs shown before generation (resource pickers, instructions…). */
  controls?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/70 to-white p-3 md:p-4", className)} aria-busy={status === "running"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
            <Sparkles className="size-4" /> {title}
          </p>
          {description && !compact && <p className="mt-0.5 text-xs text-slate-600">{description}</p>}
        </div>
        {status !== "ready" && (
          <Button size="sm" variant="outline" className="border-violet-300 bg-white text-violet-900 hover:bg-violet-100" onClick={onGenerate} disabled={status === "running"}>
            {status === "running" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {status === "running" ? "Working…" : status === "error" ? "Retry" : generateLabel}
          </Button>
        )}
      </div>

      {controls && status !== "ready" && <div className="mt-3">{controls}</div>}

      {status === "running" && (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="size-3.5 animate-spin" /> Processing request — your current work is unchanged.
        </p>
      )}

      {status === "error" && (
        <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" /> The request failed. Your work was not changed.
          </p>
          {error && <p className="mt-0.5">{error}</p>}
          {canUseDemo && onUseDemo && (
            <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={onUseDemo}>
              <FlaskConical className="size-3.5" /> Use demonstration output instead
            </Button>
          )}
        </div>
      )}

      {status === "ready" && (
        <div className="mt-3 space-y-3">
          <AiModeNotice mode={mode} />
          {warnings && warnings.length > 0 && (
            <ul className="space-y-0.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {warnings.map((w) => (
                <li key={w} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          )}
          <div>{children}</div>
          <div className="flex flex-wrap gap-2">
            {onAccept && (
              <Button size="sm" onClick={onAccept} className="bg-emerald-700 hover:bg-emerald-800">
                <Check className="size-4" /> {acceptLabel}
              </Button>
            )}
            {onRegenerate && (
              <Button size="sm" variant="outline" onClick={onRegenerate}>
                <RefreshCw className="size-4" /> {regenerateLabel}
              </Button>
            )}
            {onReject && (
              <Button size="sm" variant="ghost" onClick={onReject} className="text-slate-600">
                <X className="size-4" /> Reject
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
