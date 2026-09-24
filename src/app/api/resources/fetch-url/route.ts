import { NextResponse } from "next/server";

// Fetches a public web page and returns readable text (scripts, styles and tags removed).
// Only http/https, 10 s timeout, ~2 MB limit. Never follows the request into private networks.

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) return true;
  return false;
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return named[code.toLowerCase()] ?? m;
  });
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, " ").trim()) : "";
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|pre|header|main|table|ul|ol|dd|dt)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return { title, text };
}

export async function POST(req: Request) {
  let url = "";
  try {
    const body = (await req.json()) as { url?: string };
    url = String(body?.url ?? "").trim();
  } catch (e) {
    console.error("[api/resources/fetch-url] invalid body", e);
    return fail("Invalid request body.", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail("Enter a complete web address starting with http:// or https://.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fail("Only http:// and https:// links are supported.", 400);
  if (isPrivateHost(parsed.hostname)) return fail("Links to local or private network addresses are not allowed.", 400);

  console.log("[api/resources/fetch-url] fetching", parsed.toString());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FacultyAcademicHelper/1.0; +resource-import)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
    });
    if (!res.ok) {
      console.error("[api/resources/fetch-url] HTTP", res.status);
      const reason =
        res.status === 401 || res.status === 403
          ? "the site refused access (sign-in required or automated access blocked)"
          : res.status === 404
            ? "the page was not found"
            : `the site responded with an error`;
      return fail(`The link could not be read: ${reason} (HTTP ${res.status}).`);
    }
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/pdf")) return fail("Link points to a PDF — download it and upload the file.");
    if (contentType.includes("wordprocessingml") || contentType.includes("msword"))
      return fail("Link points to a Word document — download it and upload the file.");
    const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml");
    const isText = contentType.startsWith("text/plain") || contentType.startsWith("text/markdown");
    if (contentType && !isHtml && !isText) return fail(`The link does not point to a readable web page (content type: ${contentType.split(";")[0]}).`);

    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return fail("The page is larger than 2 MB and was not downloaded. Save the relevant text and paste it manually.");

    // Read at most MAX_BYTES.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_BYTES) {
          truncated = true;
          chunks.push(value.slice(0, value.byteLength - (received - MAX_BYTES)));
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const buf = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    const raw = new TextDecoder("utf-8").decode(buf);
    const { title, text } = isText ? { title: "", text: raw.trim() } : htmlToText(raw);
    console.log("[api/resources/fetch-url] ok", { bytes: received, chars: text.length, truncated });
    return NextResponse.json({ ok: true, data: { title, text, contentType: contentType.split(";")[0] || "text/html", truncated } });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[api/resources/fetch-url] failed", e);
    return fail(aborted ? "The site did not respond within 10 seconds." : `The link could not be reached (${e instanceof Error ? e.message : String(e)}).`);
  } finally {
    clearTimeout(timer);
  }
}
