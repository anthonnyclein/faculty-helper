"use client";

import { useEffect, useState } from "react";
import { BookCopy, Bot, Building2, Database, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { store, useAppData } from "@/lib/fah/store";
import type { AppSettings, CitationStyle } from "@/lib/fah/types";
import { AiStatusBadge, Field, IssueList, NumberInput, PageHeader, Panel } from "../../common/ui";
import { useAiStatus } from "@/lib/fah/services/ai";
import { ReferenceTemplatesTab } from "./ReferenceTemplatesTab";
import { InstitutionalTab } from "./InstitutionalTab";
import { DataTab } from "./DataTab";

const CITATION_STYLES: CitationStyle[] = ["APA 7", "IEEE", "MLA 9", "Chicago"];
type WeekKey = keyof AppSettings["examWeeks"];
const WEEK_KEYS: { key: WeekKey; label: string }[] = [
  { key: "prelim1", label: "First Prelim" },
  { key: "prelim2", label: "Second Prelim" },
  { key: "final", label: "Finals" },
];

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PrintSettings() {
  const data = useAppData();
  const s = data.settings;
  const [weeks, setWeeks] = useState<Record<WeekKey, number | null>>({ ...s.examWeeks });
  const [labels, setLabels] = useState({ ...s.examWeekLabels });
  const [college, setCollege] = useState(s.defaultCollege);
  const [dept, setDept] = useState(s.defaultDepartment);

  useEffect(() => {
    setWeeks({ ...s.examWeeks });
    setLabels({ ...s.examWeekLabels });
    setCollege(s.defaultCollege);
    setDept(s.defaultDepartment);
  }, [s.examWeeks, s.examWeekLabels, s.defaultCollege, s.defaultDepartment]);

  const weekIssues: string[] = [];
  WEEK_KEYS.forEach(({ key, label }) => {
    const v = weeks[key];
    if (v === null || v === undefined) weekIssues.push(`${label}: enter a week number.`);
    else if (!Number.isInteger(v) || v < 1 || v > 18) weekIssues.push(`${label}: week must be a whole number from 1 to 18.`);
  });
  const vals = WEEK_KEYS.map((w) => weeks[w.key]);
  if (!weekIssues.length) {
    if (new Set(vals).size !== vals.length) weekIssues.push("Each examination must be in a different week.");
    else if (!(vals[0]! < vals[1]! && vals[1]! < vals[2]!)) weekIssues.push("Exam weeks must be in order: First Prelim, then Second Prelim, then Finals.");
  }
  WEEK_KEYS.forEach(({ key, label }) => {
    if (!labels[key].trim()) weekIssues.push(`${label}: the printed label is empty.`);
  });
  const weeksDirty =
    WEEK_KEYS.some(({ key }) => weeks[key] !== s.examWeeks[key] || labels[key] !== s.examWeekLabels[key]);

  const saveWeeks = () => {
    if (weekIssues.length) return;
    store.setSettings({ examWeeks: { prelim1: weeks.prelim1!, prelim2: weeks.prelim2!, final: weeks.final! }, examWeekLabels: labels });
    console.log("[settings] exam weeks saved", weeks);
    toast.success("Exam weeks saved. New syllabi use these weeks; existing syllabi keep their learning plans.");
  };

  return (
    <div className="space-y-6">
      <Panel title="Syllabus paper size" description="The reference template and the written requirements specify different page sizes. Choose which one exports use.">
        <RadioGroup
          value={s.syllabusPaper}
          onValueChange={(v) => {
            store.setSettings({ syllabusPaper: v as AppSettings["syllabusPaper"], paperDiscrepancyResolved: true });
            console.log("[settings] paper", v);
          }}
          className="grid gap-3 md:grid-cols-2"
        >
          {[
            { v: "custom-13x11", title: "Custom 13 in wide × 11 in high (requested)", hint: "Landscape page size from the written requirements." },
            { v: "legal-14x8.5", title: "Legal 14 × 8.5 in (template)", hint: "Landscape page size of the uploaded syllabus reference." },
          ].map((o) => (
            <label
              key={o.v}
              htmlFor={`paper-${o.v}`}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${s.syllabusPaper === o.v ? "border-[#1b2466] bg-[#1b2466]/5" : "border-slate-200 hover:border-slate-300"}`}
            >
              <RadioGroupItem id={`paper-${o.v}`} value={o.v} className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-slate-800">{o.title}</span>
                <span className="text-xs text-slate-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        {!s.paperDiscrepancyResolved ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Not yet confirmed. The requested 13 × 11 in size is preselected — select an option to confirm your choice.
          </p>
        ) : (
          <p className="mt-3 text-xs text-emerald-700">Paper size confirmed.</p>
        )}
      </Panel>

      <Panel title="Course Learning Plan columns and units">
        <div className="grid gap-3 md:grid-cols-3">
          <ToggleRow id="set-clo-col" label="Corresponding CLOs column" hint="Added by the requirements; not in the reference table." checked={s.showCloColumn} onChange={(v) => store.setSettings({ showCloColumn: v })} />
          <ToggleRow id="set-mat-col" label="Instructional Material References column" hint="Present in the reference table." checked={s.showMaterialsColumn} onChange={(v) => store.setSettings({ showMaterialsColumn: v })} />
          <ToggleRow id="set-hours" label="Show lecture/lab hours with units" hint="The reference prints only the number of units." checked={s.showHoursInUnits} onChange={(v) => store.setSettings({ showHoursInUnits: v })} />
        </div>
      </Panel>

      <Panel
        title="Examination weeks"
        description="Weeks reserved for examinations in new syllabi (weeks 1–18). Existing syllabi keep their plans."
        actions={
          <Button onClick={saveWeeks} disabled={!weeksDirty || weekIssues.length > 0} className="bg-[#1b2466] hover:bg-[#262f7a]">
            Save exam weeks
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {WEEK_KEYS.map(({ key, label }) => (
            <div key={key} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <Field label={`${label} week`} htmlFor={`wk-${key}`}>
                <NumberInput id={`wk-${key}`} min={1} max={18} step={1} value={weeks[key]} onChange={(v) => setWeeks({ ...weeks, [key]: v })} />
              </Field>
              <Field label="Printed label" htmlFor={`wkl-${key}`}>
                <Input id={`wkl-${key}`} value={labels[key]} onChange={(e) => setLabels({ ...labels, [key]: e.target.value })} />
              </Field>
            </div>
          ))}
        </div>
        {weekIssues.length > 0 && <div className="mt-3"><IssueList issues={weekIssues} /></div>}
      </Panel>

      <Panel title="Defaults for new documents">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Default citation style" htmlFor="set-cite">
            <Select value={s.defaultCitationStyle} onValueChange={(v) => store.setSettings({ defaultCitationStyle: v as CitationStyle })}>
              <SelectTrigger id="set-cite" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITATION_STYLES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default college" htmlFor="set-college">
            <Input
              id="set-college"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              onBlur={() => college.trim() !== s.defaultCollege && store.setSettings({ defaultCollege: college.trim() })}
            />
          </Field>
          <Field label="Default department" htmlFor="set-dept">
            <Input id="set-dept" value={dept} onChange={(e) => setDept(e.target.value)} onBlur={() => dept.trim() !== s.defaultDepartment && store.setSettings({ defaultDepartment: dept.trim() })} />
          </Field>
        </div>
      </Panel>
    </div>
  );
}

function AiSettings() {
  const data = useAppData();
  const ai = useAiStatus();
  return (
    <Panel title="AI assistance" description="Choose how AI features behave." actions={<AiStatusBadge />}>
      <RadioGroup
        value={data.settings.aiMode}
        onValueChange={(v) => {
          store.setSettings({ aiMode: v as AppSettings["aiMode"] });
          console.log("[settings] aiMode", v);
        }}
        className="grid gap-3 md:grid-cols-2"
      >
        {[
          { v: "auto", title: "Use the secure AI backend when connected", hint: "Requests go to OpenAI through this application's server. When it is unavailable, labeled demonstration output can be used." },
          { v: "demo", title: "Always use demonstration output", hint: "Suggestions come from simple built-in rules, never from an AI model. Useful for training or when working offline." },
        ].map((o) => (
          <label
            key={o.v}
            htmlFor={`ai-${o.v}`}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${data.settings.aiMode === o.v ? "border-[#1b2466] bg-[#1b2466]/5" : "border-slate-200 hover:border-slate-300"}`}
          >
            <RadioGroupItem id={`ai-${o.v}`} value={o.v} className="mt-0.5" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">{o.title}</span>
              <span className="text-xs text-slate-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>
          <strong>Current status:</strong> {ai.message}
        </p>
        <p className="text-xs">
          No AI keys are stored in or sent to your browser — the key is configured only on the server. Signing in with Google does not provide ChatGPT or OpenAI access. Every AI
          suggestion is shown for review before it changes your document, and manual editing always works.
        </p>
      </div>
    </Panel>
  );
}

function EditorSettings() {
  const data = useAppData();
  return (
    <Panel title="Editor">
      <ToggleRow
        id="set-autosave"
        label="Autosave"
        hint="Save changes automatically a few seconds after you stop typing. When off, use the Save button; you are warned before leaving with unsaved changes."
        checked={data.settings.autosave}
        onChange={(v) => {
          store.setSettings({ autosave: v });
          console.log("[settings] autosave", v);
        }}
      />
    </Panel>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState("references");
  const tabs = [
    { v: "references", label: "Reference templates", icon: BookCopy },
    { v: "print", label: "Syllabus print settings", icon: Printer },
    { v: "ai", label: "AI", icon: Bot },
    { v: "editor", label: "Editor", icon: PenLine },
    { v: "institutional", label: "Institutional configuration", icon: Building2 },
    { v: "data", label: "Data", icon: Database },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Templates and Settings"
        description="Reference templates, print and AI settings, prescribed institutional wording, and your stored data."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.v} value={t.v} className="gap-1.5 data-[state=active]:bg-[#1b2466] data-[state=active]:text-white">
                <Icon className="size-4" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="references">
          <ReferenceTemplatesTab />
        </TabsContent>
        <TabsContent value="print">
          <PrintSettings />
        </TabsContent>
        <TabsContent value="ai">
          <AiSettings />
        </TabsContent>
        <TabsContent value="editor">
          <EditorSettings />
        </TabsContent>
        <TabsContent value="institutional">
          <InstitutionalTab />
        </TabsContent>
        <TabsContent value="data">
          <DataTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
