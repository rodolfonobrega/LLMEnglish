# Phase 14: Student Data Flow - Research

**Researched:** 2026-04-09
**Domain:** Data flow integrity across error tracking, card lifecycle, and learning trail systems
**Confidence:** HIGH

## Summary

Phase 14 covers the three interconnected student-facing data systems: **error analysis** (how mistakes are captured, categorized, and tracked over time), **cards** (exercise artifacts persisted with SM-2 spaced repetition scheduling), and **learning trails** (guided roleplay paths with step-by-step progress). The codebase has a clean three-layer architecture -- components consume a storage facade (`src/services/storage.ts`), which delegates to Supabase storage (`src/services/supabase/storage.ts`), which queries the remote database. Error analysis operates as an independent module that feeds off evaluation results.

The data flows correctly at a high level but has several gaps and inconsistencies that this phase should address: (1) ExerciseMode records errors against `temp_${Date.now()}` card IDs that never exist in the database, creating orphaned error patterns; (2) the live-roleplay ConversationAnalysis records session snapshots but does NOT extract individual error patterns from the conversation; (3) the `getCardsForWeakArea` function ignores the `weakArea` parameter entirely; (4) trail progress is tracked but never connected to gamification (no XP for completing trail steps); (5) reviews in ReviewPage are pushed to the card's local reviews array but never persisted to the `card_reviews` Supabase table.

**Primary recommendation:** Focus on fixing the broken data flow connections -- the temp card ID orphaning, missing review persistence, and disconnected trail-to-gamification link -- rather than adding new features. These are the bugs that cause real data loss.

## Standard Stack

### Core (already in project, no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.99 | Database, auth, storage | Already in use for all CRUD [VERIFIED: package.json] |
| `vitest` | 4.0 | Test runner | Already configured in vite.config.ts [VERIFIED: vite.config.ts] |
| React 19 | 19.2 | UI framework | Component layer [VERIFIED: package.json] |

### No new dependencies needed

This phase is purely about fixing data flow within the existing architecture. No new libraries are required.

## Architecture Patterns

### Current Data Flow Architecture

```
ExerciseMode.tsx / ReviewPage.tsx / ConversationAnalysis.tsx
    |                    |                     |
    v                    v                     v
storage.ts (facade) ----+---------------------+
    |                    |                     |
    v                    v                     v
supabase/storage.ts    errorAnalysis.ts    gamification.ts
    |                    |                     |
    v                    v                     v
Supabase DB          error_patterns       gamification table
                   error_snapshots       session_reports
```

### Three Data Domains

**1. Error Analysis Flow** [VERIFIED: src/services/errorAnalysis.ts]
```
User speaks -> AI evaluates -> EvaluationResult
  -> extractErrorPatterns() creates ErrorPattern[] from corrections
  -> recordErrorPatterns() upserts to error_patterns table
  -> recordSessionSnapshot() creates snapshot in error_snapshots table
  -> ErrorDashboard reads via getErrorStats(), getProgressTimeline(), etc.
```

**2. Card Lifecycle Flow** [VERIFIED: src/services/storage.ts, src/services/spacedRepetition.ts]
```
ExerciseMode generates exercise -> User speaks -> AI evaluates
  -> [OPTIONAL] handleSaveToLibrary() creates Card via addCard()
  -> ReviewPage loads cards via getCardsDueForReview() or getPrioritizedReviewCards()
  -> Each review: updateCardSchedule() (SM-2), updateCard() persists
  -> Reviews pushed to card.reviews[] array locally
```

**3. Learning Trail Flow** [VERIFIED: src/components/paths/PathsPage.tsx]
```
PathsPage loads trails from roleplayTrails.ts (static data)
  -> getPathProgress() loads from path_progress table
  -> User completes step -> LiveSession runs
  -> ConversationAnalysis completes -> handleAnalysisDone()
  -> markStepComplete() writes to path_progress table
  -> No XP awarded for trail step completion (GAP)
```

### Recommended Project Structure (no changes needed)
```
src/
  services/
    errorAnalysis.ts      # Error tracking logic
    spacedRepetition.ts   # SM-2 algorithm
    gamification.ts       # XP, badges, session reports
    storage.ts            # Facade (sync + async)
    supabase/storage.ts   # Supabase CRUD
  types/
    card.ts               # Card, EvaluationResult, ReviewEntry
    errors.ts             # ErrorPattern, ErrorStats, etc.
    scenario.ts           # PathProgress, RoleplayTrail, etc.
    gamification.ts       # GamificationState, SessionReport
    supabase.ts           # DB row types
  components/
    review/ReviewPage.tsx        # Card review UI
    errors/ErrorDashboard.tsx    # Error analytics UI
    paths/PathsPage.tsx          # Trail browsing + stepping
    discovery/ExerciseMode.tsx   # Exercise generation + evaluation
    live-roleplay/ConversationAnalysis.tsx  # Post-roleplay analysis
```

### Anti-Patterns to Avoid

- **Do not** add new Supabase tables or migrations -- this phase is client-side only per CLAUDE.md constraints
- **Do not** change the storage facade API -- components depend on it
- **Do not** introduce a new state management library -- use the existing runtimeState + React Context pattern

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spaced repetition | Custom scheduling | `updateCardSchedule()` in spacedRepetition.ts | SM-2 algorithm already implemented and tested |
| Error categorization | AI-based classification | `guessCategory()` in errorAnalysis.ts | Keyword-based, no AI call needed |
| DB queries | Direct Supabase calls | `supabase/storage.ts` functions | Centralized, handles auth and mapping |
| Card-to-DB mapping | Manual field mapping | `supabaseCardToLocal()` | Already handles null/undefined conversion |

## Common Pitfalls

### Pitfall 1: Temp Card IDs Create Orphaned Error Patterns
**What goes wrong:** `ExerciseMode.tsx` line 182 uses `temp_${Date.now()}` as the cardId when recording error patterns. This ID never matches any real card in the DB. When `getCardsForWeakArea()` later tries to find cards related to error patterns, the examples reference non-existent cards.
**Why it happens:** ExerciseMode generates the exercise and evaluates immediately, before the user decides to save the card. The error recording happens during evaluation, but the card only gets an ID if the user clicks "Save to Library."
**How to avoid:** Either (a) defer error recording until after the card is saved, or (b) use a deterministic ID that can be resolved later, or (c) record errors without a cardId dependency and link them later.
**Warning signs:** Error pattern examples with cardId starting with "temp_" in the error_patterns table.

### Pitfall 2: Reviews Not Persisted to card_reviews Table
**What goes wrong:** `ReviewPage.tsx` line 82-87 pushes a new review to `card.reviews[]` and calls `updateCard()`. But `updateCard()` in `supabase/storage.ts` only updates the card record itself and the latest evaluation -- it does NOT insert into the `card_reviews` table. Review history is lost after page refresh.
**Why it happens:** The `updateCard()` function handles `card_evaluations` upsert but has no logic for `card_reviews` inserts.
**How to avoid:** Add a `card_reviews` insert in `updateCard()` when the reviews array has new entries.
**Warning signs:** Users report losing review history; `getCards()` returns cards with empty reviews arrays.

### Pitfall 3: getCardsForWeakArea Ignores the Category Parameter
**What goes wrong:** `errorAnalysis.ts` line 335-346 has `void weakArea` -- it returns all low-scoring cards regardless of which error category was requested.
**Why it happens:** The function was likely a placeholder that was never completed.
**How to avoid:** Filter cards by theme/context matching the error category, or at minimum document this as known behavior.
**Warning signs:** ErrorDashboard recommends focusing on a category but shows irrelevant cards.

### Pitfall 4: Trail Steps Not Connected to Gamification
**What goes wrong:** When a user completes a trail step in `PathsPage.tsx`, only `markStepComplete()` is called. No XP is awarded, no session report is created (the session report is created inside ConversationAnalysis, but that records as `live-roleplay` type without trail context).
**Why it happens:** The trail step completion in `handleAnalysisDone()` only calls `markStepComplete()` and refreshes progress.
**How to avoid:** Add XP award for trail step completion, similar to how ExerciseMode awards XP.
**Warning signs:** Users complete trail steps but see no XP change.

### Pitfall 5: guessCategory() Is Overly Broad
**What goes wrong:** The keyword-based category guesser has false positives. For example, any correction containing "in " or "on " or "at " is classified as "preposition" even when the correction is about something else entirely (e.g., "Put it in the box" corrected for word order).
**Why it happens:** Simple substring matching without context awareness.
**How to avoid:** Use more specific patterns or defer to AI for categorization. At minimum, check for "preposition" keyword first before falling back to substring matching.
**Warning signs:** Most corrections categorized as "preposition" in the error dashboard.

## Code Examples

### Data Flow: Exercise Evaluation [VERIFIED: src/components/discovery/ExerciseMode.tsx lines 166-194]
```typescript
const handleAudioReady = async (blob: Blob, base64: string) => {
  // 1. Transcribe audio
  const transcription = await speechToText(blob);
  // 2. Evaluate via AI
  const evalResult: EvaluationResult = JSON.parse(cleanResponse);
  // 3. Record error patterns (BUG: uses temp card ID)
  const tempCardId = `temp_${Date.now()}`;
  const patterns = await extractErrorPatterns(evalResult, prompt, tempCardId);
  await recordErrorPatterns(patterns)
  // 4. Award XP
  let xp = XP_PER_EXERCISE;
  if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
  await addXP(xp)
  // Card only saved later if user clicks "Save to Library"
};
```

### Data Flow: Review Evaluation [VERIFIED: src/components/review/ReviewPage.tsx lines 66-101]
```typescript
const handleAudioReady = async (blob: Blob) => {
  // 1. Transcribe + evaluate
  const evalResult: EvaluationResult = JSON.parse(evalResponse);
  // 2. Update SM-2 schedule
  const updatedCard = updateCardSchedule(currentCard, evalResult.score);
  // 3. Push review to local array (BUG: not persisted to card_reviews table)
  updatedCard.reviews.push({ date: new Date().toISOString(), score, userTranscription });
  // 4. Update card in DB (only saves card fields + evaluation, NOT reviews)
  await updateCard(updatedCard)
  // 5. Record error patterns (correct: uses real card ID)
  const patterns = await extractErrorPatterns(evalResult, currentCard.prompt, currentCard.id);
  await recordErrorPatterns(patterns)
  // 6. Award XP
  await addXP(XP_PER_REVIEW)
};
```

### Data Flow: Trail Step Completion [VERIFIED: src/components/paths/PathsPage.tsx lines 138-144]
```typescript
const handleAnalysisDone = async () => {
  if (activeStep) {
    await markStepComplete(activeStep.trail.id, activeStep.step.id)
    await refreshProgress()
    // GAP: No XP awarded for trail step completion
    // GAP: No session report created for trail context
  }
  handleExit()
};
```

### Storage Facade Pattern [VERIFIED: src/services/storage.ts]
```typescript
// Sync: reads from runtimeState cache
export function getModelConfig(): ModelConfig {
  return getRuntimeModelConfig();
}

// Async: delegates to supabase
export async function getCards(): Promise<Card[]> {
  if (isDevMode()) return [...EMPTY_CARDS];
  return supabaseGetCards();
}

// Setter: updates runtime immediately, persists async
export function setOpenAIKey(key: string): void {
  setRuntimeCredentials({ openai: key });
  if (isDevMode()) { console.warn('...'); return; }
  void supabaseSaveApiKey('openai', key);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for all data | Supabase for auth users, localStorage as fallback | v1.0 (Phase 5) | storage.ts is now a facade |
| Error patterns in localStorage | Supabase error_patterns table | Pre-v1.0 | errorAnalysis.ts queries Supabase directly |
| Flat card storage | Relational: cards + card_reviews + card_evaluations | Pre-v1.0 | Supabase storage handles joins |

**No deprecated patterns found in this domain.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Trail step completion should award XP (currently does not) | Pitfall 4 | If intentional, this is not a bug -- user confirmation needed |
| A2 | Reviews should be persisted to card_reviews table | Pitfall 2 | If intentional (e.g., only latest evaluation matters), then current behavior is correct |
| A3 | getCardsForWeakArea should filter by the requested category | Pitfall 3 | If intentional placeholder, may be deferred |
| A4 | No new Supabase migrations are needed for fixes | Summary | If card_reviews insert requires schema changes, that violates CLAUDE.md constraint |

**These assumptions need user confirmation before planning.** The planner should verify which of these are actual bugs vs. intentional design.

## Open Questions

1. **Should ExerciseMode defer error recording until card is saved?**
   - What we know: Currently errors are recorded with temp IDs before the user saves
   - What's unclear: Whether the intent is to always record errors (even for unsaved exercises) or only when saved
   - Recommendation: Record errors always (valuable data) but use a stable identifier or nullable cardId

2. **Should trail completion award XP and badges?**
   - What we know: ExerciseMode awards XP_PER_EXERCISE, ReviewPage awards XP_PER_REVIEW, live sessions award XP_PER_LIVE_SESSION
   - What's unclear: Trail steps already trigger ConversationAnalysis which awards XP_PER_LIVE_SESSION -- is that sufficient?
   - Recommendation: The live session XP may already cover this, need to verify the flow

3. **Is getCardsForWeakArea meant to be functional or a placeholder?**
   - What we know: Function exists, is exported, is used by errorAnalysis but has `void weakArea`
   - What's unclear: Whether it was planned to be completed or is intentionally broad
   - Recommendation: At minimum, document the limitation; ideally, implement category-aware filtering

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | Yes | 20.x | -- |
| npm | Package management | Yes | present | -- |
| Vitest | Tests | Yes | 4.0 | -- |
| Supabase (remote) | Full data flow testing | N/A | N/A | Dev mode skips auth/DB |

**No missing dependencies.** All work is client-side code using existing tools.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vite.config.ts (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

Since phase requirements are TBD, mapping the identified data flow issues:

| Issue | Behavior | Test Type | Automated Command | File Exists? |
|-------|----------|-----------|-------------------|-------------|
| Temp card IDs | Error patterns with temp IDs should be handled | unit | `npx vitest run src/services/errorAnalysis.test.ts` | No -- Wave 0 |
| Review persistence | Reviews array should persist to card_reviews table | unit | `npx vitest run src/services/supabase/storage.test.ts` | No -- Wave 0 |
| Weak area filtering | getCardsForWeakArea should filter by category | unit | `npx vitest run src/services/errorAnalysis.test.ts` | No -- Wave 0 |
| SM-2 scheduling | updateCardSchedule produces correct intervals | unit | `npx vitest run src/services/spacedRepetition.test.ts` | No -- Wave 0 |
| Trail completion | markStepComplete writes to path_progress | integration | Manual verification | -- |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/errorAnalysis.test.ts` -- covers error pattern extraction, recording, weak areas
- [ ] `src/services/spacedRepetition.test.ts` -- covers SM-2 algorithm correctness
- [ ] `src/services/gamification.test.ts` -- covers XP, badge awarding, session reports
- [ ] `src/services/supabase/storage.test.ts` -- covers card CRUD, review persistence (existing storage.test.ts only tests the facade)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth via AuthContext |
| V3 Session Management | yes | Supabase session management |
| V4 Access Control | yes | Row-Level Security on Supabase tables (user_id filtering) |
| V5 Input Validation | yes | Type system (TypeScript strict mode), JSON.parse in try/catch |
| V6 Cryptography | yes | API key encryption in Supabase (encrypted_api_keys table) |

### Known Threat Patterns for React SPA + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user transcriptions | Tampering | React auto-escapes; corrections displayed as text not HTML |
| Data leakage across users | Information Disclosure | All queries filter by user_id (getUserId() pattern) |
| SQL injection via Supabase client | Tampering | Supabase JS client uses parameterized queries |
| IDOR on card/error access | Elevation | user_id check in all Supabase queries (`.eq('user_id', userId)`) |

## Sources

### Primary (HIGH confidence)
- `src/services/errorAnalysis.ts` -- Complete error tracking module, read in full
- `src/services/storage.ts` -- Storage facade, read in full
- `src/services/supabase/storage.ts` -- Supabase CRUD operations, read key sections
- `src/services/spacedRepetition.ts` -- SM-2 algorithm, read in full
- `src/services/gamification.ts` -- XP/badge logic, read in full
- `src/types/card.ts`, `src/types/errors.ts`, `src/types/scenario.ts`, `src/types/gamification.ts`, `src/types/supabase.ts` -- All type definitions, read in full
- `src/utils/roleplayTrails.ts` -- Static trail data, read in full
- `src/components/review/ReviewPage.tsx` -- Review flow, read in full
- `src/components/discovery/ExerciseMode.tsx` -- Exercise flow, read in full
- `src/components/paths/PathsPage.tsx` -- Trail flow, read in full
- `src/components/live-roleplay/ConversationAnalysis.tsx` -- Post-roleplay analysis, read in full
- `src/components/errors/ErrorDashboard.tsx` -- Error display, read in full
- `src/services/storage.test.ts` -- Existing test patterns, read in full
- `.planning/config.json` -- Workflow configuration including nyquist_validation: true
- `CLAUDE.md` -- Project constraints

### Secondary (MEDIUM confidence)
- `vite.config.ts` -- Test configuration verified via grep

## Metadata

**Confidence breakdown:**
- Data flow mapping: HIGH - All source files read in full, traced call chains end-to-end
- Bug identification: HIGH - Specific line numbers and code patterns verified
- Architecture patterns: HIGH - No new patterns needed, existing architecture is well-understood
- Pitfalls: HIGH - All pitfalls identified by reading actual code, not assumed

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable codebase, no external dependencies changing)
