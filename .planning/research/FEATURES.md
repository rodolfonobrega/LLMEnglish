# Feature Landscape

**Domain:** English learning app -- review algorithm fix, global error analysis, library history, evaluation trends
**Researched:** 2026-04-18

## Overview

This milestone covers one bug fix (review algorithm) and three new features (global error analysis, library history, evaluation trends). All build on existing infrastructure: SM-2 fields on `Card`, `errorAnalysis.ts` service, `SessionReport` type, and Supabase tables (`error_patterns`, `error_snapshots`, `card_reviews`, `card_evaluations`).

---

## Feature 1: Fix Review Algorithm

**Type:** Bug fix
**Priority:** Critical -- cards never appear in review queue, making the entire review system non-functional for new cards.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| New cards available for review immediately | Cards created via exercises must enter the review queue right away. Users who save a card expect to review it. Without this, the review feature is broken. | Low | **Root cause confirmed:** `createDefaultCard()` in `spacedRepetition.ts` does NOT set `nextReviewAt`. New cards get `nextReviewAt: undefined`. The query in `getCardsDueForReview()` filters `next_review_at <= now`, which excludes NULL values. Cards only get `nextReviewAt` set AFTER their first review via `updateCardSchedule()`, but they must first be found as "due" to be reviewed -- a chicken-and-egg deadlock. |
| "Intelligent Review" includes new cards | The intelligent review mode (`getPrioritizedReviewCards`) uses a priority score system without the `nextReviewAt` filter. It works for new cards but is hidden behind a toggle most users never click. | Low | Not a bug per se, but once standard review is fixed, intelligent review should also be audited to ensure consistent behavior. |

### The Fix

```typescript
// spacedRepetition.ts — createDefaultCard()
// BEFORE (broken): no nextReviewAt set
// AFTER (fix): set nextReviewAt to now so card enters review queue immediately
export function createDefaultCard(partial: ...): Card {
  const now = new Date().toISOString();
  return {
    ...partial,
    id: crypto.randomUUID(),
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    reviews: [],
    createdAt: now,
    nextReviewAt: now,  // <-- THE FIX
  };
}
```

Additionally, a **migration** is needed for existing cards that already have `nextReviewAt: null` in the database. Two options:
1. **Supabase SQL migration** (violates "no backend schema changes" constraint) -- can run a one-time update via Supabase dashboard
2. **Client-side fix** -- add a function that detects and repairs orphaned cards on load. Run once in `getCards()` or as a one-time migration in `runtimeState.ts`.

**Recommendation:** Use option 2 (client-side repair). A lightweight `fixOrphanedCards()` function that sets `nextReviewAt = createdAt` for any card where `nextReviewAt` is null and `reviews.length > 0` (cards that have been reviewed but lost their scheduling). For cards with zero reviews, set `nextReviewAt = now`.

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Switch to FSRS or Anki-style scheduler | Complete rewrite of scheduling logic. The SM-2 implementation is correct -- only the initialization is broken. | Fix the initialization bug. SM-2 is well-understood and sufficient for this app's scale. |
| Add card states (new/learning/review/relearning) | Anki-style state machine is more robust but over-engineering for the current Card type. Would require schema changes. | Keep the current `repetitions` counter as the implicit state. 0 = new, 1+ = learning/review. |
| Server-side scheduled review generation | Would require cron jobs or Supabase triggers. Overkill for a user-driven review flow. | Client computes `nextReviewAt` on review completion. Works fine once initialized. |

### Dependencies

- Existing: `Card` type has SM-2 fields, `updateCardSchedule()` computes correct next intervals, `getCardsDueForReview()` query works correctly for non-null `nextReviewAt`.
- Existing: Library page has a manual `handleScheduleReview()` workaround (line 74-76) that sets `nextReviewAt = now`. This confirms the team already knows cards need this field but missed the creation path.

---

## Feature 2: Global Error Analysis (Teacher-Style Progress Reports)

**Type:** New feature -- replaces per-sentence AI feedback with holistic progress report
**Priority:** High -- current error analysis is per-sentence and lacks the "teacher report" perspective

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Aggregate progress report across sessions | Language learners expect to see "you are improving at X, struggling with Y" -- not just individual error lists. The current `ErrorDashboard` shows patterns but lacks narrative synthesis. | Medium | Infrastructure exists: `ProgressSummary.text` already generates a short text summary, `ProgressTimeline` tracks scores over time, `ErrorStats.byCategory` has per-category counts. What's missing is a richer, teacher-style report. |
| Skill-level breakdown with narrative | Users want to know "Your verb tenses are improving but articles still need work" with specific examples, not just numbers. | Medium | `getProgressSummary()` already computes `improvingCategories` and `worseningCategories`. Extend this with: (1) AI-generated narrative using `chatCompletion()`, (2) specific examples from `ErrorPattern.examples`, (3) actionable recommendations per category. |
| Visual summary (report card style) | A "report card" view that summarizes overall progress in a scannable format. Not just lists of errors. | Medium | Build on existing `ErrorDashboard` structure. Add a new "Report Card" section or create a separate `/report` route. Use existing design tokens: `rounded-2xl` cards, color-coded categories, trend icons. |
| Period comparison (this week vs last week) | "Am I better than last week?" is the fundamental question. Current `getProgressSummary()` does 7-day vs previous-7-day comparison already. | Low | Already implemented in `errorAnalysis.ts` lines 518-535. May need to surface this more prominently in the UI and add month-over-month. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-generated teacher narrative | Instead of templated text ("You've improved in X"), use `chatCompletion()` to generate a natural, encouraging teacher-style paragraph that synthesizes all the error data. Feels like personal tutoring. | Medium | Send the `ErrorStats` + `ProgressTimeline` data as context to the AI. Use a system prompt like "You are an encouraging English teacher writing a weekly progress report for a Brazilian student." Cache the result for 24 hours to avoid repeated AI calls. |
| Per-skill radar/spider chart | Visual representation of proficiency across all 10 error categories. Instantly shows strengths and weaknesses. | Medium | No charting library currently in the project. Options: (1) pure CSS/SVG radar chart (no dependency), (2) lightweight chart lib like `recharts` (~45KB gzipped). Given the "no new framework additions" constraint, build a simple CSS-based radar or bar visualization using existing Tailwind utilities. |
| Actionable recommendations per category | "Practice prepositions with food vocabulary" instead of "You make preposition errors." Links to specific cards or exercises. | Medium | `getCategoryFocus()` already has generic focus text. Enhance with: cross-reference weak categories with available cards via `getCardsForWeakArea()`, generate specific exercise suggestions. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time streaming progress report | Teacher-style report doesn't need to stream. It's generated after session completion. | Generate on-demand, show loading spinner, cache result. |
| PDF export of progress report | `jspdf` already exists for this, but generating PDFs of rich HTML is fragile. Not core value. | Let users screenshot. Or add later as polish. |
| Comparative analytics (vs other users) | Requires backend aggregation, privacy considerations, and sufficient user base. | Self-comparison only (this week vs last week). |
| Per-sentence error feedback replacement | Don't remove per-sentence feedback entirely -- it's useful during exercises. The "global" report is additive. | Keep per-sentence feedback in exercises. Add a separate "Progress Report" view accessible from the error dashboard. |

### Dependencies

- Existing: `errorAnalysis.ts` has all data-fetching functions (`getErrorStats`, `getProgressTimeline`, `getProgressSummary`, `identifyWeakAreas`).
- Existing: `ErrorDashboard.tsx` is the current UI -- extend or create companion component.
- Existing: `chatCompletion()` in `openai.ts` for AI-generated narrative.
- New: Teacher report prompt in `utils/prompts.ts` for structured AI narrative generation.
- New: Caching mechanism for generated reports (localStorage or Supabase, avoid re-generating on every page load).

---

## Feature 3: Library History

**Type:** New feature -- per-card history view with recordings, scores, and progress over time
**Priority:** Medium -- enhances existing CardDetail with richer historical data

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Score timeline per card | Users who review a card 5+ times want to see if they're improving on THAT card specifically. Current `CardDetail` shows a list of recent reviews but no trend visualization. | Low-Medium | Data exists: `Card.reviews` array has `{ date, score, userTranscription }`. Build a simple bar/line chart showing scores over time. Pure CSS bars (like the existing progress bars in `ErrorDashboard`) are sufficient -- no chart library needed. |
| Play back past recordings | Users want to hear how they sounded on previous attempts. Currently only the latest `userAudioBlob` is stored. | Medium | **Problem:** `Card.userAudioBlob` stores only the latest recording. Past recordings are overwritten. To show history, either: (1) store recordings per review (requires schema change to `card_reviews` table), or (2) accept that only the latest recording is available and show the score timeline without historical audio. **Recommendation:** Option 2 for this milestone. Historical audio storage is a schema change that violates the constraint. |
| Review count and streak per card | "I've reviewed this card 8 times and got it right 3 times in a row" -- basic stats. | Low | `computeReviewStats()` already computes `totalReviews`, `correctCount`, `averageScore`. Add: current streak (consecutive scores >= 7 from most recent), longest streak, and first/last review dates. |
| Next review countdown | "This card will be reviewed again in 3 days" -- makes the SRS scheduling visible. | Low | `Card.nextReviewAt` already exists. Display as relative time ("in 3 days", "overdue by 2 days") using simple date math. No library needed. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Score trend indicator on library list | Show a small up/down arrow next to each card in the library list indicating if the user is improving on that card. Quick visual scan of progress. | Low | Compute trend from last 3 reviews vs previous 3 reviews (same logic as `calculateTrend()` in `errorAnalysis.ts`). Show as colored arrow icon in `LibraryPage` card list. |
| Review history with transcript comparison | For each past review, show what the user said vs what was correct. Currently only in the expandable `ErrorPatternCard` examples, not in the card's own history. | Low-Medium | `ReviewEntry` only has `{ date, score, userTranscription }`. It does NOT have `correctedVersion` or `corrections`. To show transcript comparison per review, either: (1) enhance `ReviewEntry` to include corrections (requires extending the type and storage), or (2) link reviews to evaluation history. **Recommendation:** Extend `ReviewEntry` to include optional `correctedVersion` and `score` fields. The `updateCard` path already saves reviews -- just add the correction data when saving. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full audio recording history | Would require storing blobs per review, exploding storage costs. Supabase free tier has limits. | Show score timeline. Only play back the latest recording. |
| Export card history as CSV/PDF | Nice-to-have but not core value. | Defer to future milestone. |
| Social sharing of progress | Requires social integration, privacy controls. | Not in scope. Self-tracking only. |

### Dependencies

- Existing: `Card.reviews` array provides historical score data.
- Existing: `CardDetail.tsx` is the current detail view -- extend it.
- Existing: `computeReviewStats()` in `types/review.ts`.
- Existing: `LibraryPage.tsx` card list can be enhanced with trend indicators.
- New: Small trend computation utility (can reuse `calculateTrend` pattern from `errorAnalysis.ts`).
- Constraint: No Supabase schema changes. This limits what historical data can be stored per review.

---

## Feature 4: Evaluation Improvement Trends

**Type:** New feature -- track whether user is getting better at specific skills over time
**Priority:** Medium -- extends existing error pattern tracking with longitudinal trend analysis

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-category trend over time | "Your grammar has improved 20% this month, but vocabulary is declining." Users expect to see directional trends, not just current state. | Medium | `ErrorPattern.trend` already exists ('improving'/'stable'/'worsening') but is computed per-pattern, not per-category. `getProgressSummary()` already compares 7-day windows. Need to: (1) compute category-level trends (aggregate all patterns in a category), (2) show trend direction and magnitude, (3) show over multiple time periods (week, month, all-time). |
| Trend visualization per skill | Visual representation of each error category over time. Not just text. | Medium | `ProgressTimeline.snapshots` already has `byCategory` counts per session. Build a multi-line or stacked visualization showing category trends. Use the same CSS bar approach as the existing "Progresso ao Longo do Tempo" section in `ErrorDashboard`, but per-category. |
| Milestone markers | "You resolved your first article error!" or "Verb tenses improving for 2 weeks straight." Gamification-style positive reinforcement. | Low-Medium | Track when categories transition from 'worsening' to 'stable' to 'improving'. Store these transitions. Show as badges or timeline markers. Can leverage existing `GamificationState.badges` infrastructure. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Predictive "time to mastery" estimate | "At your current rate, you'll master prepositions in about 2 weeks." Highly motivating. | Medium-High | Requires fitting a trend line to `recentScores` per category. Simple linear regression on the last N snapshots. Show estimated date when average score will reach 7+. Use with caution -- frame as encouragement, not promise. |
| Weak-area auto-practice suggestions | When a category trend is 'worsening', automatically suggest practicing those cards. "Your verb tenses are slipping -- review these 5 cards now." | Low-Medium | `getCardsForWeakArea()` already finds cards for a given category. Add a "Practice Now" button on worsening categories that navigates to review with those cards pre-loaded. Would need a way to pass card IDs to the review page (URL state or runtime state). |
| Category-level streaks | "You've scored 7+ on grammar for 5 consecutive reviews." Streak motivation at the skill level, not just daily practice streak. | Low | Compute from `SessionSnapshot.byCategory` data. If error count for a category stays at 0 or decreasing for N consecutive snapshots, that's a skill streak. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Machine learning model for prediction | Overkill. The user base and data volume don't warrant ML. Simple linear regression or moving average is sufficient. | Use simple statistical methods (moving average, linear regression on recent data). |
| Detailed linguistic analysis (phonemes, morphemes) | Requires specialized NLP/phonetic models. The current `guessCategory()` is keyword-based and sufficient for the app's granularity. | Keep the 10-category system. It maps well to learner perception. |
| External benchmarking (CEFR levels, IELTS scores) | Would require calibrated assessments, not just exercise performance data. | Show relative improvement (percentages, trend arrows). Not absolute levels. |

### Dependencies

- Existing: `error_patterns` table with `trend` and `recentScores` fields.
- Existing: `error_snapshots` table with `byCategory` counts and `date`.
- Existing: `ProgressTimeline` and `SessionSnapshot` types.
- Existing: `calculateTrend()` function in `errorAnalysis.ts`.
- New: Category-level trend aggregation function (combine patterns per category).
- New: Simple trend line visualization (CSS-based, no chart library).
- Consider: Adding more granular snapshot frequency (currently one per review session). Could add snapshots at exercise completion too for richer data.

---

## Cross-Feature Dependencies

```
Feature 1 (Review Algorithm Fix)
  -> Feature 3 (Library History): Review history data is only generated when cards enter the review queue. Fixing the algorithm is a prerequisite for meaningful history.
  -> Feature 4 (Evaluation Trends): Trends are computed from review scores. More reviews = better trend data.

Feature 2 (Global Error Analysis)
  -> Feature 4 (Evaluation Trends): The teacher report should incorporate trend data. Trends make the report more insightful.
  -> Uses: chatCompletion() for AI narrative

Feature 3 (Library History)
  -> Feature 4 (Evaluation Trends): Per-card score timeline feeds into category-level trends.
  -> Depends on: Feature 1 being fixed (cards must be reviewed to have history)

Feature 4 (Evaluation Trends)
  -> Depends on: Features 1, 2, 3 for rich data
  -> Extends: errorAnalysis.ts existing functions
```

## Implementation Order Recommendation

1. **Feature 1: Fix Review Algorithm** (Low effort, Critical priority)
   - Fix `createDefaultCard()` to set `nextReviewAt = now`
   - Add `fixOrphanedCards()` for existing data
   - Unblocks everything else

2. **Feature 3: Library History** (Low-Medium effort)
   - Extend `CardDetail` with score timeline
   - Add trend indicators to library list
   - Pure UI work, no schema changes

3. **Feature 2: Global Error Analysis** (Medium effort)
   - Add teacher report component
   - Create AI narrative prompt
   - Extend `ErrorDashboard` or add companion route

4. **Feature 4: Evaluation Trends** (Medium effort)
   - Add category-level trend aggregation
   - Build trend visualizations
   - Add weak-area auto-practice suggestions
   - Depends on accumulated data from Features 1-3

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Review algorithm bug root cause | HIGH | Confirmed by direct code analysis. `createDefaultCard()` lacks `nextReviewAt`. Query excludes NULL. Clear chicken-and-egg deadlock. |
| Global error analysis feasibility | HIGH | All data infrastructure exists (`errorAnalysis.ts`, Supabase tables). Only needs UI component and AI prompt. |
| Library history scope | MEDIUM | Score timeline is straightforward. Historical audio is blocked by schema constraint. Trend indicators are low-complexity. |
| Evaluation trends | MEDIUM | Data exists in snapshots. Category aggregation is straightforward. "Time to mastery" prediction is a nice-to-have that needs careful framing. |
| No-schema-changes constraint impact | MEDIUM | Review history enrichment (adding `correctedVersion` to `ReviewEntry`) can be done client-side. Audio history is blocked. Teacher report caching can use localStorage. |

## Sources

- Direct codebase analysis: `src/services/spacedRepetition.ts`, `src/types/card.ts`, `src/services/supabase/storage.ts`, `src/services/errorAnalysis.ts`, `src/types/errors.ts`, `src/components/review/ReviewPage.tsx`, `src/components/library/LibraryPage.tsx`, `src/components/library/CardDetail.tsx`, `src/components/errors/ErrorDashboard.tsx`, `src/types/gamification.ts`, `src/types/review.ts`
- SM-2 algorithm reference: SuperMemo official documentation, Anki implementation notes
- Existing review workaround: `LibraryPage.tsx` line 74-76 (`handleScheduleReview`) confirms manual scheduling is a known workaround
