# Architecture Patterns

**Domain:** Review algorithm fix, global error analysis, library history, evaluation trends
**Researched:** 2026-04-18
**Confidence:** HIGH (based on direct codebase analysis of all relevant source files)

## Recommended Architecture

### Current System Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ ReviewPage│  │ErrorDash │  │LibraryPage│  │ HistoryPage   │  │
│  │(review/) │  │(errors/) │  │(library/) │  │ (history/)    │  │
│  └────┬─────┘  └────┬─────┘  └────┬──────┘  └──────┬────────┘  │
│       │             │              │                 │           │
│  ┌────▼─────────────▼──────────────▼─────────────────▼────────┐ │
│  │                    Storage Facade                           │ │
│  │              (src/services/storage.ts)                      │ │
│  └──────────────────────┬────────────────────────────────────┘ │
│                         │                                       │
│  ┌──────────┐  ┌───────▼────────┐  ┌──────────────────────┐   │
│  │spacedRep │  │ errorAnalysis  │  │ runtimeState         │   │
│  │.ts       │  │ .ts            │  │ .ts (in-memory cache) │   │
│  └──────────┘  └───────┬────────┘  └──────────────────────┘   │
│                        │                                       │
│  ┌─────────────────────▼─────────────────────────────────────┐ │
│  │          Supabase Storage (supabase/storage.ts)           │ │
│  │  Tables: cards, card_reviews, card_evaluations,           │ │
│  │  error_patterns, error_snapshots, session_reports,        │ │
│  │  live_sessions, gamification, path_progress               │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Fix Review Algorithm

**Root cause analysis (HIGH confidence):**

The SM-2 algorithm in `spacedRepetition.ts` is correct. The bug is a query gap in the data layer.

The `getCardsDueForReview()` function in `supabase/storage.ts` (line 248) queries:
```typescript
.lte('next_review_at', now)
```

This returns only cards where `next_review_at IS NOT NULL AND <= now`. Cards that have **never been reviewed** have `next_review_at = null` and are **never returned**. The `createDefaultCard()` function in `spacedRepetition.ts` (line 49) creates cards with no `nextReviewAt` field at all.

The "intelligent" mode (`getPrioritizedReviewCards` in `errorAnalysis.ts` line 390) loads ALL cards and sorts by priority, which accidentally works around the null issue. But standard review mode is broken because new cards never appear.

**Fix strategy (modify only, no new components):**

| File | Change | Type |
|------|--------|------|
| `src/services/supabase/storage.ts` | Fix `getCardsDueForReview()` to include cards where `next_review_at IS NULL` using an OR filter | MODIFY |
| `src/components/review/ReviewPage.tsx` | Minor: ensure empty state handles the case where all cards are "new" (never reviewed) | MODIFY |

**Data flow after fix:**

```
ReviewPage.loadDueCards('standard')
  -> getCardsDueForReview()
    -> supabase query:
         next_review_at <= now    (cards due for review)
         OR next_review_at IS NULL (new cards, never reviewed)
    -> returns union of due + new cards
  -> ReviewPage renders them

ReviewPage.loadDueCards('intelligent')
  -> getPrioritizedReviewCards(20)  (no change needed)
    -> getCards() -> sort by priority -> slice(20)
```

**No new types, no new tables, no new routes, no algorithm changes needed.**

---

## Feature 2: Global Error Analysis (Teacher Reports)

**Current state:** `ErrorDashboard.tsx` shows per-pattern error listings with category breakdowns. `errorAnalysis.ts` already has `getProgressSummary()` and `getProgressTimeline()` that aggregate across sessions. The `error_snapshots` table already captures cross-session data with `by_category`, `average_score`, etc.

**What needs to change:** Replace the per-pattern drill-down UX with a higher-level "teacher report" view. This is primarily a **UI restructure** of `ErrorDashboard.tsx`, plus one new AI-powered service function that synthesizes data into natural language.

**Changes needed:**

| File | Change | Type |
|------|--------|------|
| `src/types/errors.ts` | Add `TeacherReport` type with sections: overallAssessment, strengths, areasForImprovement, recommendedExercises, weeklyGoal | MODIFY |
| `src/services/errorAnalysis.ts` | Add `generateTeacherReport(stats, timeline, weakAreas)` -- calls AI via `chatCompletion` to produce a structured natural-language report | MODIFY |
| `src/utils/prompts.ts` | Add `getTeacherReportPrompt()` -- structured prompt that sends error stats, timeline data, and asks for teacher-style feedback in JSON format | MODIFY |
| `src/components/errors/ErrorDashboard.tsx` | Major UI restructure: teacher report as hero section, per-pattern cards as supporting detail behind expand/toggle | MODIFY |

**Data flow:**

```
ErrorDashboard mounts
  -> loadStats() fetches:
       getErrorStats()
       identifyWeakAreas()
       getProgressTimeline()
       getProgressSummary()
  -> generateTeacherReport(stats, timeline, weakAreas)
    -> formats data into prompt via getTeacherReportPrompt()
    -> chatCompletion(prompt) -> AI generates structured JSON report
    -> parse into TeacherReport type
  -> ErrorDashboard renders:
       Teacher report as hero section (top)
       Skill trends section (Feature 4)
       Category breakdown (existing, repositioned)
       Per-pattern cards (existing, behind toggle)
```

**Constraint check:** AI call goes through existing `chatCompletion` which routes through the Supabase Edge Function proxy. No new backend needed. Report is generated on-demand and held in component state only -- never persisted to DB (reports are views of current data and would become stale).

---

## Feature 3: Library History

**Current state:** `LibraryPage.tsx` shows a flat card list with basic review stats (`computeReviewStats`). `CardDetail.tsx` shows individual card review history (last 5 reviews). No lesson-level aggregation exists.

**Key insight:** The `SessionReport` type (`src/types/gamification.ts`) already tracks `date`, `type`, `scores`, `averageScore`, `exercisesCompleted`, `timeSpentSeconds`, `improvements`. These are stored in the `session_reports` Supabase table. The data already exists -- the Library page just does not display it.

**"Lesson history" means:** Aggregating `SessionReport` data into a timeline view within the Library, showing each practice session with its scores, time spent, and improvement notes.

**Changes needed:**

| File | Change | Type |
|------|--------|------|
| `src/types/review.ts` | Add `LessonHistory` type: session type, date, scores, average, time spent, improvements | MODIFY |
| `src/components/library/LessonHistoryCard.tsx` | New component: renders a single session's history with score indicator, duration, type badge, expandable details | NEW |
| `src/components/library/LibraryPage.tsx` | Add session history section below card list: load session reports via `getSessionReports()`, group by date, render LessonHistoryCards | MODIFY |

**Data flow:**

```
LibraryPage mounts
  -> loadCards() (existing)
  -> loadSessionHistory() (NEW)
    -> getSessionReports() (already exposed by storage facade)
    -> group by date (day-level granularity)
    -> map to LessonHistory[]
  -> Render layout:
       Card list (existing, top)
       Lesson history section (new, below)
         -> Each LessonHistoryCard shows:
              Session type badge (exercise/review/live-roleplay)
              Date and time
              Average score with color-coded indicator
              Duration
              Expandable: individual exercise scores, improvement notes
```

**No new Supabase tables needed.** `session_reports` already has all required data. `MAX_SESSION_REPORTS = 200` caps the data volume.

---

## Feature 4: Evaluation Improvement Trends

**Current state:** `errorAnalysis.ts` already calculates per-pattern trends (`calculateTrend` function at line 144) and per-category improvement/worsening in `getProgressSummary()`. `ErrorDashboard` shows these at the pattern level. But there is no **skill-level** trend view with week-over-week deltas.

**What is needed:** Aggregate evaluation scores by skill category over time, compute week-over-week deltas, and display as a clear trend visualization.

**Changes needed:**

| File | Change | Type |
|------|--------|------|
| `src/types/errors.ts` | Add `SkillTrend` type: category, currentScore, previousScore, delta, trend direction, dataPoints count | MODIFY |
| `src/services/errorAnalysis.ts` | Add `getSkillTrends()` -- loads snapshots, partitions into this-week vs last-week, computes per-category deltas | MODIFY |
| `src/components/errors/ErrorDashboard.tsx` | Add skill trends section with visual delta indicators per category | MODIFY |

**Data flow:**

```
getSkillTrends()
  -> loadSnapshots() (existing, error_snapshots table)
  -> partition snapshots: this-week (last 7 days) vs last-week (7-14 days ago)
  -> for each ErrorCategory:
       - avg by_category count this week vs last week
       - compute delta = thisWeek - lastWeek
       - determine trend: improving (delta < -0.5), stable, worsening (delta > 0.5)
  -> return SkillTrend[]

ErrorDashboard renders SkillTrend[] as a section:
  - Each skill gets a row: category icon + name + delta arrow + percentage change
  - Color coded: green (improving), amber (stable), red (worsening)
```

**Reuses existing `error_snapshots` data.** No new tables. Capped at 100 snapshots per user.

---

## Component Boundaries Summary

### Modified Components

| Component | Feature | What Changes | Risk |
|-----------|---------|-------------|------|
| `src/services/supabase/storage.ts` | Review fix | `getCardsDueForReview()` adds OR filter for null next_review_at | LOW |
| `src/components/review/ReviewPage.tsx` | Review fix | Minor empty-state handling for new cards | LOW |
| `src/types/errors.ts` | Teacher report, Trends | Add `TeacherReport`, `SkillTrend` types | LOW |
| `src/services/errorAnalysis.ts` | Teacher report, Trends | Add `generateTeacherReport()`, `getSkillTrends()` | MEDIUM |
| `src/utils/prompts.ts` | Teacher report | Add `getTeacherReportPrompt()` | LOW |
| `src/components/errors/ErrorDashboard.tsx` | Teacher report, Trends | Major UI restructure with new sections | MEDIUM |
| `src/types/review.ts` | Library history | Add `LessonHistory` type | LOW |
| `src/components/library/LibraryPage.tsx` | Library history | Add session history section | LOW |

### New Components

| Component | Feature | Purpose |
|-----------|---------|---------|
| `src/components/library/LessonHistoryCard.tsx` | Library history | Renders a single lesson's history entry with score, duration, expandable details |

### Unchanged Components

| Component | Why No Change Needed |
|-----------|---------------------|
| `src/services/storage.ts` (facade) | Already exposes `getSessionReports()`, `getCardsDueForReview()` and all other needed functions |
| `src/services/spacedRepetition.ts` | Algorithm is correct; bug is in the query layer |
| `src/services/runtimeState.ts` | No state changes for these features |
| `src/services/gamification.ts` | Gamification continues working as-is |
| `src/App.tsx` | No new routes needed |
| `src/types/card.ts` | Card type is sufficient |
| `src/types/gamification.ts` | SessionReport type is sufficient |
| `src/components/history/HistoryPage.tsx` | Separate concern (live roleplay sessions only, not exercise sessions) |
| `src/components/library/CardDetail.tsx` | Individual card detail stays the same |

---

## Patterns to Follow

### Pattern 1: Service-First Feature Addition
**What:** Add data logic to services first, then consume from UI.
**When:** All four features follow this pattern.
**Example:**
```typescript
// 1. Add to errorAnalysis.ts
export async function getSkillTrends(): Promise<SkillTrend[]> {
  const snapshots = await loadSnapshots();
  // ... compute trends
}

// 2. Consume in ErrorDashboard.tsx
const [skillTrends, setSkillTrends] = useState<SkillTrend[]>([]);
useEffect(() => {
  void (async () => {
    const trends = await getSkillTrends();
    setSkillTrends(trends);
  })();
}, []);
```

### Pattern 2: AI-Augmented Analysis via Existing Proxy
**What:** Use `chatCompletion` from `openai.ts` for AI-generated teacher reports. This routes through the Supabase Edge Function proxy, respecting the security architecture.
**When:** Teacher report generation.
**Example:**
```typescript
const reportText = await chatCompletion(
  'You are an expert English teacher providing a progress report.',
  getTeacherReportPrompt(stats, timeline, weakAreas),
  undefined,
  teacherReportResponseSchema  // JSON schema for structured output
);
```

### Pattern 3: No-Schema Data Aggregation
**What:** Compute derived data from existing tables rather than adding new tables. All aggregations happen client-side from `error_snapshots`, `session_reports`, and `card_reviews`.
**When:** Library history (from `session_reports`), skill trends (from `error_snapshots`).
**Why:** Respects the client-side-only constraint. No migration files, no schema changes, no Supabase admin access needed.

### Pattern 4: Query-Level Bug Fixes
**What:** Fix the review bug at the query layer, not the algorithm layer. The SM-2 algorithm is mathematically correct; the issue is that the Supabase query does not return cards that have never been scheduled.
**When:** Review algorithm fix.
**Implementation:** Use Supabase's `.or()` filter method:
```typescript
const { data, error } = await supabase
  .from('cards')
  .select(`*, card_reviews(*), card_evaluations(*)`)
  .eq('user_id', userId)
  .or(`next_review_at.lte.${now},next_review_at.is.null`)
  .order('next_review_at', { ascending: true, nullsFirst: true })
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding New Supabase Tables or Migrations
**What:** Creating new migration files for data that can be derived from existing tables.
**Why bad:** Violates the client-side-only constraint. Creates migration complexity and requires schema changes.
**Instead:** Use client-side aggregation from `session_reports`, `error_snapshots`, `card_reviews`.

### Anti-Pattern 2: Storing AI-Generated Reports in the Database
**What:** Saving teacher reports to a new table for retrieval.
**Why bad:** Reports are ephemeral views of current data. Stale reports would be misleading and waste storage.
**Instead:** Generate on-demand when ErrorDashboard loads. Cache in component state only. Add a "Regenerate" button.

### Anti-Pattern 3: Modifying the SM-2 Algorithm Itself
**What:** Changing the interval/easeFactor formulas in `spacedRepetition.ts`.
**Why bad:** The algorithm is mathematically correct SM-2. Changing it risks introducing new bugs in a system that works for already-reviewed cards.
**Instead:** Fix `getCardsDueForReview()` to include cards with `next_review_at IS NULL`. The algorithm does not need to change.

### Anti-Pattern 4: Mixing Library History with Live Session History
**What:** Combining exercise session data into `HistoryPage.tsx` (which shows live roleplay sessions only).
**Why bad:** Different data shapes (SessionReport vs LiveSession), different user mental models (exercise sessions vs roleplay conversations), different navigation context.
**Instead:** Add lesson history to `LibraryPage.tsx`. Keep `HistoryPage.tsx` for live roleplay only.

### Anti-Pattern 5: Over-Engineering the Skill Trends Visualization
**What:** Building a custom charting library or pulling in a chart library dependency.
**Why bad:** The existing codebase uses simple CSS bar charts (see ErrorDashboard progress-over-time section). Adding a chart library violates the "no new framework additions" constraint.
**Instead:** Use the same CSS-based bar/indicator pattern already in `ErrorDashboard.tsx` for skill trends. Simple colored bars with delta arrows are sufficient.

---

## Suggested Build Order

### Phase 1: Fix Review Algorithm
**Rationale:** This is a bug fix that unblocks the review flow. Zero risk of regression since it only widens the query. No dependencies on other features. Should ship first because users cannot use the review feature at all right now.

**Files touched:**
- `src/services/supabase/storage.ts` -- fix `getCardsDueForReview()` query
- `src/components/review/ReviewPage.tsx` -- minor empty-state adjustment

**Dependencies:** None
**Risk:** LOW (widening a query, no algorithm change)

### Phase 2: Evaluation Improvement Trends
**Rationale:** Pure data aggregation from existing `error_snapshots`. No AI calls needed. Extends existing error types and service. Can be built and tested independently. Low risk because it only adds a read-only aggregation function.

**Files touched:**
- `src/types/errors.ts` -- add `SkillTrend` type
- `src/services/errorAnalysis.ts` -- add `getSkillTrends()`
- `src/components/errors/ErrorDashboard.tsx` -- add skill trends section

**Dependencies:** None
**Risk:** LOW (read-only aggregation from existing data)

### Phase 3: Library History
**Rationale:** Consumes existing `session_reports` data. New UI component but no service changes beyond what already exists (`getSessionReports()` is already in the storage facade). Independent of error analysis features.

**Files touched:**
- `src/types/review.ts` -- add `LessonHistory` type
- `src/components/library/LessonHistoryCard.tsx` -- new component
- `src/components/library/LibraryPage.tsx` -- add history section

**Dependencies:** None
**Risk:** LOW (new UI consuming existing data via existing API)

### Phase 4: Global Error Analysis (Teacher Reports)
**Rationale:** Most complex feature. Depends on AI call which needs prompt engineering and JSON schema parsing. Should be last because it synthesizes data that the other features produce. The AI-generated report quality benefits from having skill trends data (Phase 2) available. Also the largest UI change (ErrorDashboard restructure), so doing it last means we touch that file once for both Phase 2 and Phase 4 changes.

**Files touched:**
- `src/types/errors.ts` -- add `TeacherReport` type
- `src/utils/prompts.ts` -- add `getTeacherReportPrompt()`
- `src/services/errorAnalysis.ts` -- add `generateTeacherReport()`
- `src/components/errors/ErrorDashboard.tsx` -- major restructure

**Dependencies:** Phase 2 (trends data enriches the teacher report)
**Risk:** MEDIUM (AI prompt engineering, JSON parsing, latency on dashboard load)

---

## Dependency Graph

```
Phase 1: Review Fix
    (no dependencies, ships immediately)

Phase 2: Skill Trends
    (no dependencies, can run in parallel with Phase 1)

Phase 3: Library History
    (no dependencies, can run in parallel with Phase 1 and 2)

Phase 4: Teacher Reports
    depends on Phase 2 (consumes getSkillTrends() data)
    also benefits from touching ErrorDashboard once (after Phase 2 adds its section)
```

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | Notes |
|---------|--------------|--------------|-------|
| Review query with null OR clause | Fine -- Supabase handles it with standard index | Fine -- `next_review_at` is already queried; null check is cheap | Consider adding composite index on `(user_id, next_review_at)` if latency appears |
| AI teacher report generation | Fine -- one call per dashboard load | Could hit AI rate limits on rapid reloads | Cache report in component state; add "Regenerate" button instead of auto-calling on every mount |
| Session report aggregation (library history) | Fine -- client-side from 200 max reports | Fine -- `MAX_SESSION_REPORTS` caps at 200 | No change needed |
| Error snapshot loading for trends | Fine -- 100 max snapshots | Fine -- capped at 100 in `recordSessionSnapshot()` | No change needed |
| Supabase query count per page load | 4-6 queries on ErrorDashboard | Same -- all are indexed reads | Could batch with Promise.all (already done for initial load) |

---

## Sources

- Direct codebase analysis of all relevant source files (HIGH confidence)
- `src/services/spacedRepetition.ts` -- SM-2 algorithm implementation (confirmed correct)
- `src/services/supabase/storage.ts` lines 248-270 -- `getCardsDueForReview()` query (bug identified: null filter missing)
- `src/services/errorAnalysis.ts` -- error pattern tracking, progress timeline, weak areas
- `src/components/review/ReviewPage.tsx` -- review flow consumer, two modes (standard/intelligent)
- `src/components/errors/ErrorDashboard.tsx` -- current error analysis UI (to be restructured)
- `src/components/library/LibraryPage.tsx` -- current library UI (to be extended with history)
- `src/components/library/CardDetail.tsx` -- individual card detail (unchanged)
- `src/types/card.ts`, `src/types/errors.ts`, `src/types/gamification.ts`, `src/types/review.ts` -- type definitions
- `src/App.tsx` -- route definitions (no changes needed)
