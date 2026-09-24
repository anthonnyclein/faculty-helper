import { NextResponse } from "next/server";

// Tells the client which sign-in methods are configured (no secrets are returned).
export async function GET() {
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  console.log("[api/auth-config] googleConfigured:", googleConfigured);
  return NextResponse.json({ ok: true, data: { googleConfigured } });
}
