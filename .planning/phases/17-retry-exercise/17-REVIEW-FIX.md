---
phase: 17-retry-exercise
fixed_at: 2026-04-10T12:30:00Z
review_path: .planning/phases/17-retry-exercise/17-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-10T12:30:00Z
**Source review:** .planning/phases/17-retry-exercise/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 4
- Skipped: 1

## Fixed Issues

### WR-01: btoa with spread operator silently truncates large binary data

**Files modified:** `supabase/functions/ai-proxy/utils.ts`, `supabase/functions/ai-proxy/crypto.ts`, `supabase/functions/ai-proxy/providers/openai.ts`, `supabase/functions/ai-proxy/providers/groq.ts`, `supabase/functions/ai-proxy/providers/openrouter.ts`, `supabase/functions/ai-proxy/index.ts`
**Commit:** e399437
**Applied fix:** Added `uint8ToBase64` helper function with chunked 8192-byte encoding to `utils.ts`. Replaced all 13 instances of `btoa(String.fromCharCode(...new Uint8Array(buffer)))` across 6 files with calls to the safe helper. Provider modules import from `utils.ts`; monolithic `index.ts` has its own copy of the function.

### WR-02: Non-null assertion on Supabase env vars can crash at module load time

**Files modified:** `supabase/functions/ai-proxy/index.ts`
**Commit:** e399437
**Applied fix:** Replaced `Deno.env.get('SUPABASE_URL')!` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` with explicit null checks and a descriptive error message, matching the pattern already used for `ENCRYPTION_KEY`.

### WR-03: Vertex JWT base64 encoding uses btoa with spread on signature bytes

**Files modified:** `supabase/functions/ai-proxy/providers/vertex.ts`, `supabase/functions/ai-proxy/index.ts`
**Commit:** e399437
**Applied fix:** Subsumed by WR-01 fix -- both Vertex JWT signature encoding sites now use the same `uint8ToBase64` helper.

### WR-04: `any` type for Supabase client in Vertex provider bypasses type safety

**Files modified:** `supabase/functions/ai-proxy/providers/vertex.ts`
**Commit:** e399437
**Applied fix:** Replaced `supabaseClient: any` with a minimal `SupabaseQueryClient` interface that describes the chained query builder pattern used by the function (`from().select().eq().single()`).

## Skipped Issues

### WR-05: Missing `await` on `addCard` in ExerciseMode save handler

**File:** `src/components/discovery/ExerciseMode.tsx:212`
**Reason:** code context differs from review -- the `await` on `syncGamificationState()` is already present at line 213 in the current codebase. The fix described in the review has already been applied.
**Original issue:** `syncGamificationState()` was reported as not being awaited, but current code already has `await syncGamificationState()`.

---

_Fixed: 2026-04-10T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
