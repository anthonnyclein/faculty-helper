import { AI_GUARDRAILS, type AiTaskRegistry } from "../types";

// Syllabus outcome-alignment AI tasks: PO → PEO mapping and CLO → PO mapping.
// Client demo fallbacks live in src/lib/fah/ai/demo/syllabus-outcomes.ts.
export const syllabusOutcomeTasks: AiTaskRegistry = {
  "suggest-peos": {
    system: `You align university Program Outcomes (POs) with Program Educational Objectives (PEOs) for a Philippine BS Information Technology syllabus.
Choose only from the PEO codes provided, copied exactly as given (e.g. "PEO 1"). Pick the 1-3 PEOs the outcome most directly supports.
Return JSON: {"peos": string[], "explanation": string}.${AI_GUARDRAILS}`,
    user: (input: { po: string; category: string; peos: { code: string; description: string }[] }) =>
      `Program Outcome (${input.category}): ${input.po}\n\nAvailable PEOs:\n${(input.peos ?? [])
        .map((p) => `${p.code}: ${p.description}`)
        .join("\n")}\n\nSuggest the applicable PEO codes (1-3) and briefly explain the alignment in one or two sentences.`,
    maxTokens: 400,
    temperature: 0.2,
  },
  "suggest-clo-pos": {
    system: `You map a Course Learning Outcome (CLO) to the Program Outcomes (POs) it contributes to, for a Philippine BS Information Technology syllabus.
Choose ONLY from the PO ids provided (copy the "id" value exactly). Suggest the 1-3 most directly supported POs; do not suggest weak or indirect links.
Return JSON: {"suggestions": [{"poId": string, "explanation": string}]}. Each explanation is one short sentence.${AI_GUARDRAILS}`,
    user: (input: { clo: { code?: string; statement: string }; pos: { id: string; label: string; description: string }[] }) =>
      `Course Learning Outcome${input.clo?.code ? ` (${input.clo.code})` : ""}: ${input.clo?.statement ?? ""}\n\nProgram Outcomes addressed by the course:\n${(input.pos ?? [])
        .map((p) => `id=${p.id} | ${p.label}: ${p.description}`)
        .join("\n")}\n\nReturn the POs this CLO directly supports.`,
    maxTokens: 500,
    temperature: 0.2,
  },
};
