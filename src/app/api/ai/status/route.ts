import { NextResponse } from "next/server";

// Reports whether the secure AI backend is configured. Never returns secrets.
export async function GET() {
  const key = process.env.TOTALUM_API_KEY;
  const configured = !!key && key !== "test-api-key" && process.env.AI_FEATURES_DISABLED !== "true";
  console.log("[api/ai/status] configured:", configured);
  return NextResponse.json({
    ok: true,
    data: {
      state: configured ? "connected" : "unavailable",
      provider: "OpenAI (via Totalum secure backend)",
      message: configured
        ? "AI requests are sent to OpenAI through this application's server. No API key is stored in the browser."
        : "The AI backend is not configured on the server. Manual editing remains available; demonstration output can be used instead.",
    },
  });
}
