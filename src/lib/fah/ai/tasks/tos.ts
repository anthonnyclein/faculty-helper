import { AI_GUARDRAILS, type AiTaskRegistry } from "../types";

// TOS AI tasks (item → objective / cognitive level mapping).
// Client contract, demo fallback and output validation: src/lib/fah/ai/demo/tos.ts
export const tosTasks: AiTaskRegistry = {
  "map-tos": {
    system: `You help a Philippine university faculty member build a Table of Specifications (TOS) for an exam.
For EVERY exam item given, choose (1) the test objective it measures and (2) the cognitive level (revised Bloom's taxonomy) it requires.
- Use ONLY the objective "id" values provided (copy them exactly) and ONLY the level names provided (copy them exactly).
- If a question already carries a cognitiveLevel tag or a cloId matching an objective's cloId, prefer it unless it is clearly wrong.
- Judge the level by what the student must actually do (recall, explain, apply/solve, analyze/compare, evaluate/justify, design/create), not by keywords alone.
- A question with sub-items is ONE item.
- Give a brief rationale (one sentence) per item.
Return JSON: {"mappings":[{"questionId": string, "objectiveId": string, "level": string, "rationale": string}], "warnings": string[]}.
Return exactly one mapping per item.${AI_GUARDRAILS}`,
    user: (input: {
      items?: { questionId: string; label: string; type: string; points: number; prompt: string; topic?: string; cloId?: string; cognitiveLevel?: string }[];
      objectives?: { id: string; label: string; cloId?: string; topic?: string }[];
      levels?: string[];
    }) =>
      `COGNITIVE LEVELS (use exactly): ${(input.levels ?? []).join(", ")}

OBJECTIVES:
${(input.objectives ?? []).map((o) => `id=${o.id}${o.cloId ? ` cloId=${o.cloId}` : ""}${o.topic ? ` topic="${o.topic}"` : ""} | ${o.label}`).join("\n") || "(none)"}

EXAM ITEMS:
${(input.items ?? [])
  .map(
    (i) =>
      `questionId=${i.questionId} | item ${i.label} | ${i.type} | ${i.points} pt${i.topic ? ` | topic: ${i.topic}` : ""}${i.cloId ? ` | cloId=${i.cloId}` : ""}${
        i.cognitiveLevel ? ` | tagged level: ${i.cognitiveLevel}` : ""
      }\n   ${String(i.prompt ?? "").replace(/\s+/g, " ").slice(0, 500)}`
  )
  .join("\n")}

Map every item.`,
    maxTokens: 4000,
    temperature: 0.2,
  },
};
