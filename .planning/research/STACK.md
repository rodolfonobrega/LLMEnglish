# Stack Research: v1.4 Review Fix, Global Analysis, Library History

**Domain:** Fixing spaced repetition review bug, adding teacher-style error analysis, building library history with progress tracking in an existing React 19 + Supabase SPA
**Researched:** 2026-04-18
**Confidence:** HIGH (all findings verified by direct codebase analysis)

## Executive Summary

**No new production dependencies are needed.** All four features are achievable with the existing stack through code fixes, new UI components, and an AI prompt change. The data layer (Supabase tables) already contains everything needed -- the gaps are in application logic and UI rendering.

## Recommended Stack Changes

### Production Dependencies: NONE

| Library | Version | Purpose | Why Not Needed / Why Excluded |
|---------|---------|---------|-------------------------------|
| `recharts` | -- | Chart library for history/trends | EXCLUDED. The existing `ErrorDashboard.tsx` already renders progress bars using pure CSS (`<div>` with percentage heights). Adding a 180KB chart library for simple score-over-time line charts and category breakdowns violates the "no new framework additions" constraint and is overkill for the data volumes involved (dozens of snapshots, not thousands of data points). |
| `chart.js` / `react-chartjs-2` | -- | Alternative chart library | EXCLUDED. Same rationale as recharts. 65KB+ for charts the codebase already renders with CSS. |
| `d3` | -- | Low-level chart primitives | EXCLUDED. Far too low-level for what's needed. The visualization is bar charts and sparklines, not complex interactive data exploration. |
| `lightweight-charts` | -- | Minimal chart library | EXCLUDED. Purpose-built for financial time-series (candlesticks). Wrong abstraction for score-over-time visualizations. |
| `idb` / `localforage` | -- | IndexedDB for audio caching | EXCLUDED. Library history needs metadata from Supabase tables (`card_reviews`, `session_reports`), not large binary storage. Audio playback for historical recordings is a separate concern that can be addressed later if needed. |

### What IS Needed (Code Changes, No Installs)

| Change Area | Files Affected | Type | Rationale |
|-------------|---------------|------|-----------|
| Fix SRS review bug | `src/services/spacedRepetition.ts` | Bug fix | `createDefaultCard()` never sets `nextReviewAt`, so new cards are invisible to `getCardsDueForReview()` which filters `WHERE next_review_at <= NOW()`. Set `nextReviewAt = new Date()` (immediately available) in `createDefaultCard`. |
| Fix SRS query fallback | `src/services/supabase/storage.ts` | Bug fix | `getCardsDueForReview()` only returns cards with `next_review_at` set. Add a fallback: if no due cards found, return cards that have never been reviewed (`next_review_at IS NULL AND repetitions = 0`) up to a limit, so new cards enter the review cycle. |
| Global error analysis prompt | `src/utils/prompts.ts` | Content change | Replace per-sentence feedback prompt with a teacher-style progress report prompt that analyzes aggregate patterns across the session. The AI call infrastructure (`chatCompletion`) already exists. |
| Global analysis UI | `src/components/errors/ErrorDashboard.tsx` | UI redesign | Restructure the dashboard to show teacher-style report cards instead of per-error-item lists. Use existing Tailwind CSS + motion animations. |
| Library history UI | New: `src/components/library/LibraryHistory.tsx` or extend `CardDetail.tsx` | New component | Query existing `card_reviews` (already has date, score, user_transcription) and render a chronological history with CSS bar charts (same pattern as ErrorDashboard). |
| Library history data query | `src/services/supabase/storage.ts` | New function | Add `getCardReviewHistory(cardId: string): Promise<ReviewEntry[]>` that queries `card_reviews` ordered by date. No new tables needed -- `card_reviews` already stores all review history. |
| Evaluation trends | `src/components/library/CardDetail.tsx` or new component | UI enhancement | Render `ErrorPattern.trend` and `ErrorPattern.recentScores` as sparkline/mini-chart using CSS. Data already computed in `errorAnalysis.ts` via `calculateTrend()`. |
| Session history aggregation | `src/services/errorAnalysis.ts` or new service | Logic | Aggregate `session_reports` and `error_snapshots` into per-lesson score trends. Data already in Supabase; needs a new query function and UI component. |

## Architecture for Each Feature

### 1. Fix Review Algorithm (SM-2)

**Root cause (verified in code):**

```
spacedRepetition.ts:49-58  createDefaultCard() -- no nextReviewAt set
spacedRepetition.ts:36     nextReview field only set AFTER first review via updateCardSchedule()
supabase/storage.ts:260    getCardsDueForReview() filters .lte('next_review_at', now)
                           SQL: WHERE next_review_at <= NOW() -- NULL never matches
```

**Fix strategy (two changes, no new dependencies):**

1. In `createDefaultCard()`, set `nextReviewAt: new Date().toISOString()` so new cards are immediately available for review.
2. In `getCardsDueForReview()`, add an `OR` condition to also return cards with `next_review_at IS NULL` (never reviewed), capped at a reasonable limit, sorted by creation date (oldest first). This catches existing cards already saved without `nextReviewAt`.

The SM-2 algorithm itself (`updateCardSchedule`) is correct -- intervals of 1 day, 6 days, then `interval * easeFactor` with proper ease adjustments. The bug is purely in the initial state of new cards.

**Integration point:** `ReviewPage.tsx` line 48 calls `getCardsDueForReview()`. No changes needed in the review page itself -- the fix propagates automatically through the storage layer.

### 2. Global Error Analysis (Teacher Reports)

**Current state (verified in code):**

- `errorAnalysis.ts` has per-correction pattern extraction (`extractErrorPatterns`) and per-session snapshots (`recordSessionSnapshot`)
- `ErrorDashboard.tsx` shows per-pattern cards with individual error details
- The AI evaluation in `ReviewPage.tsx` calls per-card evaluation and generates individual `corrections[]`

**Change strategy (prompt + UI, no new dependencies):**

1. **New AI prompt** in `src/utils/prompts.ts`: Add a `getTeacherReportPrompt()` function that takes aggregated session data (all corrections from the session, overall scores, error categories) and asks the AI to produce a teacher-style progress report with sections like "Strengths," "Areas to Improve," "Specific Patterns Noticed," and "Recommended Practice." This is a prompt engineering change, not a code architecture change.

2. **Aggregate at session end:** In `ReviewPage.tsx` (or extracted to a service), collect all `EvaluationResult`s from the session, group corrections by category, and send a single AI call for the global report instead of showing per-sentence feedback.

3. **UI redesign of ErrorDashboard:** Replace the per-pattern card list with a structured teacher report view. Use existing components: `Badge` for categories, `ScoreDisplay` for overall scores, `motion` for animated section reveals. The CSS bar chart pattern from the current "Progress Over Time" section (lines 183-216) can be reused for category breakdowns.

**Integration point:** The AI call goes through the existing `chatCompletion()` which handles provider routing and fallback. No changes to the AI service layer.

### 3. Library History (Per-Lesson Timeline)

**Current state (verified in code):**

- `card_reviews` table has: `card_id`, `date`, `score`, `user_transcription` -- full review history
- `LibraryPage.tsx` currently shows a flat card list with basic stats (`computeReviewStats` gives totalReviews, correctCount, averageScore)
- `CardDetail.tsx` shows single card detail but no historical timeline
- `session_reports` table has per-session aggregate data with scores array and date

**Change strategy (new UI component + query, no new dependencies):**

1. **New storage function:** `getCardReviewHistory(cardId)` -- simple Supabase query on `card_reviews` ordered by `date ASC`. Already has an index: `idx_card_reviews_card_id ON card_reviews(card_id)`.

2. **New component:** `LibraryHistory` -- render a timeline of reviews with:
   - Date + score for each review (data from `card_reviews`)
   - CSS bar chart showing score trend over time (same pattern as ErrorDashboard snapshots)
   - `motion` animations for sequential reveal of timeline items
   - Audio playback buttons for transcriptions (using existing `useTTS` hook)

3. **Integration into LibraryPage:** Add a "History" tab or expand `CardDetail` to show the timeline. No routing changes needed.

**Why no chart library:** The data is simple time-series with 5-50 data points per card. A CSS bar chart with percentage heights (already used in ErrorDashboard) handles this perfectly. Adding recharts (180KB) or chart.js (65KB) for this volume of data is unjustified.

### 4. Evaluation Improvement Trends

**Current state (verified in code):**

- `ErrorPattern` type already has `trend: 'improving' | 'stable' | 'worsening'` and `recentScores: number[]`
- `calculateTrend()` in `errorAnalysis.ts` already computes trends from recent vs older scores
- `ErrorDashboard` already shows trend icons (`TrendingUp`, `TrendingDown`, `Minus` from lucide-react)
- `ProgressTimeline` type has `overallTrend` and per-snapshot scores

**Change strategy (UI enhancement, no new dependencies):**

1. **Sparkline component:** Build a tiny CSS sparkline from `recentScores` array. Each score becomes a percentage-height `<div>` in a flex row. Zero dependencies, ~20 lines of JSX.

2. **Skill radar:** Show per-category trend indicators using the existing `byCategory` data from `SessionSnapshot`. Use CSS grid + colored badges (existing `CATEGORY_COLORS` from ErrorDashboard). No radar chart library needed -- a simple 2-column grid with trend icons is more readable at a glance.

3. **Trend summary card:** Extract the top 3 improving and top 3 worsening categories into a summary card. Data already available from `getProgressSummary()` which returns `improvingCategories` and `worseningCategories`.

**Integration point:** Extend `ErrorDashboard.tsx` or create a new `EvaluationTrends.tsx` component. Data flows from existing `errorAnalysis.ts` functions -- no new queries needed.

## Existing Stack Elements Being Leveraged

| Existing Tech | Feature | How Used |
|---------------|---------|----------|
| `motion` 12.33 | Library history, trends | Animate timeline entries, sparkline bars, and trend reveals. Already used throughout the app. |
| `lucide-react` 0.563 | All features | `TrendingUp/Down`, `Calendar`, `History`, `BarChart3`, `Award` icons for the new UIs. Already installed. |
| `Badge` component | All features | Category labels, trend indicators, score badges. Already in `src/components/ui/`. |
| `ScoreDisplay` component | Library history, trends | Reuse for showing per-review and aggregate scores. Already in `src/components/shared/`. |
| `Button`, `Dialog`, `Input` UI primitives | All features | Standard interaction patterns. Already in `src/components/ui/`. |
| Tailwind CSS 4 + CSS variables | All features | Styling with existing design tokens (`--mode-*`, `--brand-*`, `--leaf`, `--amber`, `--danger`). No new CSS needed. |
| Supabase `card_reviews` table | Library history | Already indexed by `card_id`. Full review history with scores and dates. |
| Supabase `error_patterns` table | Trends | Already tracks `trend`, `recentScores`, `category`, `occurrences`. |
| Supabase `error_snapshots` table | Global analysis | Already records periodic snapshots with `by_category`, `averageScore`. |
| Supabase `session_reports` table | Library history | Per-session aggregates with scores array and date. |
| `chatCompletion()` AI service | Global analysis | Route teacher report prompt through existing provider routing. |

## Installation

```bash
# NOTHING TO INSTALL
# All features use existing stack with code changes only
```

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `recharts` (180KB) | Overkill for simple score timelines. Violates "no new framework additions" constraint. The ErrorDashboard already renders charts with CSS. | CSS bar charts with `motion` animations (existing pattern in ErrorDashboard.tsx) |
| `chart.js` + `react-chartjs-2` (65KB+) | Same as recharts. Canvas-based rendering is unnecessary for bar charts with <50 data points. | CSS flexbox bars with percentage heights |
| `d3` (250KB) | Absurdly overpowered for sparklines and bar charts. | CSS sparkline component (~20 lines JSX) |
| `victory` (150KB) | Formidable Labs' chart library. Heavier than needed, adds React dependency version constraints. | CSS-only visualizations |
| `uplot` (25KB) | Ultra-light canvas charting. Close to acceptable size but still unnecessary -- the data volumes don't warrant canvas rendering. DOM-based CSS bars are simpler and more accessible. | CSS bar charts |
| State management library (Zustand, Jotai) | The existing pattern (service functions + `useState` + window events) works fine. Adding a state library for 4 features is scope creep. | Existing `useState` + service function pattern |
| Date utility library (date-fns, dayjs) | The existing code uses native `Date` throughout (`isToday`, `isYesterday` in `gamification.ts`). Introducing a date library for formatting in the history timeline is unnecessary weight. | Native `Date` + `toLocaleDateString('pt-BR', ...)` (already used in ErrorDashboard) |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| SRS bug fix | HIGH | Root cause verified in code: `createDefaultCard` missing `nextReviewAt`, query requires non-null `next_review_at`. Two-line fix. |
| Global error analysis | HIGH | AI prompt change + UI redesign. All infrastructure exists: `chatCompletion()`, `extractErrorPatterns()`, error dashboard. |
| Library history | HIGH | Data already in `card_reviews` table with proper indexes. Need one new Supabase query and one new React component. |
| Evaluation trends | HIGH | Data already computed (`calculateTrend`, `recentScores`, `ProgressTimeline`). Need UI component only. |
| "No new dependencies" claim | HIGH | Verified by reading all relevant source files, types, and database schema. Every data point needed is already persisted in Supabase. |

## Sources

- Direct codebase analysis of: `src/services/spacedRepetition.ts`, `src/services/errorAnalysis.ts`, `src/services/supabase/storage.ts`, `src/types/card.ts`, `src/types/errors.ts`, `src/types/gamification.ts`, `src/components/review/ReviewPage.tsx`, `src/components/errors/ErrorDashboard.tsx`, `src/components/library/LibraryPage.tsx`
- Database schema: `supabase/migrations/20260324221155_initial_schema.sql` -- verified `card_reviews`, `error_patterns`, `error_snapshots`, `session_reports` tables and indexes
- Web search unavailable (rate limited) -- all findings based on direct code inspection, which is higher confidence for this type of "what do we already have?" research

---
*Stack research for: SpeakLab v1.4 Review, Analysis & Library milestone*
*Researched: 2026-04-18*
