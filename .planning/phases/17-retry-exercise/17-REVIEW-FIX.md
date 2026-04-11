---
phase: 17-retry-exercise
fixed_at: 2026-04-11T13:00:00Z
review_path: .planning/phases/17-retry-exercise/17-REVIEW.md
iteration: 3
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-11T13:00:00Z
**Source review:** .planning/phases/17-retry-exercise/17-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 7 (2 Critical, 5 Warning)
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01: Gemini API key leaked in URL query parameter (server-side)

**Files modified:** `supabase/functions/ai-proxy/providers/gemini.ts`, `supabase/functions/ai-proxy/index.ts`
**Commit:** 85a9eba
**Applied fix:** Replaced all `?key=${apiKey}` URL query parameter patterns with `x-goog-api-key` header in both gemini.ts provider module (3 locations: chat, predict, generateContent) and index.ts inline functions (3 locations: geminiChat, geminiImage predict, geminiImage generateContent).

### CR-02: SSRF via unsanitized imageUrl fetch in edge function

**Files modified:** `supabase/functions/ai-proxy/index.ts`
**Commit:** 3e7a8f1
**Applied fix:** Added `isSafeImageUrl()` validation function that blocks internal/private IPs (localhost, 127.0.0.1, 10.x, 172.16-31.x, 192.168.x, link-local, metadata endpoints, .internal/.local domains) and non-HTTP protocols. Applied guard before both `fetch(body.imageUrl)` calls (Vertex and Gemini image-with-chat branches).

### WR-01: detectSource misroutes Groq models with openai/ prefix

**Files modified:** `src/services/openai.ts`
**Commit:** 5f69015
**Applied fix:** Added `modelId.startsWith('openai/gpt-oss')` to the Groq branch in `detectSource()`, so Groq-hosted OSS models like `openai/gpt-oss-120b` route to the correct provider instead of falling through to OpenRouter.

### WR-02: Farewell detection matches false positives in LiveSession

**Files modified:** `src/components/live-roleplay/LiveSession.tsx`
**Commit:** 8fd11cc
**Applied fix:** Replaced string `includes()` matching with word-boundary regex patterns. `'bye'` now uses `/\bbye\b/i` to avoid matching "by the way". `'have a good'` and `'have a nice'` now require a following time-of-day/activity word (day, night, evening, etc.) to reduce false positives like "I have a good idea".

### WR-03: Potential NaN when computing average score with empty array

**Files modified:** `src/components/review/ReviewPage.tsx`
**Commit:** b14ea0b
**Applied fix:** Added `sessionScores.length > 0` guard before computing average. Returns 0 as fallback when the array is empty, preventing NaN from division by zero.

### WR-05: CORS response headers missing Content-Type

**Files modified:** `supabase/functions/ai-proxy/index.ts`
**Commit:** 1bb326c
**Applied fix:** Added `'Content-Type': 'application/json'` to the `corsHeaders` object, ensuring all JSON responses include the proper MIME type.

## Skipped Issues

### WR-04: Edge function provider modules are dead code (not imported)

**File:** `supabase/functions/ai-proxy/providers/*.ts`, `supabase/functions/ai-proxy/index.ts`
**Reason:** Large refactor (800+ lines, restructuring module imports across 5 provider files and index.ts). Should be a dedicated task with its own phase rather than a code review fix. The duplicated code is not actively harmful -- it increases maintenance burden but does not introduce bugs or security vulnerabilities.
**Original issue:** Provider modules (gemini.ts, groq.ts, openai.ts, openrouter.ts, vertex.ts) and utility modules are not imported by index.ts. All logic remains inline in the 1434-line index.ts file, requiring bug fixes in two places.

---

_Fixed: 2026-04-11T13:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
