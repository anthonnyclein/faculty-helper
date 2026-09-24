# Faculty Academic Helper — Architecture & Contracts

Single-page app at `/app` (hash routes `#/section/id/sub`), entry/sign-in screen at `/`.
Next.js 15 + React 19 + Tailwind v4 + shadcn/ui (`src/components/ui/*`). TypeScript `strict: false`
(**discriminated-union narrowing on `r.ok` is unreliable — use `if (r.ok === true)` and cast in the else branch**).

## Data & persistence
- Types: `src/lib/fah/types.ts` (AppData, Syllabus, Exam, Tos, Resource, LibraryPO, Person, AppSettings, InstitutionalConfig).
- Institutional template content (verbatim): `src/lib/fah/template.ts` (DEFAULT_INSTITUTIONAL, TEMPLATE_LIBRARY_POS, TEMPLATE_DISCREPANCIES, TEMPLATE_SOURCE, EXAM_TERM_TO_TOS_PERIOD).
- Factories: `src/lib/fah/factories.ts` (newSyllabus, duplicateSyllabus, newExam, newSection, newQuestion, blankTos, DEFAULT_SETTINGS, templatePOs, examWeekItems).
- Calculations: `src/lib/fah/calc.ts` (poNumbers/orderedPOs/poLabel, gradingTotal/gradingIssues, dimensionTotals/Issues, weekLabel, splitOrdinal,
  examItems/examTotals/sectionTotals/questionPoints/examIssues/QUESTION_TYPE_LABELS/sectionTypeLabel/toRoman,
  computeTos/formatNumberList/formatItemLabels/cellKey/fmtPct).
- Validation: `src/lib/fah/validation.ts` (syllabusIssues by section).
- Citations: `src/lib/fah/citations.ts` (formatReference, missingReferenceFields).
- Store: `src/lib/fah/store.ts`
  - `useAppData()` → AppData (read-only snapshot, re-renders on change)
  - `useRecordDraft(collection, id)` → { draft, setDraft, save, discard, status, dirty, lastSavedAt, error, autosave } (explicit Save + autosave)
  - `store.upsert(collection, record)`, `store.remove`, `store.get`, `store.setSettings`, `store.setInstitutional`, `store.flush()`, `store.removeDemoData()`, `store.restoreDemoData()`
  - Exams: saving an exam whose content changed increments `exam.revision`; a TOS whose `sourceExamRevision` differs "needs review".
- Storage service (replaceable): `src/lib/fah/services/storage.ts` (IndexedDB, localStorage fallback).
- Ids: `src/lib/fah/ids.ts` (uid(prefix), nowIso, deepClone). Never use array indexes as identities.

## Services
- Auth (replaceable): `src/lib/fah/services/auth.ts` — Google via Better Auth (only when GOOGLE_CLIENT_ID/SECRET set) or labeled demo mode.
- AI (replaceable): `src/lib/fah/services/ai.ts`
  - `runAi<T>(taskName, input, { demo?: () => T, validate? })` → `{ ok:true, data, mode:'live'|'demo' } | { ok:false, error, mode, canUseDemo }`
  - Live calls POST `/api/ai` { task, input }. Prompts are server-side in `src/lib/fah/ai/tasks/{syllabus,exam,tos}.ts`
    (type `AiTaskDef` in `src/lib/fah/ai/types.ts`; always append `AI_GUARDRAILS`; use `formatSources(input.sources)`).
  - Demo fallbacks are deterministic client functions; output is labeled "Demonstration output".
  - `buildSourceContext(resources, ids)` → only `status === "extracted"` resources are sent; others are excluded with reasons + warnings.
  - `useAiStatus()` for connected / unavailable / demo.
- Documents: `src/lib/fah/documents/paginate.ts` (PageSpec, DocBlock, paginate, escapeHtml, textHtml, lines, BASE_DOC_CSS),
  `src/lib/fah/documents/export.ts` (exportPagesToPdf, printPages), and component
  `src/components/fah/documents/PaginatedDocument.tsx` (paginated preview + Download PDF + Print from the SAME page markup).
  Build a PageSpec (inches, margins, scoped CSS under `.className`, header/footer HTML absolutely positioned in page coords)
  and an array of DocBlocks (flow HTML blocks, or tables with `thead` + `rows[]` where each row string = one or more <tr> kept together;
  table headers repeat on each page).

## Shared UI (`src/components/fah/common/`)
- `ui.tsx`: PageHeader, Panel, EmptyState, LoadingBlock, ScrollTable, DemoBadge, SourceBadge, AiStatusBadge, SaveBar, SaveStatusText,
  Field, NumberInput (nullable), ReorderButtons, DeleteIconButton, ChipSelect, IssueList, ConfirmDialog.
- `ai-review.tsx`: `useAiProposal<T>()` + `AiReviewPanel` (Generate/Suggest → Preview → Edit → Accept/Reject → Regenerate; failure keeps user data).
- `router.ts`: `navigate(path)`, `href(path)`, `useHashRoute()`.
- `utils.ts`: moveItem, updateById, toggleIn, formatDate, formatDateTime, downloadText.
- Toasts: `import { toast } from "sonner"` (Toaster is mounted in AppShell).

## Visual language
Navy `#1b2466` + gold `#f4d000`/amber accents, warm paper background `#fbfaf6`, `font-display` (Fraunces) for headings, Public Sans body.
Cards: `rounded-2xl border border-slate-200 bg-white shadow-sm`. Keep controls labeled; wide tables use `ScrollTable`.
