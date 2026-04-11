---
phase: 17-retry-exercise
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - package.json
  - public/worklets/pcm-processor.js
  - src/components/discovery/ExerciseMode.tsx
  - src/components/discovery/ImageMode.tsx
  - src/components/live-roleplay/ConversationAnalysis.tsx
  - src/components/live-roleplay/LiveRoleplayPage.tsx
  - src/components/settings/SettingsPage.tsx
  - src/services/audioCache.test.ts
  - src/services/audioCache.ts
  - src/services/geminiLive.test.ts
  - src/services/geminiLive.ts
  - src/services/modelCatalog.test.ts
  - src/services/modelCatalog.ts
  - src/services/openai.test.ts
  - src/services/openai.ts
  - src/test/setup.ts
  - supabase/functions/ai-proxy/api-keys.ts
  - supabase/functions/ai-proxy/crypto.ts
  - supabase/functions/ai-proxy/index.ts
  - supabase/functions/ai-proxy/log.ts
  - supabase/functions/ai-proxy/providers/gemini.ts
  - supabase/functions/ai-proxy/providers/groq.ts
  - supabase/functions/ai-proxy/providers/openai.ts
  - supabase/functions/ai-proxy/providers/openrouter.ts
  - supabase/functions/ai-proxy/providers/vertex.ts
  - supabase/functions/ai-proxy/utils.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed 25 source files across the Edge Function proxy layer (modularized into providers, api-keys, crypto, utils, log), client-side AI service (openai.ts, modelCatalog.ts), audio cache (IndexedDB), Gemini Live session, test files, UI components (ExerciseMode, ImageMode, ConversationAnalysis, LiveRoleplayPage, SettingsPage), and the PCM worklet.

The codebase is generally well-structured with solid error handling patterns (primary/fallback), proper encryption (PBKDF2 + AES-256-GCM), and good test coverage. The modularization of the monolithic Edge Function into separate provider modules is clean.

Key concerns: several `btoa(String.fromCharCode(...new Uint8Array(buffer)))` calls that silently corrupt large audio responses, an `any` type in Vertex provider that bypasses TypeScript safety, a non-null-assertion risk on the JWT base64 encoding in the Vertex auth flow, and a missing `await` in a void expression.

## Warnings

### WR-01: btoa with spread operator silently truncates large binary data

**File:** `supabase/functions/ai-proxy/providers/openai.ts:53`
**Also affects:** `supabase/functions/ai-proxy/providers/openai.ts:319`, `supabase/functions/ai-proxy/providers/groq.ts:57`, `supabase/functions/ai-proxy/providers/openrouter.ts:59`, `supabase/functions/ai-proxy/crypto.ts:57`, `supabase/functions/ai-proxy/index.ts:87`, `supabase/functions/ai-proxy/index.ts:319`, `supabase/functions/ai-proxy/index.ts:375`, `supabase/functions/ai-proxy/index.ts:519`, `supabase/functions/ai-proxy/index.ts:644`, `supabase/functions/ai-proxy/index.ts:1075`, `supabase/functions/ai-proxy/utils.ts:43`, `supabase/functions/ai-proxy/providers/vertex.ts:43`

**Issue:** `btoa(String.fromCharCode(...new Uint8Array(buffer)))` uses the spread operator to pass every byte as a separate argument. JavaScript function calls have a maximum argument count (exceeds call stack for arrays >~64KB-130KB depending on engine). For TTS audio responses or large image data, this will throw a `RangeError: Maximum call stack size exceeded` at runtime, silently failing TTS/image generation for any response larger than roughly 64KB.

**Fix:**
```typescript
// Replace all instances of:
btoa(String.fromCharCode(...new Uint8Array(buffer)))
// With a chunked approach:
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
```
Note: The `encodeBase64` helper in `src/services/geminiLive.ts:10-14` already does this correctly with a loop -- that pattern should be reused everywhere.

### WR-02: Non-null assertion on Supabase env vars can crash at module load time

**File:** `supabase/functions/ai-proxy/index.ts:25-26`

**Issue:** `Deno.env.get('SUPABASE_URL')!` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` use non-null assertions. If these env vars are missing, the code won't throw at the `!` line -- it will silently pass `undefined` to `createClient`, which will then fail with an obscure error deep in the Supabase SDK when the first request arrives. The `ENCRYPTION_KEY` check at line 20 correctly validates immediately; these two should too.

**Fix:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set')
}
const supabase = createClient(supabaseUrl, supabaseServiceKey)
```

### WR-03: Vertex JWT base64 encoding uses btoa with spread on signature bytes

**File:** `supabase/functions/ai-proxy/providers/vertex.ts:43`
**Also affects:** `supabase/functions/ai-proxy/index.ts:644`

**Issue:** `btoa(String.fromCharCode(...new Uint8Array(signature)))` in the Vertex JWT construction will fail for the same reason as WR-01 if the RSA signature exceeds the call stack limit. RSA-2048 signatures are 256 bytes, which is safe, but the pattern is fragile and inconsistent with how the rest of the JWT header/payload are encoded (using plain `btoa(JSON.stringify(...))` for strings). If the implementation ever changes to a larger key, or if the spread pattern is copy-pasted elsewhere, it will break.

**Fix:** Use the same chunked `uint8ToBase64` helper recommended in WR-01, or at minimum a dedicated helper for the signature encoding.

### WR-04: `any` type for Supabase client in Vertex provider bypasses type safety

**File:** `supabase/functions/ai-proxy/providers/vertex.ts:64`

**Issue:** The `getConfig` function parameter `supabaseClient: any` loses all type checking. If the Supabase client API changes or is called incorrectly (wrong method name, wrong query builder chain), TypeScript won't catch it. This is a Deno/Edge Function context where importing the Supabase types may not be straightforward, but the loose `any` is still a risk.

**Fix:**
```typescript
// Define a minimal interface for what's needed:
interface SupabaseQueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: any; error: any }>
      }
    }
  }
}

export async function getConfig(supabaseClient: SupabaseQueryClient, userId: string): Promise<{ projectId: string; region: string }> {
```

### WR-05: Missing `await` on `addCard` in ExerciseMode save handler

**File:** `src/components/discovery/ExerciseMode.tsx:212`

**Issue:** `await addCard(card)` is correctly awaited, but `syncGamificationState()` on line 213 is not awaited. The `handleSaveToLibrary` function is `async` and is called via `void handleSaveToLibrary()`, so the missing `await` means `setSaved(true)` executes before gamification state finishes syncing. If the sync fails, the user sees "Salvo na Biblioteca!" but gamification state is stale.

**Fix:**
```typescript
await addCard(card);
await syncGamificationState();
setSaved(true);
```

## Info

### IN-01: Duplicate helper functions between modularized files and monolithic index.ts

**File:** `supabase/functions/ai-proxy/index.ts` vs `supabase/functions/ai-proxy/providers/*.ts`

**Issue:** The `index.ts` file still contains all the original provider functions (openaiChat, geminiChat, groqChat, openaiTTS, etc.) alongside the modularized versions in `providers/`. The modularized files (`providers/openai.ts`, `providers/gemini.ts`, etc.) duplicate this logic. If `index.ts` is intended to remain the single handler that delegates to the provider modules, the inline implementations should be removed and replaced with imports from the provider modules.

**Fix:** Refactor `index.ts` to import from `providers/*.ts` instead of re-declaring the same functions. This is likely a transitional state.

### IN-02: Duplicate `detectSource` function in openai.ts and modelCatalog.ts

**File:** `src/services/openai.ts:23-38` and `src/services/modelCatalog.ts:44-59`

**Issue:** The `detectSource` function is duplicated between `openai.ts` and `modelCatalog.ts`. Both implement identical heuristic source detection. The `modelCatalog.ts` version is the canonical one (used by tests); `openai.ts` should import `resolveSource` from `modelCatalog.ts` instead of maintaining its own copy.

**Fix:** In `openai.ts`, replace the local `detectSource` with an import:
```typescript
import { resolveSource } from './modelCatalog';
// Then use resolveSource(modelId) where detectSource was called
```

### IN-03: ConversationAnalysis has a dependency array mismatch in useCallback

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:128`

**Issue:** The `generateDialogueAudio` callback captures no values from its closure but is declared with an empty dependency array `[]`. While this is technically correct (it only uses its parameter `data` and the `setAudioProgress`, `setAudioTotal`, etc. setters which are stable), the `getShadowingVoices` function it calls reads from `getModelConfig()` on every invocation, which is a side-channel read rather than a captured dependency. This works but is fragile if `getModelConfig` ever becomes async.

**Fix:** Consider passing `voices` as a parameter to `generateDialogueAudio` to make the dependency explicit:
```typescript
const generateDialogueAudio = useCallback(async (data: AnalysisData, voices: { userVoice: string; aiVoice: string }) => {
  // ...
}, []);
```

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
