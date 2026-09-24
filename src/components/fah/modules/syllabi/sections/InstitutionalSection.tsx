"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, RefreshCw, ScrollText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Syllabus } from "@/lib/fah/types";
import { deepClone } from "@/lib/fah/ids";
import { ConfirmDialog, Panel, ScrollTable } from "../../../common/ui";
import { href } from "../../../common/router";
import type { SectionProps } from "./types";

type Snapshot = Syllabus["institutional"];

function currentSnapshot(inst: SectionProps["data"]["institutional"]): Snapshot {
  return {
    vision: inst.vision,
    mission: inst.mission,
    goals: [...inst.goals],
    coreValues: [...inst.coreValues],
    peoIntro: inst.peoIntro,
    peos: deepClone(inst.peos),
  };
}

const norm = (s: Snapshot) =>
  JSON.stringify({ v: s.vision, m: s.mission, g: s.goals, c: s.coreValues, i: s.peoIntro, p: s.peos.map((x) => [x.code, x.description]) });

export function InstitutionalSection({ syllabus, update, data }: SectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const snap = syllabus.institutional;
  const latest = useMemo(() => currentSnapshot(data.institutional), [data.institutional]);
  const differs = norm(snap) !== norm(latest);

  const changedParts = useMemo(() => {
    if (!differs) return [];
    const out: string[] = [];
    if (snap.vision !== latest.vision) out.push("Vision");
    if (snap.mission !== latest.mission) out.push("Mission");
    if (JSON.stringify(snap.goals) !== JSON.stringify(latest.goals)) out.push("Goals");
    if (JSON.stringify(snap.coreValues) !== JSON.stringify(latest.coreValues)) out.push("Core Values");
    if (snap.peoIntro !== latest.peoIntro || JSON.stringify(snap.peos) !== JSON.stringify(latest.peos)) out.push("Program Educational Objectives");
    return out;
  }, [differs, snap, latest]);

  const newCodes = new Set(latest.peos.map((p) => p.code));
  const orphanedPeoUses = syllabus.programOutcomes.filter((po) => po.peos.some((c) => !newCodes.has(c)));

  const applyUpdate = () => {
    const fresh = currentSnapshot(data.institutional);
    const codes = new Set(fresh.peos.map((p) => p.code));
    update((s) => ({
      ...s,
      institutional: fresh,
      programOutcomes: s.programOutcomes.map((po) => (po.peos.some((c) => !codes.has(c)) ? { ...po, peos: po.peos.filter((c) => codes.has(c)) } : po)),
    }));
    console.log("[syllabus] institutional snapshot refreshed", { syllabusId: syllabus.id, changed: changedParts, cleanedPOs: orphanedPeoUses.length });
    toast.success("Institutional statements updated", { description: "Save the syllabus to keep the change." });
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800">
          <Lock className="size-3" /> Copied verbatim from the institutional template
        </Badge>
        <p className="text-xs text-slate-500">
          Wording is edited only in{" "}
          <a href={href("/settings")} className="font-medium text-[#1b2466] underline underline-offset-2">
            Templates & Settings
          </a>{" "}
          → Institutional configuration.
        </p>
      </div>

      {differs && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-start">
          <TriangleAlert className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold">The institutional configuration changed after this syllabus was created.</p>
            <p className="mt-0.5 text-amber-900">
              Different: {changedParts.join(", ")}. This syllabus keeps its own copy until you update it explicitly.
            </p>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 bg-white" onClick={() => setConfirmOpen(true)}>
            <RefreshCw className="size-4" /> Update from institutional configuration
          </Button>
        </div>
      )}

      <Panel title="B. Vision, Mission, Goals and Core Values" description="Printed as the four-column table of the reference template.">
        <ScrollTable minWidth={880}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1b2466] text-white">
                {["Vision", "Mission", "Goals", "Core Values"].map((h) => (
                  <th key={h} scope="col" className="border-r border-white/15 px-3 py-2 text-left font-display text-sm font-semibold last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="w-[22%] border-r border-slate-200 px-3 py-3 leading-relaxed text-slate-800">{snap.vision}</td>
                <td className="w-[26%] border-r border-slate-200 px-3 py-3 leading-relaxed text-slate-800">{snap.mission}</td>
                <td className="w-[36%] border-r border-slate-200 px-3 py-3 text-slate-800">
                  <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
                    {snap.goals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ol>
                </td>
                <td className="px-3 py-3 text-slate-800">
                  <ul className="space-y-1.5">
                    {snap.coreValues.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 font-display text-xs font-bold text-amber-900">{c.charAt(0)}</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollTable>
      </Panel>

      <Panel title="C. Program Educational Objectives (PEOs)">
        <p className="mb-3 text-sm italic text-slate-700">{snap.peoIntro}</p>
        {snap.peos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <ScrollText className="size-4" /> No PEOs in the institutional template.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {snap.peos.map((p) => (
              <li key={p.code} className="flex gap-3 px-3 py-2.5 text-sm">
                <span className="h-fit shrink-0 rounded-md bg-[#1b2466] px-2 py-0.5 text-xs font-bold text-amber-300">{p.code}</span>
                <span className="leading-relaxed text-slate-800">{p.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Update institutional statements?"
        confirmLabel="Update this syllabus"
        onConfirm={applyUpdate}
        description={
          <div className="space-y-2 text-sm">
            <p>
              This replaces this syllabus’ copy of <strong>{changedParts.join(", ")}</strong> with the current institutional configuration. Other syllabi are not
              affected.
            </p>
            {orphanedPeoUses.length > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-900">
                {orphanedPeoUses.length} program outcome(s) map to PEO codes that no longer exist ({Array.from(new Set(orphanedPeoUses.flatMap((p) => p.peos.filter((c) => !newCodes.has(c))))).join(", ")}). Those codes
                will be removed from their mappings — review Section D afterwards.
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}
