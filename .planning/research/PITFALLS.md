# Domain Pitfalls

**Domain:** Adding review algorithm fix, global error analysis, library history, and evaluation trends to an existing English learning React SPA
**Researched:** 2026-04-18
**Confidence:** HIGH (grounded in direct codebase analysis of relevant modules; SM-2 algorithm pitfalls well-established in literature)

## Critical Pitfalls

### Pitfall 1: New Cards Never Become Due Because `nextReviewAt` Is Never Initialized

**What goes wrong:**
Cards created via `createDefaultCard()` in `spacedRepetition.ts` (line 49) set `interval: 0` and `repetitions: 0` but do NOT set `nextReviewAt`. The card is stored in Supabase with `next_review_at: null`. The due-card query in `supabase/storage.ts` (line 260) filters with `.lte('next_review_at', now)`, which excludes `null` values entirely. These cards are permanently invisible to the review queue.

**Why it happens:**
The SM-2 algorithm in `updateCardSchedule()` (spacedRepetition.ts) only computes `nextReviewAt` AFTER a review. The design assumes cards get reviewed once first, then scheduled. But the query requires `nextReviewAt <= now` to surface cards at all -- a chicken-and-egg problem. The LibraryPage "Schedule Review" button (line 74-76) is a manual workaround that sets `nextReviewAt` to `now()`, but most users never discover it.

**Consequences:**
- All newly created cards are invisible to the standard review queue forever
- Users accumulate cards in their library that never appear for review
- The review page shows "Tudo em dia!" (all caught up) even when the user has dozens of unreviewed cards
- Only "intelligent review" mode surfaces these cards (via `getPrioritizedReviewCards` which loads ALL cards), masking the bug

**Prevention:**
1. Set `nextReviewAt` to `new Date().toISOString()` in `createDefaultCard()` so new cards are immediately due
2. Alternatively, modify the `getCardsDueForReview()` Supabase query to also include cards where `next_review_at IS NULL` (using `.is('next_review_at', null)` combined with the existing filter via `.or()`)
3. Do NOT rely on the LibraryPage manual "schedule review" button as the primary path
4. Add a database migration or one-time script to backfill `next_review_at` for existing cards where it is null

**Detection:**
- Query Supabase for cards where `next_review_at IS NULL` -- if any exist, the bug is active
- New user saves cards from exercises, goes to Review page, sees "all caught up" immediately

**Phase to address:** Phase 1 (Review Algorithm Fix). This is the root cause of the entire broken review flow.

---

### Pitfall 2: Review Deduplication Key Collision Silently Drops Reviews

**What goes wrong:**
In `supabase/storage.ts` `updateCard()` (lines 196-209), review deduplication uses a composite key of `date:score`. If a user reviews the same card twice on the same day and gets the same score both times, the second review is silently dropped. The dedup check (`existingKeys.has(`${r.date}:${r.score}`)`) treats these as duplicates even though they represent distinct review events with different transcriptions.

**Why it happens:**
The dedup key was designed to prevent accidental double-writes (e.g., network retry), but it conflates legitimate same-day same-score reviews with duplicates. A user practicing the same card twice in a session with score 7 both times will have only one review persisted.

**Consequences:**
- Review history is incomplete, making trend analysis unreliable
- SM-2 `repetitions` counter increments in memory but the corresponding review record is lost
- `computeReviewStats()` reports fewer reviews than actually occurred
- Evaluation improvement trends (milestone feature #4) will show incorrect data

**Prevention:**
1. Change the dedup key to include `userTranscription` or use a UUID per review entry
2. Better: add an `id` field to `ReviewEntry` type and use that for dedup
3. Short-term fix: use the full ISO timestamp (with milliseconds) instead of just date, making collisions extremely unlikely

**Detection:**
- Review a card twice in one session with the same score; check if both reviews appear in the CardDetail history
- Database query: cards with `card_reviews` count not matching the `repetitions` field value

**Phase to address:** Phase 1 (Review Algorithm Fix). Fix the dedup logic alongside the `nextReviewAt` initialization fix.

---

### Pitfall 3: Error Pattern IDs Are Unstable, Causing Duplicate Patterns

**What goes wrong:**
`createPatternFromCorrection()` in `errorAnalysis.ts` (line 244) generates pattern IDs from `category_${correction.slice(0, 30)}`. This means the same grammatical mistake described with slightly different wording by the AI produces different pattern IDs. For example, "Use 'in' instead of 'on'" and "Use 'in' rather than 'on'" create two separate patterns that should be one. Over time, the error_patterns table accumulates near-duplicate rows that fragment the occurrence count and make trend analysis noisy.

**Why it happens:**
The pattern ID is derived from the raw correction text, which comes from AI-generated evaluations. LLM responses are non-deterministic -- the same underlying error will be described differently across sessions. The system treats each wording variation as a distinct pattern.

**Consequences:**
- Error dashboard shows many near-identical patterns instead of one consolidated pattern
- Occurrence counts are diluted across duplicates, hiding truly critical patterns
- "Critical errors" (occurrences >= 3, trend = 'worsening') may not trigger because no single pattern reaches the threshold
- Global error analysis reports (milestone feature #2) will be fragmented and confusing

**Prevention:**
1. For the global error analysis feature: consolidate patterns at query time by clustering similar corrections (same category + overlapping keywords)
2. Consider generating pattern IDs from a normalized form (lowercased, punctuation stripped, stop words removed) rather than raw correction text
3. When recording patterns, fuzzy-match against existing patterns in the same category before creating a new one
4. For the teacher-style report: generate it from aggregated category stats rather than individual pattern records to avoid the fragmentation problem entirely

**Detection:**
- Query error_patterns for patterns in the same category with >50% text similarity
- User sees multiple near-identical entries in the error dashboard

**Phase to address:** Phase 2 (Global Error Analysis). Address as part of building the consolidated report generation.

---

### Pitfall 4: Global Error Analysis Becomes an Expensive AI Call on Every Session End

**What goes wrong:**
Building a "teacher-style progress report" is likely to be implemented as an AI chat completion call that takes all the user's error data and generates a narrative report. If this call happens on every session end (like `recordSessionSnapshot()` currently does in ReviewPage line 143), it adds a slow, expensive AI API call to the session completion flow. The user sees a loading spinner after every practice session while the report generates, even if they will not view it immediately.

**Why it happens:**
The existing `recordSessionSnapshot()` already runs on session completion. Adding report generation alongside it feels natural. But `recordSessionSnapshot()` is a cheap database write, while an AI-powered report is a multi-second API call that costs tokens.

**Consequences:**
- Session completion feels slow (2-5 second delay added)
- API costs scale linearly with sessions
- If the AI call fails, it could block or crash the session completion flow
- Reports generated immediately after a session may be too granular and not useful -- teacher reports are more valuable as weekly summaries

**Prevention:**
1. Generate teacher-style reports LAZILY -- only when the user navigates to the report page, not on session completion
2. Cache generated reports with a staleness window (e.g., regenerate if older than 24 hours)
3. Keep `recordSessionSnapshot()` as the eager data-collection step (cheap write)
4. The report generation is a separate async action triggered by page visit, not by session end
5. If real-time updates are desired, generate a lightweight summary from local data (no AI call) and only call AI for the full report on demand

**Detection:**
- Session completion takes >2 seconds after adding report generation
- AI API usage spikes proportional to session count
- Users report "it feels slow after I finish reviewing"

**Phase to address:** Phase 2 (Global Error Analysis). Design the report generation as on-demand, not eager.

---

### Pitfall 5: Library History Feature Loads All Cards and All Reviews Into Memory

**What goes wrong:**
The current `getCards()` in the storage facade loads ALL user cards with ALL their reviews in a single query. Adding per-lesson history (recordings, scores, progress over time) means displaying historical data for each card. If a user has 200 cards with 10 reviews each, that is 2,000 review entries loaded at once. The LibraryPage does not paginate -- it renders all cards in a flat list. Adding history detail for each card amplifies the data volume and render cost.

**Why it happens:**
The existing `getCards()` query in `supabase/storage.ts` (lines 77-97) eagerly joins `card_reviews(*)` and `card_evaluations(*)` for every card. This was acceptable when the library only showed the latest score and review count. But a history feature that displays timelines, audio playback, and score progression per card multiplies the amount of data the user expects to see per card.

**Consequences:**
- Library page takes 3-5 seconds to load for users with many cards
- Large JSON responses from Supabase (potentially MB-scale with audio blobs)
- Audio blobs (`userAudioBlob` base64 strings) are especially expensive -- each can be 100KB+
- Browser memory pressure from holding all card data in React state

**Prevention:**
1. Do NOT load `userAudioBlob` in the card list query -- only load it when the user opens a specific card's detail/history
2. Paginate the library card list (load 20 at a time with "load more")
3. For the history timeline, load reviews lazily per card rather than eagerly for all cards
4. Consider a lightweight `getCardSummaries()` query that returns card metadata + stats without the full review/evaluation payloads
5. Audio blobs should use a separate storage mechanism (Supabase Storage buckets) instead of base64 in the database, but this is out of scope for this milestone -- the immediate fix is lazy loading

**Detection:**
- Library page load time exceeds 2 seconds for users with 50+ cards
- Browser DevTools Memory tab shows large retained heap from Card objects
- Network tab shows response sizes >1MB from the cards query

**Phase to address:** Phase 3 (Library History). Build with lazy loading from the start; do not add history to the eager `getCards()` query.

---

### Pitfall 6: Evaluation Trends Computed From Too Few Data Points Produce Misleading Results

**What goes wrong:**
The existing trend calculation in `errorAnalysis.ts` `calculateTrend()` (lines 144-158) requires only 3 data points to declare a trend. For the new evaluation improvement trends feature, showing a user "You're improving in verb tenses!" based on 3 exercises can be wildly inaccurate. A single good session after a bad one reads as "improving," and vice versa. Users make decisions about what to practice based on these signals.

**Why it happens:**
Statistical significance is not considered. The `calculateTrend` function compares averages of recent vs. older scores with a 0.5-point threshold. With small samples, random variance easily exceeds 0.5 points on a 0-10 scale. The function also treats all time periods equally -- 3 reviews over 2 months vs. 3 reviews in one day get the same treatment.

**Consequences:**
- Users see wild trend swings early in their learning journey ("improving" one day, "worsening" the next)
- The trends feature loses credibility quickly
- Users may over-practice a "worsening" area that is actually stable, neglecting other skills
- Teacher-style reports may contain misleading claims about progress direction

**Prevention:**
1. Require a minimum of 5 data points before showing any trend (show "Insufficient data" otherwise)
2. Use confidence intervals or rolling averages instead of raw recent-vs-older comparison
3. Add a "confidence" level to trends: "Likely improving (5 samples)", "Possibly worsening (3 samples, more data needed)"
4. Weight recent data more heavily than older data using exponential moving average
5. Do not show trends at all for the first week of usage; show raw scores only

**Detection:**
- User completes 2-3 exercises and immediately sees trend indicators
- Trend direction flips between sessions with small sample sizes
- A user with 3 reviews sees the same trend confidence as a user with 30 reviews

**Phase to address:** Phase 4 (Evaluation Trends). Build statistical safeguards into the trend calculation from the start.

---

### Pitfall 7: SM-2 Score Mapping From 0-10 to 0-5 Loses Precision at the Threshold

**What goes wrong:**
`updateCardSchedule()` in `spacedRepetition.ts` (line 9) maps the 0-10 evaluation score to a 0-5 SM-2 quality via `Math.round((score / 10) * 5)`. This means scores of 5 and 6 both map to quality 3 (the "correct" threshold). A score of 5 (mediocre) gets the same SM-2 treatment as a score of 6 (decent). Conversely, scores 0-4 all map to quality 0-2 ("incorrect"), causing the algorithm to reset repetitions and interval even for a score of 4 (which is arguably partial knowledge).

**Why it happens:**
SM-2 was designed for self-assessment on a 0-5 scale. The app uses AI-evaluated scores on a 0-10 scale. The linear mapping creates uneven bins: quality 0 = scores 0-1, quality 1 = scores 2-3, quality 2 = scores 4, quality 3 = scores 5-6, quality 4 = scores 7-8, quality 5 = scores 9-10.

**Consequences:**
- A user scoring 4/10 (partial knowledge) is treated the same as scoring 0/10 (complete failure) -- both reset the card
- The transition from "reset" to "advance" happens abruptly at score 5, creating a cliff effect
- Cards that users partially know get excessively harsh scheduling, making review sessions feel punitive

**Prevention:**
1. Adjust the mapping so scores >= 4 map to quality >= 3 (partial credit advances the schedule): `const quality = Math.min(5, Math.max(0, Math.round(((score - 2) / 8) * 5)))`
2. Or keep the current mapping but adjust the quality >= 3 threshold in `updateCardSchedule` to quality >= 2, so scores of 4+ advance
3. Add logging to track the score-to-quality distribution to verify the mapping feels right
4. When fixing this, re-evaluate existing cards that may have been incorrectly reset

**Detection:**
- User scores 4/10 and the card interval resets to 1 day despite having been on a 6-day interval
- Most reviews result in either full advancement or full reset, with no middle ground
- Cards with many reviews but `repetitions` stays at 0 or 1 (constantly being reset)

**Phase to address:** Phase 1 (Review Algorithm Fix). Fix the mapping alongside the `nextReviewAt` initialization.

---

### Pitfall 8: Fixing the Review Algorithm Without Backfilling Existing Cards

**What goes wrong:**
After fixing `createDefaultCard()` to set `nextReviewAt`, all NEW cards will work correctly. But every existing card in the database that was created with `nextReviewAt: null` remains broken. The fix only helps future cards, leaving the existing user base with a library full of invisible review cards. Users who have been using the app for weeks/months will not see any improvement until they manually schedule each old card.

**Why it happens:**
The fix is applied to the card creation code path. Existing persisted data is not touched. Since the app constraint says "no Supabase migration or backend schema changes," there is no database migration to fix existing rows.

**Consequences:**
- Bug appears "fixed" for new users but persists for existing users
- QA tests with fresh accounts pass; production users continue to experience the bug
- Support burden as users report "review still not working" after the fix ships

**Prevention:**
1. Add a one-time client-side backfill: on app load or first library visit, detect cards where `nextReviewAt` is null and set it to `createdAt` (making them immediately due)
2. Add this to the existing `getCards()` or `getCardsDueForReview()` flow as a post-processing step
3. Track whether the backfill has run (e.g., `localStorage` flag or Supabase user metadata) to avoid re-running on every load
4. Alternative: modify the Supabase query to `.or('next_review_at.lte.${now},next_review_at.is.null')` so null cards are always included as due -- this is the simplest fix that handles both new and existing data

**Detection:**
- After deploying the fix, check if the user's existing cards appear in the review queue
- Query production: `SELECT COUNT(*) FROM cards WHERE next_review_at IS NULL` -- should be 0 after backfill

**Phase to address:** Phase 1 (Review Algorithm Fix). The backfill or query fix MUST be part of the same phase as the creation fix.

---

## Moderate Pitfalls

### Pitfall 9: Teacher-Style Report Shows Different Information Than the Error Dashboard

**What goes wrong:**
The global error analysis report and the existing ErrorDashboard component both draw from `errorAnalysis.ts` but present data differently. If the teacher report generates narrative text via AI while the dashboard shows raw stats, users may see contradictory information ("Your report says grammar is improving, but the dashboard shows grammar as your #1 weakness"). This erodes trust in both features.

**Prevention:**
Use the same underlying data queries for both views. The teacher report should explicitly reference the same stats shown in the dashboard. If using AI to generate the report narrative, pass the raw stats as structured context and instruct the AI to be consistent with them.

**Phase to address:** Phase 2 (Global Error Analysis).

---

### Pitfall 10: Library History Audio Playback Creates Memory Leaks

**What goes wrong:**
The CardDetail component already handles audio playback with `audioRef` and cleanup in `useEffect`. But if the library history feature adds multiple playable recordings per card (one per review session), and the component creates audio elements for each without proper cleanup, memory leaks accumulate. Each `playAudioUrl()` creates a new `Audio` element; if these are not properly dereferenced, the browser retains the decoded audio data.

**Prevention:**
1. Use a single shared audio player state rather than creating audio elements per recording
2. Always revoke object URLs created via `base64ToAudioUrl` after playback ends
3. Test with a card that has 10+ reviews with recordings; check memory before and after playing each

**Phase to address:** Phase 3 (Library History).

---

### Pitfall 11: `guessCategory()` False Positives Skew Trend Analysis

**What goes wrong:**
The `guessCategory()` function in `errorAnalysis.ts` (lines 196-234) uses keyword matching to classify errors. Words like "tense", "past", "present" trigger "verb-tense" classification even when the correction is about something else entirely (e.g., "Don't use past tense in this context -- it should be present" might classify as verb-tense when the real issue is about narrative consistency). These misclassifications pollute category-level trend analysis, making the new trends feature unreliable.

**Prevention:**
1. For the trends feature, surface category-level trends ONLY when there are enough patterns in that category to be statistically meaningful
2. Allow the AI evaluation prompt to explicitly categorize corrections rather than relying on keyword matching
3. Add a confidence score to category guesses and filter low-confidence classifications from trend calculations

**Phase to address:** Phase 2 (Global Error Analysis) -- improve the categorization as part of building the report. Phase 4 (Trends) -- add confidence filtering for trend calculations.

---

### Pitfall 12: New History/Trend UI Components Do Not Follow Existing Design Tokens

**What goes wrong:**
New components for library history timelines, trend charts, and teacher report cards are built with hardcoded colors or new CSS classes instead of using the existing design token system (`--mode-*`, `--brand-*`, semantic color variables in `src/index.css`). The new UI looks subtly different from the rest of the app -- inconsistent border radii, shadow styles, spacing patterns.

**Why it happens:**
Developers building new features often reach for quick styling without checking the existing token system. The CLAUDE.md explicitly warns against hardcoding colors.

**Prevention:**
1. Use existing design tokens (`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`, `bg-primary-soft`)
2. Use existing UI components (`Badge`, `ScoreDisplay`, `Button`, `Card`) as building blocks
3. Match the existing card layout pattern (`bg-card rounded-2xl p-6 border border-border`)
4. For trend indicators, use the same icon pattern as ErrorDashboard (`TrendingUp`, `TrendingDown`, `Minus` from lucide-react)

**Phase to address:** All phases. Enforce during code review.

---

## Minor Pitfalls

### Pitfall 13: Review Mode Toggle Does Not Persist Across Sessions

**What goes wrong:**
ReviewPage stores `reviewMode` ('standard' | 'intelligent') in component state. When the user leaves and returns, it resets to 'standard'. If the user primarily uses intelligent review, they must toggle it every time.

**Prevention:** Persist the mode choice to `localStorage` or Supabase user metadata.

**Phase to address:** Phase 1 (Review Algorithm Fix) -- small quality-of-life improvement alongside the main fix.

---

### Pitfall 14: `getPrioritizedReviewCards` Loads All Cards Even When Few Are Due

**What goes wrong:**
The "intelligent review" mode calls `getPrioritizedReviewCards()` which calls `getCards()` -- loading ALL user cards into memory just to sort and take the top 20. For users with hundreds of cards, this is wasteful when only 5 cards are actually due.

**Prevention:** Add a pre-filter to the query (e.g., only load cards with `next_review_at` in the past week or with low recent scores) before doing the priority sort in-memory.

**Phase to address:** Phase 1 (Review Algorithm Fix). Optimize alongside the main query fix.

---

### Pitfall 15: Session Snapshot Timestamp Granularity Causes Duplicate Snapshots

**What goes wrong:**
`recordSessionSnapshot()` creates a snapshot with `date: new Date().toISOString()`. If the user completes two short sessions within the same minute, two nearly-identical snapshots are created. The snapshot pruning logic (lines 478-486) keeps the last 100, so this is not catastrophic, but it inflates snapshot counts and makes timeline comparisons noisier.

**Prevention:** Round snapshot dates to the day level, or check for an existing snapshot within the last hour before creating a new one.

**Phase to address:** Phase 2 (Global Error Analysis).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Review algorithm fix | Fixing creation but not backfilling existing cards (#8) | Modify query to include null `next_review_at` OR add client-side backfill |
| Review algorithm fix | Score mapping cliff at threshold 5 (#7) | Adjust mapping to give partial credit at score 4 |
| Review algorithm fix | Review dedup drops same-day same-score reviews (#2) | Change dedup key to include timestamp or UUID |
| Global error analysis | AI report call on every session end (#4) | Generate report lazily on page visit, not eagerly on session end |
| Global error analysis | Fragmented patterns from unstable IDs (#3) | Cluster patterns at query time or normalize pattern IDs |
| Global error analysis | Contradictory info between report and dashboard (#9) | Share underlying data queries between both views |
| Library history | Loading all cards + reviews + audio blobs at once (#5) | Paginate cards, lazy-load history per card, skip audio blobs in list query |
| Library history | Audio memory leaks from multiple recordings (#10) | Use a shared audio player with proper cleanup |
| Evaluation trends | Trend from 3 data points is misleading (#6) | Require minimum 5 samples, show confidence level, use rolling averages |
| Evaluation trends | `guessCategory()` false positives pollute trends (#11) | Add confidence filtering; require multiple patterns per category for trends |
| Cross-cutting | New components use hardcoded colors (#12) | Enforce design token usage in code review; use existing UI primitives |

## Technical Debt Relevant to This Milestone

| Existing Debt | Impact on This Milestone | Workaround |
|---------------|--------------------------|------------|
| Sequential N+1 writes in `saveCards` | Bulk card operations (backfill, history queries) will be slow | Avoid `saveCards` for bulk ops; batch update cards individually with parallel promises |
| Gemini Live needs client-side API key | Review of Live roleplay sessions in library history may expose key in audio URLs | Ensure library history does not store or display Live session API details |
| `runtimeState` window events on every change | Adding trend/reactivity features that listen to state changes will amplify re-renders | Use targeted subscriptions, not global window event listeners |
| No React Error Boundary for feature components | New features (history, trends, report) can crash and take down the whole page | Wrap each new feature section in an error boundary |

## Integration Gotchas

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|-------------------|
| `updateCardSchedule` + Supabase persist | Computing schedule in memory but not awaiting the `updateCard()` call | Ensure `await updateCard(updatedCard)` in ReviewPage line 96 actually completes before session ends |
| Error analysis + Library history | Tightly coupling error patterns to card IDs that may change | Use stable card IDs; do not cascade delete error patterns when cards are deleted |
| Trend calculation + session snapshots | Computing trends from snapshots that were recorded with different schema versions | Version the snapshot data format; ignore snapshots from before the format change |
| Audio playback in history list | Creating blob URLs without revoking them | Revoke `URL.createObjectURL` URLs when component unmounts or audio changes |
| Teacher report + existing ErrorDashboard | Two features computing "trend" differently | Use the single `calculateTrend()` function for both, or explicitly document the difference |

## "Looks Done But Isn't" Checklist

- [ ] **Review fix:** Cards created after fix appear in review, but do cards created BEFORE fix also appear? Verify backfill/query fix works for existing data.
- [ ] **Review fix:** Score 4/10 is treated as "partial knowledge" not "complete failure"? Verify the mapping change produces correct intervals for edge scores.
- [ ] **Review dedup:** Reviewing same card twice in one day with same score persists both reviews? Verify dedup key includes more than date+score.
- [ ] **Error report:** Report narrative is consistent with dashboard stats? Verify both use the same underlying data.
- [ ] **Error report:** Report generation does not block session completion? Verify the AI call is lazy, not eager.
- [ ] **Library history:** Page loads in <2 seconds for users with 100+ cards? Verify lazy loading and pagination.
- [ ] **Library history:** Audio recordings play without memory leaks after navigating away? Verify blob URL cleanup.
- [ ] **Trends:** No trend shown for categories with fewer than 5 data points? Verify minimum sample enforcement.
- [ ] **Trends:** Trend direction does not flip between page visits with the same data? Verify deterministic calculation.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cards never due (null nextReviewAt) | LOW | Modify query to include null; no data migration needed |
| Review dedup key collision | MEDIUM | Add timestamp to dedup key; no data loss for future reviews, old duplicates unrecoverable |
| Error pattern fragmentation | MEDIUM | Write one-time consolidation script to merge near-duplicate patterns; runs client-side on page load |
| Eager AI report generation | LOW | Move to lazy generation; delete any stored eager reports |
| Library loading all data | LOW | Add pagination and lazy loading; no data changes needed |
| Misleading trends from few points | LOW | Add minimum sample threshold; existing trend data remains but display is suppressed |
| Score mapping cliff | MEDIUM | Change mapping; existing card intervals may need re-evaluation over time |
| No backfill for existing cards | LOW | Modify query OR add client-side backfill; no schema change needed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cards never due (null nextReviewAt) | Phase 1 (Review Fix) | Create card, immediately check review queue -- card appears |
| Review dedup collision | Phase 1 (Review Fix) | Review same card twice same day same score -- both persisted |
| Score mapping cliff | Phase 1 (Review Fix) | Score 4/10 produces advancing schedule, not full reset |
| No backfill for existing cards | Phase 1 (Review Fix) | Existing cards with null nextReviewAt appear in review queue after fix |
| Fragmented error patterns | Phase 2 (Error Analysis) | Report shows consolidated patterns, not near-duplicates |
| Eager AI report generation | Phase 2 (Error Analysis) | Session completion time unchanged after adding report feature |
| Report contradicts dashboard | Phase 2 (Error Analysis) | Report narrative matches dashboard numbers |
| Snapshot timestamp noise | Phase 2 (Error Analysis) | No duplicate snapshots within same hour |
| Library loads all data | Phase 3 (Library History) | Library page loads in <2s with 100+ cards |
| Audio memory leaks | Phase 3 (Library History) | Memory stable after playing 10 recordings sequentially |
| Trends from too few points | Phase 4 (Trends) | No trend indicator shown until 5+ data points exist |
| Category false positives | Phase 4 (Trends) | Low-confidence category guesses excluded from trend display |
| Design token inconsistency | All phases | Code review checklist; no hardcoded colors in new components |
| Review mode not persisted | Phase 1 (Review Fix) | Intelligent mode persists across page navigation |
| Intelligent review loads all cards | Phase 1 (Review Fix) | Query pre-filters before in-memory sort |

## Phase Ordering Rationale

The pitfalls reveal a clear dependency chain:

1. **Phase 1 (Review Algorithm Fix)** must come first because:
   - The review queue is completely broken for new cards -- this is the highest-severity bug
   - The fix (initializing `nextReviewAt`) affects the data model that all other features build on
   - Library history and evaluation trends both depend on having correct review data
   - Score mapping fix changes the data that trends will analyze -- trends should see correct data from the start

2. **Phase 2 (Global Error Analysis)** comes second because:
   - It builds on the corrected review data from Phase 1
   - The teacher report should analyze accurate review/score data
   - Error pattern consolidation (Pitfall #3) makes the trend feature in Phase 4 more reliable

3. **Phase 3 (Library History)** comes third because:
   - It depends on accurate review data (Phase 1) and error analysis (Phase 2) being available to display
   - It requires new data loading patterns (lazy loading) that should not be built until the data model is stable

4. **Phase 4 (Evaluation Trends)** comes last because:
   - It synthesizes data from all previous phases (review scores, error patterns, session history)
   - Statistical safeguards (minimum sample sizes) need to reference the data volume created by Phases 1-3
   - It is the most sensitive to data quality issues, so it should see the most corrected data

## Sources

- Codebase analysis: `src/services/spacedRepetition.ts`, `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/errorAnalysis.ts`, `src/types/card.ts`, `src/types/review.ts`, `src/types/errors.ts`, `src/components/review/ReviewPage.tsx`, `src/components/library/LibraryPage.tsx`, `src/components/library/CardDetail.tsx`
- SM-2 algorithm specification: Piotr Wozniak, SuperMemo (original SM-2 paper)
- SM-2 common implementation bugs: Anki open-source codebase, community forums
- Project context: `.planning/PROJECT.md` v1.4 milestone definition

---
*Pitfalls research for: SpeakLab v1.4 Review, Analysis & Library*
*Researched: 2026-04-18*
