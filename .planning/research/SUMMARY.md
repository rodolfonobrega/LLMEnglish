# Project Research Summary

**Project:** SpeakLab -- v1.4 Review Fix, Global Analysis, Library History
**Domain:** English learning app -- spaced repetition bug fix, teacher-style progress reports, library history with trends
**Researched:** 2026-04-18
**Confidence:** HIGH

## Executive Summary

SpeakLab v1.4 is a targeted hardening milestone for an existing React 19 + Supabase SPA. It fixes one critical bug (new cards never entering the review queue) and adds three features (teacher-style error analysis, library history, evaluation trends). All four features are achievable with the current stack -- zero new dependencies. The data layer (Supabase tables for `card_reviews`, `error_patterns`, `error_snapshots`, `session_reports`) already contains everything needed; the gaps are in application logic, query filters, and UI rendering.

The recommended approach is a 4-phase build driven by a clear dependency chain: fix the review algorithm first (it is completely broken for new cards), then build evaluation trends (read-only aggregation, no risk), library history (new UI over existing data), and finally the AI-powered teacher report (most complex, benefits from having trends data available). Every phase uses the service-first pattern -- add data logic to services, then consume from UI. Visualizations use CSS bar charts and sparklines already proven in `ErrorDashboard.tsx`, not chart libraries.

The primary risks are: (1) fixing the review algorithm without backfilling existing cards leaves current users stuck, (2) generating AI teacher reports eagerly on session end would add 2-5 second delays and scale costs linearly, and (3) showing trends from too few data points produces misleading "improving/worsening" signals. All three have straightforward mitigations documented below.

## Key Findings

### Recommended Stack

No production dependencies need to be installed. All four features are code-only changes to existing modules. Chart libraries (recharts, chart.js, d3) were evaluated and rejected -- the existing CSS bar chart pattern in `ErrorDashboard.tsx` handles the data volumes involved (5-50 data points per card, 100 snapshots max). Date libraries (date-fns, dayjs) are unnecessary since the codebase already uses native `Date` with `toLocaleDateString('pt-BR')`.

**Core technologies leveraged:**
- **React 19 + Vite 6**: Existing SPA framework -- no changes to build pipeline
- **Supabase (BaaS)**: All data already in `card_reviews`, `error_patterns`, `error_snapshots`, `session_reports` tables with proper indexes
- **Tailwind CSS 4 + design tokens**: Use `--mode-*`, `--brand-*` variables and existing UI primitives (`Badge`, `ScoreDisplay`, `Button`)
- **motion 12.33**: Timeline animations, sparkline reveals, section transitions -- already installed and used throughout
- **chatCompletion() via Supabase Edge Function proxy**: AI narrative generation for teacher reports -- existing routing handles provider selection and fallback

### Expected Features

**Must have (table stakes):**
- Fix review algorithm -- new cards must appear in review queue immediately (currently broken: `createDefaultCard()` never sets `nextReviewAt`, query excludes NULL)
- Aggregate progress report with narrative -- users need "you are improving at X, struggling with Y" not just per-error lists
- Per-card score timeline in library -- users with 5+ reviews want to see improvement on a specific card
- Per-category trend direction -- "grammar improving 20% this month" is the fundamental question learners ask

**Should have (differentiators):**
- AI-generated teacher narrative via `chatCompletion()` -- natural, encouraging progress report instead of templated text
- Weak-area auto-practice suggestions -- "Your verb tenses are slipping, review these 5 cards now"
- Skill-level streaks and milestone markers -- gamification at the category level

**Defer (v2+):**
- Historical audio playback per review (blocked by schema constraint -- only latest recording stored)
- PDF export of progress reports
- Predictive "time to mastery" estimates (needs careful framing)
- Social sharing and comparative analytics

### Architecture Approach

The architecture follows a service-first pattern: add data functions to existing service modules (`errorAnalysis.ts`, `supabase/storage.ts`), add types to existing type files (`types/errors.ts`, `types/review.ts`), then consume from UI. No new routes, no new pages, no new tables. One new component (`LessonHistoryCard.tsx`) and multiple modifications to existing components.

**Major components:**
1. **Storage query layer** (`supabase/storage.ts`) -- Fix `getCardsDueForReview()` to include null `next_review_at` cards; add review history query
2. **Error analysis service** (`errorAnalysis.ts`) -- Add `generateTeacherReport()` and `getSkillTrends()` functions using existing snapshot data
3. **Error dashboard** (`ErrorDashboard.tsx`) -- Restructure with teacher report as hero section, skill trends section, per-pattern cards as supporting detail
4. **Library page** (`LibraryPage.tsx`) -- Add session history section using existing `getSessionReports()` with new `LessonHistoryCard` component

### Critical Pitfalls

1. **New cards invisible to review queue** -- `createDefaultCard()` omits `nextReviewAt`; query filters `next_review_at <= NOW()` which excludes NULL. Fix by modifying the query to `.or('next_review_at.lte.${now},next_review_at.is.null')` AND setting `nextReviewAt = now` in card creation. Must also handle existing cards already in the DB with null values.

2. **Review dedup drops legitimate reviews** -- Dedup key is `date:score`; same-day same-score reviews are silently discarded. Change key to include timestamp with milliseconds or UUID per review entry.

3. **AI teacher report generated eagerly on session end** -- Would add 2-5 second delay per session. Generate lazily on page visit instead, cache for 24 hours.

4. **Trends from 3 data points are misleading** -- `calculateTrend()` declares direction with only 3 samples. Require minimum 5 data points and show confidence level.

5. **SM-2 score mapping cliff** -- Scores 0-4 all map to "incorrect" (quality 0-2), score 5+ maps to "correct" (quality 3+). Score 4 (partial knowledge) triggers full reset. Adjust mapping to give partial credit at score 4.

## Implications for Roadmap

Based on combined research, the suggested phase structure:

### Phase 1: Fix Review Algorithm
**Rationale:** The review queue is completely broken for new cards -- this is the highest-severity bug and unblocks data generation for all subsequent features.
**Delivers:** Working review queue for new and existing cards, correct SM-2 score mapping, review dedup fix, review mode persistence.
**Addresses:** Feature 1 (Fix Review Algorithm) -- all table-stakes items.
**Avoids:** Pitfalls #1 (null nextReviewAt), #2 (dedup collision), #7 (score mapping cliff), #8 (no backfill), #13 (mode persistence), #14 (intelligent review loads all cards).
**Files touched:** `spacedRepetition.ts`, `supabase/storage.ts`, `ReviewPage.tsx` -- low risk, query widening.

### Phase 2: Evaluation Improvement Trends
**Rationale:** Pure read-only aggregation from existing `error_snapshots` data. No AI calls, no new data writes. Can be built and tested independently. Provides trend data that enriches the teacher report in Phase 4.
**Delivers:** Per-category trend visualization with delta indicators, trend confidence levels, skill summary card.
**Addresses:** Feature 4 (Evaluation Trends) -- table-stakes items.
**Uses:** Existing `errorAnalysis.ts` functions (`calculateTrend`, `loadSnapshots`, `getProgressSummary`), existing `ErrorDashboard.tsx` CSS bar chart pattern.
**Implements:** New `SkillTrend` type, `getSkillTrends()` service function, skill trends section in ErrorDashboard.
**Avoids:** Pitfall #6 (too few data points) via minimum sample enforcement; Pitfall #11 (category false positives) via confidence filtering.

### Phase 3: Library History
**Rationale:** New UI consuming existing `session_reports` data via existing `getSessionReports()` API. Independent of error analysis features. Requires lazy loading to avoid performance issues.
**Delivers:** Session history timeline in library with per-lesson scores, duration, type badges, and expandable details.
**Addresses:** Feature 3 (Library History) -- table-stakes items (score timeline, review stats, next review countdown).
**Uses:** Existing `SessionReport` type, `getSessionReports()` from storage facade, `LessonHistoryCard` new component.
**Avoids:** Pitfall #5 (loading all cards/reviews into memory) via lazy loading; Pitfall #10 (audio memory leaks) via shared audio player with cleanup.

### Phase 4: Global Error Analysis (Teacher Reports)
**Rationale:** Most complex feature -- requires AI prompt engineering, JSON schema parsing, and ErrorDashboard restructure. Benefits from having trend data (Phase 2) available. Touching ErrorDashboard once (after Phase 2 adds its section) avoids merge conflicts.
**Delivers:** AI-generated teacher-style progress report as ErrorDashboard hero section, per-category recommendations, consolidated pattern view.
**Addresses:** Feature 2 (Global Error Analysis) -- all table-stakes and differentiator items.
**Uses:** `chatCompletion()` via Supabase Edge Function proxy, new `getTeacherReportPrompt()` in prompts.ts, trend data from Phase 2.
**Implements:** `TeacherReport` type, `generateTeacherReport()` service function, ErrorDashboard restructure.
**Avoids:** Pitfall #3 (fragmented patterns) via category-level aggregation; Pitfall #4 (eager AI calls) via lazy generation; Pitfall #9 (contradictory report vs dashboard) via shared data queries.

### Phase Ordering Rationale

- Phase 1 must come first because the review queue produces the data all other features consume. Without fixed reviews, library history has no data and trends are unreliable.
- Phase 2 (trends) and Phase 3 (library history) have no dependencies on each other and could run in parallel. Phase 2 is placed second because it is simpler (read-only aggregation) and its output enriches Phase 4.
- Phase 4 is last because it synthesizes data from all previous phases and has the highest risk (AI prompt engineering, JSON parsing, latency management). It also touches `ErrorDashboard.tsx`, which Phase 2 also modifies -- sequencing avoids conflicts.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** AI prompt engineering for teacher-style reports needs iterative testing. The prompt structure and JSON schema for structured output require validation against actual error data volumes. Also needs caching strategy research (localStorage vs Supabase, staleness window).
- **Phase 1:** The SM-2 score mapping adjustment needs verification against existing card data to ensure no regression for cards already on correct schedules.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Well-understood query fix with clear codebase evidence. SM-2 algorithm is correct; only initialization is broken.
- **Phase 2:** Pure aggregation from existing data. Follows the service-first pattern established in the codebase.
- **Phase 3:** Standard React component consuming existing API. Lazy loading pattern is well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All data already in Supabase tables with indexes. Verified by direct codebase analysis of every relevant source file. |
| Features | HIGH | Root cause of review bug confirmed in code. All other features have clear data sources and implementation paths. No unknowns. |
| Architecture | HIGH | Service-first pattern is established in codebase. All integration points verified. Dependency graph is straightforward. |
| Pitfalls | HIGH | 15 pitfalls identified from code analysis. All have concrete prevention strategies and recovery steps. Phase-specific warnings are actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **Teacher report prompt quality:** The AI prompt for generating teacher-style reports has not been tested against actual error data. Validation during Phase 4 implementation is essential -- generate a few sample reports early to tune the prompt.
- **SM-2 score mapping regression:** Changing the 0-10 to 0-5 mapping could affect existing cards on correct schedules. Add logging during Phase 1 to track score-to-quality distribution and verify no regression for cards already being reviewed successfully.
- **Error pattern consolidation:** The fragmented pattern IDs (Pitfall #3) need a concrete clustering strategy. The recommendation is category-level aggregation for the teacher report, but individual pattern deduplication is deferred. Decide during Phase 4 whether pattern consolidation is needed or category-level aggregation is sufficient.
- **Performance baseline:** No existing performance measurements for Library page load or ErrorDashboard render time. Establish baselines before Phase 3/4 to verify lazy loading and on-demand report generation meet the <2s target.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of: `src/services/spacedRepetition.ts`, `src/services/supabase/storage.ts`, `src/services/errorAnalysis.ts`, `src/utils/prompts.ts`, `src/types/card.ts`, `src/types/errors.ts`, `src/types/review.ts`, `src/types/gamification.ts`, `src/components/review/ReviewPage.tsx`, `src/components/errors/ErrorDashboard.tsx`, `src/components/library/LibraryPage.tsx`, `src/components/library/CardDetail.tsx`
- Database schema: `supabase/migrations/20260324221155_initial_schema.sql` -- verified table structures and indexes

### Secondary (MEDIUM confidence)
- SM-2 algorithm specification: Piotr Wozniak, SuperMemo (original paper) -- confirms algorithm implementation is correct
- Anki open-source codebase: common SM-2 implementation bugs -- informed pitfall identification

### Tertiary (LOW confidence)
- AI prompt engineering for educational feedback: inferred from existing prompt patterns in `src/utils/prompts.ts`, not yet validated against actual error data

---
*Research completed: 2026-04-18*
*Ready for roadmap: yes*
