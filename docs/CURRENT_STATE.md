# CURRENT STATE

Last Updated: 2026-09-20 14:35 UTC
Current Phase: Implementation
Current Task: Fix Question Import Pipeline — 6 Bugs
Status: COMPLETE

## Completed
- Fixed 6 bugs in the question import pipeline across `js/admin/imports-exports.js` and `supabase/functions/import-questions/index.ts`:
  1. **Bug 1 (Response field mismatch)**: `response.data.mergedCount` → `response?.updatedCount` (Edge Function returns `updatedCount`, not `mergedCount`, and `callEdgeFunction` has no `.data` wrapper).
  2. **Bug 2 (Dead error guard)**: Removed `if (response.error)` dead-code guard — `callEdgeFunction` throws on error, never returns it.
  3. **Bug 3 (Wrong tbody ID)**: `#import-preview-tbody` → `#tbl-import-preview` for AI Assessment file detection preview.
  4. **Bug 4+5 (Redundant batchMap)**: Replaced the `Map+Set` double-dedup no-op with a single clean `Set`-based `parsedQuestionsState.map()` pass; also removed per-item `examId` from payload (it's already sent top-level).
  5. **Bug 6 (Row-by-row inserts)**: Rewrote Edge Function to pre-fetch existing questions and process inserts/updates in parallel chunks of 20 (via `Promise.all`) instead of 50 sequential round-trips.
- Version bumped: `imports-exports.js` v4.4.5 → v4.4.15, `app.js` v4.4.14 → v4.4.15 in `admin.html`.

## In Progress
- None.

## Not Started
- End-to-end user validation of Central Question Bank import.

## Current Architecture
- Static HTML/CSS/JS frontend
- Supabase PostgreSQL + Auth + Edge Functions backend
- **Structural Alignment**: Adopted Pilar B & C hierarchy (`Class -> Topic -> Assessment -> Module`). Legacy `Subject` and `Exam` terminology is officially deprecated in documentation.

## Database State
- Latest migration: No schema changes in this session.
- Tables: `questions` schema unchanged. Edge Function now pre-fetches on `(exam_id, question_order)` to distinguish insert vs update without requiring a UNIQUE constraint.

## Frontend State
- Pages completed: `admin.html` — Import Questions panel fully fixed.

## Backend State
- Edge Functions completed: `import-questions` — parallel chunk processing, correct response fields, per-row error isolation.

## Tests
- Manual verification needed: upload a valid Excel with 5+ questions via Import Questions panel.

## Known Issues
- N/A

## Blockers
- None.

## Next Exact Action
1. Open `admin.html` in browser (hard-refresh with Ctrl+Shift+R to clear cache).
2. Go to C — Class → Import Questions.
3. Select an exam, select exam type, upload a template, confirm preview renders.
4. Click Save — verify toast shows correct counts (not NaN).
5. Check Central Question Bank to confirm questions appear.

## Files Changed In Latest Step
- `js/admin/imports-exports.js` — Bug 1,2,3,4,5 fixed
- `supabase/functions/import-questions/index.ts` — Bug 6 fixed + response fields aligned
- `js/admin/app.js` — version bump (imports-exports v4.4.15)
- `admin.html` — version bump (app.js v4.4.15)
