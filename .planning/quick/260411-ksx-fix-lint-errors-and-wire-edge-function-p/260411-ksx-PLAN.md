---
phase: quick
plan: 260411-ksx
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/discovery/ExerciseMode.tsx
  - supabase/functions/ai-proxy/index.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "ExerciseMode.tsx has no unused import lint errors"
    - "index.ts imports from all sibling modules (crypto, utils, api-keys, log, providers/*)"
    - "index.ts has no duplicate inline function definitions for anything covered by the modules"
    - "The serve() handler and all routing/orchestration logic remain intact"
    - "No undefined symbol references remain after deduplication"
  artifacts:
    - path: "src/components/discovery/ExerciseMode.tsx"
      provides: "Clean lint — no unused ImageIcon/Mic imports"
    - path: "supabase/functions/ai-proxy/index.ts"
      provides: "Refactored entry — imports modules, no duplicated function bodies"
  key_links:
    - from: "supabase/functions/ai-proxy/index.ts"
      to: "supabase/functions/ai-proxy/providers/gemini.ts"
      via: "import * as Gemini from './providers/gemini.ts'"
    - from: "supabase/functions/ai-proxy/index.ts"
      to: "supabase/functions/ai-proxy/api-keys.ts"
      via: "import { sourceToDbColumn, normalizeSource, getApiKey, saveApiKey } from './api-keys.ts'"
---

<objective>
Commit the already-applied ExerciseMode.tsx lint fix, then refactor index.ts to import
from the sibling modules that already exist (crypto, utils, api-keys, log, providers/*),
removing all duplicate inline function definitions.

Purpose: Eliminate ~900 lines of duplication so the edge function is maintainable.
Output: A clean index.ts that delegates to its modules, plus the committed lint fix.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<interfaces>
<!-- Exact exports the executor must import — verified from the module files. -->

From ./crypto.ts:
```typescript
export const PBKDF2_ITERATIONS: number
export const SALT_LENGTH: number
export const IV_LENGTH: number
export const KEY_LENGTH: number
export async function deriveKey(encryptionKey: string, salt: Uint8Array): Promise<CryptoKey>
export async function decrypt(ciphertext: string, iv: string, salt: string, key: string): Promise<string>
export async function encrypt(plaintext: string, key: string): Promise<{ ciphertext: string; iv: string; salt: string }>
```

From ./utils.ts:
```typescript
export function uint8ToBase64(bytes: Uint8Array): string
export function str2ab(str: string): ArrayBuffer
export function pcm16ToWav(pcm16Base64: string, sampleRate: number): string
export function writeString(view: DataView, offset: number, string: string): void
```

From ./api-keys.ts:
```typescript
// NOTE: module signatures take supabase + encryptionKey as explicit params
export function sourceToDbColumn(source: string): string | null
export function normalizeSource(source: string | undefined, fallback?: string): string
export async function getApiKey(supabase: any, encryptionKey: string, userId: string, source: string): Promise<string | null>
export async function saveApiKey(supabase: any, encryptionKey: string, userId: string, source: string, key: string): Promise<void>
```

From ./log.ts:
```typescript
export function createRequestLogger(requestId?: string): { info, error, getRequestId }
```

From ./providers/gemini.ts:
```typescript
export async function chat(apiKey, model, systemPrompt, userMessage): Promise<string>
export async function tts(apiKey, text, voice, model): Promise<string>
export async function stt(apiKey, audioBase64, mimeType, model): Promise<string>
export async function image(apiKey, prompt, model, options): Promise<string>
```

From ./providers/openai.ts:
```typescript
export async function chat(apiKey, model, systemPrompt, userMessage, temperature?): Promise<string>
export async function tts(apiKey, text, voice, model): Promise<string>
export async function stt(apiKey, audioBase64, mimeType, model): Promise<string>
export async function image(apiKey, prompt, model, options): Promise<string>
```

From ./providers/groq.ts:
```typescript
export async function chat(apiKey, model, systemPrompt, userMessage): Promise<string>
export async function tts(apiKey, text, voice, model): Promise<string>
export async function stt(apiKey, audioBase64, mimeType, model): Promise<string>
// No image export
```

From ./providers/openrouter.ts:
```typescript
export async function chat(apiKey, model, systemPrompt, userMessage, temperature?): Promise<string>
export async function tts(apiKey, text, voice, model): Promise<string>
export async function stt(apiKey, audioBase64, mimeType, model): Promise<string>
export async function image(apiKey, prompt, model): Promise<string>
// NOTE: image() takes only 3 args (no options) — different from gemini/openai
```

From ./providers/vertex.ts:
```typescript
export async function getAccessToken(): Promise<string>
export async function getConfig(supabaseClient, userId): Promise<{ projectId, region }>
export async function chat(accessToken, projectId, region, model, systemPrompt, userMessage): Promise<string>
export async function chatWithImage(accessToken, projectId, region, model, systemPrompt, imageBase64, imageMimeType): Promise<string>
export async function tts(accessToken, projectId, region, model, text, voice): Promise<string>
export async function stt(accessToken, projectId, region, model, audioBase64, mimeType): Promise<string>
export async function image(accessToken, projectId, region, model, prompt, options): Promise<string>
// NOTE: getAccessToken() reads Deno.env internally (no param)
// NOTE: getConfig() takes supabaseClient (not the module-level supabase directly)
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Commit the ExerciseMode.tsx lint fix</name>
  <files>src/components/discovery/ExerciseMode.tsx</files>
  <action>
    The unused `ImageIcon` and `Mic` imports have already been removed from this file.
    The change is unstaged. Stage and commit it:

    ```bash
    git add src/components/discovery/ExerciseMode.tsx
    git commit -m "fix: remove unused ImageIcon and Mic imports from ExerciseMode"
    ```

    No code changes needed — this task is commit-only.
  </action>
  <verify>
    <automated>git log --oneline -1 | grep "remove unused ImageIcon"</automated>
  </verify>
  <done>Commit exists with the removed imports. `git diff HEAD~1 HEAD -- src/components/discovery/ExerciseMode.tsx` shows only the import line change.</done>
</task>

<task type="auto">
  <name>Task 2: Wire module imports into index.ts and remove duplicate inline code</name>
  <files>supabase/functions/ai-proxy/index.ts</files>
  <action>
    Rewrite the top of index.ts to import from all sibling modules, then delete every
    inline function body that is now covered by an import. The serve() handler and all
    orchestration/routing logic (the switch statement, image URL fetching, the Gemini SDK
    chat-with-image inline block) must remain intact.

    **Step 1 — Add imports after the existing `createClient` import (line 11):**

    ```typescript
    import { deriveKey, decrypt, encrypt, PBKDF2_ITERATIONS, SALT_LENGTH, IV_LENGTH, KEY_LENGTH } from './crypto.ts'
    import { uint8ToBase64, str2ab, pcm16ToWav, writeString } from './utils.ts'
    import { sourceToDbColumn, normalizeSource, getApiKey as getApiKeyFromModule, saveApiKey as saveApiKeyFromModule } from './api-keys.ts'
    import { createRequestLogger } from './log.ts'
    import * as Gemini from './providers/gemini.ts'
    import * as OpenAI from './providers/openai.ts'
    import * as Groq from './providers/groq.ts'
    import * as OpenRouter from './providers/openrouter.ts'
    import * as Vertex from './providers/vertex.ts'
    ```

    Note: `getApiKey` and `saveApiKey` are aliased because index.ts has wrapper functions
    with the same names but different signatures (closures over `supabase` + `ENCRYPTION_KEY`).

    **Step 2 — Remove these inline blocks entirely (delete start-to-end):**

    - Lines 33-96: The `// ENCRYPTION UTILITIES` section — constants + `deriveKey`, `decrypt`, `encrypt`
    - Lines 98-122: The `// SOURCE HELPERS` section — `sourceToDbColumn`, `normalizeSource`
    - Lines 148-237: The `// API KEY RETRIEVAL` section — `getApiKey`, `saveApiKey`
      EXCEPTION: Keep these as thin wrappers that call the module with the closed-over vars:
      ```typescript
      async function getApiKey(userId: string, source: string): Promise<string | null> {
        return getApiKeyFromModule(supabase, ENCRYPTION_KEY, userId, source)
      }
      async function saveApiKey(userId: string, source: string, key: string): Promise<void> {
        return saveApiKeyFromModule(supabase, ENCRYPTION_KEY, userId, source, key)
      }
      ```
    - Lines 246-501: The inline chat/TTS/STT functions — `openaiChat`, `geminiChat`, `groqChat`,
      `openaiTTS`, `geminiTTS`, `groqTTS`, `openaiSTT`, `geminiSTT`, `groqSTT`
    - Lines 503-647: The `// OPENROUTER API CALLS` section — `openrouterChat`, `openrouterTTS`,
      `openrouterSTT`, `openrouterImage`
    - Lines 649-961: The `// VERTEX AI API CALLS` section — `getVertexAccessToken`, `getVertexConfig`,
      `vertexChat`, `vertexChatWithImage`, `vertexTTS`, `vertexSTT`, `vertexImage`
    - Lines 963-1003: The local helpers section — `base64urlEncode`, `uint8ToBase64url`,
      `uint8ToBase64`, `str2ab`
      EXCEPTION: Keep `base64urlEncode` and `uint8ToBase64url` ONLY IF they are not exported
      from any module. They are used only in `getVertexAccessToken` which now moves to vertex.ts,
      so delete them — vertex.ts has its own copies internally.
    - Lines 1005-1167: The `// IMAGE GENERATION` and `// HELPER FUNCTIONS` sections —
      `openaiImage`, `geminiImage`, `pcm16ToWav`, `writeString`

    **Step 3 — Update all call sites in the serve() handler to use the imported namespaces:**

    Replace local function names with namespace calls:
    - `openaiChat(...)` → `OpenAI.chat(...)`
    - `geminiChat(...)` → `Gemini.chat(...)`
    - `groqChat(...)` → `Groq.chat(...)`
    - `openrouterChat(...)` → `OpenRouter.chat(...)`
    - `vertexChat(...)` → `Vertex.chat(...)`
    - `vertexChatWithImage(...)` → `Vertex.chatWithImage(...)`
    - `openaiTTS(...)` → `OpenAI.tts(...)`
    - `geminiTTS(...)` → `Gemini.tts(...)`
    - `groqTTS(...)` → `Groq.tts(...)`
    - `openrouterTTS(...)` → `OpenRouter.tts(...)`
    - `vertexTTS(...)` → `Vertex.tts(...)`
    - `openaiSTT(...)` → `OpenAI.stt(...)`
    - `geminiSTT(...)` → `Gemini.stt(...)`
    - `groqSTT(...)` → `Groq.stt(...)`
    - `openrouterSTT(...)` → `OpenRouter.stt(...)`
    - `vertexSTT(...)` → `Vertex.stt(...)`
    - `openaiImage(...)` → `OpenAI.image(...)`
    - `geminiImage(...)` → `Gemini.image(...)`
    - `openrouterImage(...)` → `OpenRouter.image(...)`
    - `vertexImage(...)` → `Vertex.image(...)`
    - `getVertexAccessToken()` → `Vertex.getAccessToken()`
    - `getVertexConfig(userId)` → `Vertex.getConfig(supabase, userId)`
    - `uint8ToBase64(...)` → imported from utils, use directly
    - `normalizeSource(...)` → imported from api-keys, use directly (already aliased or re-exported)

    **Step 4 — Verify the `isSafeImageUrl` function stays inline** (it is not in any module).

    **Step 5 — Verify unused imports:**
    After wiring, `PBKDF2_ITERATIONS`, `SALT_LENGTH`, `IV_LENGTH`, `KEY_LENGTH`, `deriveKey`,
    `decrypt`, `encrypt`, `writeString`, `str2ab` are imported but not directly used in index.ts
    — they are used inside the modules. Remove them from the index.ts import if unused there,
    or keep only what index.ts actually calls directly. Audit each import.

    Actually: `decrypt` and `encrypt` were used in the old inline `getApiKey`/`saveApiKey` but
    now those are delegated to `getApiKeyFromModule`/`saveApiKeyFromModule`. So do NOT import
    crypto constants or functions in index.ts — they are only needed inside api-keys.ts (which
    already imports them from crypto.ts). Similarly `str2ab`, `writeString`, `pcm16ToWav` are
    used inside provider modules, not in index.ts directly.

    Correct minimal import set for index.ts:
    - `uint8ToBase64` from utils (still used in inline Gemini chat-with-image block at line 1249/1275)
    - `normalizeSource`, `sourceToDbColumn` from api-keys (sourceToDbColumn may not be needed in index.ts)
    - All provider namespaces
    - `createRequestLogger` from log (if adding any logging, otherwise can skip)

    Audit each symbol before including in the import to avoid "imported but not used" errors.

    **Constraints:**
    - This is a Deno edge function — use `.ts` extensions on all relative imports
    - Do not change the serve() handler logic or any routing conditions
    - The inline Gemini SDK import block for imageMode chat (lines 1258-1291) is unique
      orchestration logic — it stays in index.ts, it is NOT a duplicate of providers/gemini.ts
    - Keep the `isSafeImageUrl` function inline (no module for it)
    - After editing, run: `grep -n "^function\|^async function" supabase/functions/ai-proxy/index.ts`
      and verify only `isSafeImageUrl`, `getApiKey`, `saveApiKey` (wrappers) remain as local functions
  </action>
  <verify>
    <automated>
      # Count remaining local function definitions — expect only 3 (isSafeImageUrl, getApiKey wrapper, saveApiKey wrapper)
      grep -c "^async function\|^function" supabase/functions/ai-proxy/index.ts

      # Verify imports exist at top of file
      head -20 supabase/functions/ai-proxy/index.ts | grep "import.*providers"

      # Verify file still ends with serve() call
      tail -5 supabase/functions/ai-proxy/index.ts
    </automated>
  </verify>
  <done>
    - index.ts has import statements for all provider modules and utility modules
    - `grep -c "^async function\|^function" index.ts` returns 3 or fewer
    - The file compiles without TypeScript errors (Deno check or tsc equivalent)
    - serve() handler is intact and unchanged in logic
    - Commit created: `fix: wire module imports into ai-proxy index.ts, remove duplicate inline code`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| index.ts → module files | Import-only; no new trust surface introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ksx-01 | Tampering | Module import chain | accept | Modules are co-located in the same Edge Function bundle; no external import surface added |
</threat_model>

<verification>
After Task 2 completes:
1. `grep "^import" supabase/functions/ai-proxy/index.ts` — must show imports from `./crypto.ts`, `./utils.ts`, `./api-keys.ts`, `./log.ts`, `./providers/*.ts`
2. `grep -c "^async function\|^function" supabase/functions/ai-proxy/index.ts` — must be 3 or fewer
3. `wc -l supabase/functions/ai-proxy/index.ts` — should be around 500-600 lines (down from 1464)
4. `tail -10 supabase/functions/ai-proxy/index.ts` — must end with `})` closing the serve() handler
</verification>

<success_criteria>
- ExerciseMode.tsx lint fix committed
- index.ts imports all provider and utility modules
- index.ts has no duplicate inline implementations of anything in the modules
- serve() handler logic is 100% preserved
- No undefined references remain (isSafeImageUrl, getApiKey wrapper, saveApiKey wrapper all present)
</success_criteria>

<output>
After completion, create `.planning/quick/260411-ksx-fix-lint-errors-and-wire-edge-function-p/260411-ksx-SUMMARY.md`
</output>
