import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { AI_TASKS } from "@/lib/fah/ai/registry";

// Secure AI endpoint: the browser sends a task name + structured input; prompts and
// credentials stay on the server. Returns { ok, data: { result, model } }.

function parseJson(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    const endObj = t.lastIndexOf("}");
    const endArr = t.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("The AI response was not valid JSON.");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { task?: string; input?: unknown };
    const task = body.task ? AI_TASKS[body.task] : undefined;
    if (!body.task || !task) {
      return NextResponse.json({ ok: false, error: `Unknown AI task: ${body.task}` }, { status: 400 });
    }
    const key = process.env.TOTALUM_API_KEY;
    if (!key || key === "test-api-key" || process.env.AI_FEATURES_DISABLED === "true") {
      return NextResponse.json({ ok: false, error: "AI backend is not configured." }, { status: 503 });
    }
    const userMsg = task.user(body.input ?? {});
    const model = task.model ?? "gpt-4.1-mini";
    console.log(`[api/ai] task=${body.task} model=${model} promptChars=${userMsg.length}`);
    const started = Date.now();
    const result = await totalumSdk.openai.createChatCompletion({
      messages: [
        { role: "system", content: task.system },
        { role: "user", content: userMsg },
      ],
      model,
      max_tokens: task.maxTokens ?? 1500,
      temperature: task.temperature ?? 0.3,
    } as any);
    const content = (result as any)?.data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      console.error("[api/ai] empty response", JSON.stringify((result as any)?.errors ?? {}));
      return NextResponse.json({ ok: false, error: "The AI service returned an empty response." }, { status: 502 });
    }
    const parsed = parseJson(content);
    console.log(`[api/ai] task=${body.task} done in ${Date.now() - started}ms`);
    return NextResponse.json({ ok: true, data: { result: parsed, model } });
  } catch (e) {
    console.error("[api/ai] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
