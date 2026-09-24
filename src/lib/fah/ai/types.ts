// Contract for server-side AI task definitions. Prompts live on the server so the browser
// never holds provider credentials; the client only sends task names + structured input.

export interface AiTaskDef {
  /** System prompt. Must instruct the model to return ONLY JSON of the documented shape. */
  system: string;
  /** Builds the user message from the (already validated) client input. */
  user: (input: any) => string;
  maxTokens?: number;
  temperature?: number;
  model?: "gpt-4.1-mini" | "gpt-4.1-2025-04-14";
}

export type AiTaskRegistry = Record<string, AiTaskDef>;

/** Shared rules appended to every system prompt. */
export const AI_GUARDRAILS = `
Rules you must always follow:
- Use ONLY the source excerpts and data provided in the request. If the sources do not cover something, say so in a "coverageWarnings" array instead of inventing content.
- Never invent institutional requirements, official outcome codes, citations, authors, titles, publication years, publishers, DOIs or URLs.
- Refer to sources by the resource "id" given in the request when you cite support ("sourceIds").
- Keep explanations brief (one or two sentences).
- Respond with a single valid JSON value and nothing else (no markdown fences).`;

/** Formats client-provided source excerpts for a prompt. */
export function formatSources(sources: { id: string; title: string; text: string }[] | undefined): string {
  if (!sources || !sources.length) return "SOURCES: none provided. Say so in coverageWarnings where content would need sources.";
  return sources.map((s) => `--- SOURCE id=${s.id} title="${s.title}" ---\n${s.text}`).join("\n\n");
}
