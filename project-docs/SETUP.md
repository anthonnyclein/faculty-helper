# Faculty Academic Helper — Setup & Capabilities

## Stack
Next.js 15 (React 19, TypeScript) + Tailwind + shadcn/ui, hosted on Totalum. The workspace is a single-page app at `/app` (hash routes); `/` is the entry / sign-in screen.

## What works with no configuration
- **Demonstration mode sign-in** (clearly labeled; no account is created).
- **All editing**: syllabi (sections A–L), IT Program Outcomes library, Resource Library, Exam Builder, Table of Specifications, Faculty & Signatories, Templates & Settings.
- **Browser persistence**: IndexedDB (localStorage fallback), explicit Save + autosave, unsaved-change warnings. Export/import of all data as JSON in Settings → Data.
- **Document output**: paginated syllabus preview/PDF (13 × 11 in or 14 × 8.5 in landscape), student exam and answer-key PDFs, Horizontal and Vertical TOS PDFs (A4 portrait). Print uses the same page layout.
- **Resource processing** in the browser: PDF text (pdf.js), DOCX (mammoth), text files/paste, manual book entries. Website links are fetched by the server route `/api/resources/fetch-url`.
- **AI features**: run through the secure server route `/api/ai` using the Totalum built-in OpenAI integration (no key in the browser). If the server AI is unavailable, or Settings → AI is set to demonstration, clearly labeled rule-based demonstration output is used instead. Every suggestion is reviewed before it is applied.

## What needs configuration
| Feature | Environment variables | Where to get them |
|---|---|---|
| Continue with Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URI: `{NEXT_PUBLIC_APP_URL}/api/auth/callback/google` (e.g. `https://faculty-academic-helper.totalum-project.com/api/auth/callback/google`). |
| Live AI | `TOTALUM_API_KEY` (already provided by Totalum) | Totalum project settings. The AI status badge shows *Connected*, *Unavailable* or *Demo*. |

Google sign-in only identifies the user. It does not connect a ChatGPT/OpenAI account.

## Service layers (replaceable)
- Storage: `src/lib/fah/services/storage.ts` (`StorageService` interface).
- Auth: `src/lib/fah/services/auth.ts` (Better Auth + demo session).
- AI: `src/lib/fah/services/ai.ts` (client) → `src/app/api/ai/route.ts` (server prompt registry in `src/lib/fah/ai/tasks/`).
- Documents: `src/lib/fah/documents/` (layout blocks → paginator → preview / PDF / print).

## Template notes
Known differences between the uploaded references and the requested output (paper size, exam weeks, TOS paper size, fonts) are listed in the app under **Templates and Settings → Reference templates**, and the syllabus preview asks you to choose a paper size. Always compare exports with the official references before official use.
