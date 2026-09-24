"use client";

import { useId, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  CloudOff,
  FlaskConical,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { DraftStatus } from "@/lib/fah/store";
import { useAiStatus } from "@/lib/fah/services/ai";
import { formatDateTime } from "./utils";

/* ------------------------------------------------------------------ */
/* Page layout                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badges,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold leading-tight text-[#1b2466] md:text-3xl">{title}</h1>
        {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="font-display text-lg font-semibold text-[#1b2466]">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#1b2466]/5 text-[#1b2466]">{icon ?? <CircleDashed className="size-6" />}</div>
      <h3 className="font-display text-lg font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

/** Wide tables scroll horizontally on small screens instead of compressing text. */
export function ScrollTable({ children, minWidth = 720, className }: { children: ReactNode; minWidth?: number; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-slate-200", className)} tabIndex={0} role="region" aria-label="Scrollable table">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800", className)}>
      <FlaskConical className="size-3" /> Demo record
    </Badge>
  );
}

export function SourceBadge({ source }: { source?: "template" | "ai" | "demo" | "manual" | "import" | "library" }) {
  if (!source) return null;
  const map = {
    template: ["Template", "border-sky-300 bg-sky-50 text-sky-800"],
    ai: ["AI suggestion accepted", "border-violet-300 bg-violet-50 text-violet-800"],
    demo: ["Demo output", "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800"],
    manual: ["Manual", "border-slate-300 bg-slate-50 text-slate-700"],
    import: ["Imported", "border-emerald-300 bg-emerald-50 text-emerald-800"],
    library: ["Library", "border-teal-300 bg-teal-50 text-teal-800"],
  } as const;
  const [label, cls] = map[source];
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

export function AiStatusBadge({ compact }: { compact?: boolean }) {
  const s = useAiStatus();
  const conf = {
    checking: { label: "Checking AI…", cls: "border-slate-300 bg-slate-50 text-slate-600", icon: <Loader2 className="size-3 animate-spin" /> },
    connected: { label: "AI connected", cls: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: <Sparkles className="size-3" /> },
    unavailable: { label: "AI unavailable · demo output", cls: "border-amber-300 bg-amber-50 text-amber-900", icon: <CloudOff className="size-3" /> },
    demo: { label: "AI demonstration mode", cls: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800", icon: <FlaskConical className="size-3" /> },
  }[s.state];
  return (
    <Badge variant="outline" className={conf.cls} title={s.message}>
      {conf.icon} {compact ? conf.label.split(" ·")[0] : conf.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Save bar                                                            */
/* ------------------------------------------------------------------ */

export function SaveStatusText({ status, lastSavedAt, autosave, error }: { status: DraftStatus; lastSavedAt?: string; autosave?: boolean; error?: string }) {
  const conf = {
    saved: { icon: <CheckCircle2 className="size-4 text-emerald-600" />, text: `Saved · ${formatDateTime(lastSavedAt)}` },
    unsaved: { icon: <span className="size-2.5 rounded-full bg-amber-500" />, text: autosave ? "Unsaved changes · autosaving…" : "Unsaved changes" },
    saving: { icon: <Loader2 className="size-4 animate-spin text-slate-500" />, text: "Saving…" },
    error: { icon: <AlertTriangle className="size-4 text-red-600" />, text: `Save failed${error ? `: ${error}` : ""}` },
  }[status];
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-slate-600">
      {conf.icon}
      {conf.text}
    </span>
  );
}

/** Persistent save bar (sticky) used by long editors. */
export function SaveBar({
  status,
  lastSavedAt,
  autosave,
  error,
  onSave,
  onDiscard,
  children,
}: {
  status: DraftStatus;
  lastSavedAt?: string;
  autosave?: boolean;
  error?: string;
  onSave: () => void;
  onDiscard?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[#fbfaf6]/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
      <SaveStatusText status={status} lastSavedAt={lastSavedAt} autosave={autosave} error={error} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        {onDiscard && status === "unsaved" && (
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            <Undo2 className="size-4" /> Discard
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={status === "saving"} className="bg-[#1b2466] hover:bg-[#262f7a]">
          {status === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Number input that allows clearing (null) instead of snapping back to 0. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  id,
  className,
  placeholder,
  ariaLabel,
  invalid,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null || value === undefined ? "" : String(value));
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        invalid && "border-red-400",
        className
      )}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={shown}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === "") onChange(null);
        else {
          const n = Number(t);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      onBlur={() => setText(null)}
    />
  );
}

export function ReorderButtons({
  index,
  count,
  onMove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col">
      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Move ${label} down`} disabled={index >= count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown className="size-3.5" />
      </Button>
    </div>
  );
}

export function DeleteIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="size-8 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={label} title={label} onClick={onClick}>
      <Trash2 className="size-4" />
    </Button>
  );
}

/** Toggle chips for multi-select (e.g. PO / CLO / PEO codes). */
export function ChipSelect({
  options,
  value,
  onChange,
  ariaLabel,
  emptyText = "No options available",
}: {
  options: { value: string; label: string; title?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  ariaLabel: string;
  emptyText?: string;
}) {
  if (!options.length) return <p className="text-xs italic text-slate-400">{emptyText}</p>;
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b2466]/40",
              on ? "border-[#1b2466] bg-[#1b2466] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-[#1b2466]/60"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function IssueList({ issues, tone = "error", title }: { issues: string[]; tone?: "error" | "warning"; title?: string }) {
  if (!issues.length) return null;
  const cls = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role="alert" className={cn("rounded-lg border px-3 py-2 text-sm", cls)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <ul className="list-disc space-y-0.5 pl-5">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={destructive ? "bg-red-600 hover:bg-red-700" : undefined} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useStableId(prefix: string) {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, "")}`;
}
