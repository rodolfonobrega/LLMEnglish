# Milestone v1.2: Audio & Proxy Cleanup — Requirements

## Requirements

### Audio Cache (AC)

- [ ] **AC-01**: App caches TTS audio responses in IndexedDB, keyed by text hash + voice + model, eliminating redundant network calls for repeated text
- [ ] **AC-02**: Audio cache stores Blobs natively (no base64 encoding), using `idb@8` for typed IndexedDB access with DBSchema
- [ ] **AC-03**: TTS call chain checks IndexedDB cache before making proxy requests (cache-first strategy)
- [ ] **AC-04**: Cache handles quota errors gracefully — on write failure, log warning and continue without caching (no user-facing error)
- [ ] **AC-05**: Cache evicts oldest entries when total size exceeds a configurable limit (default 50MB), using LRU based on access timestamps
- [ ] **AC-06**: Cache service is isolated in `src/services/audioCache.ts` — no modifications to existing storage.ts or supabase/storage.ts

### AudioWorklet Migration (AW)

- [ ] **AW-01**: `geminiLive.ts` uses `AudioWorkletNode` instead of deprecated `ScriptProcessorNode` for microphone input processing
- [ ] **AW-02**: AudioWorklet processor lives in `public/worklets/pcm-processor.js` as a plain JS file (no TypeScript, no imports, no exports)
- [ ] **AW-03**: Processor buffers 128-sample chunks to 4096 samples before posting to main thread, preventing 32x WebSocket message flooding
- [ ] **AW-04**: Buffered PCM data is converted to PCM16 and sent to Gemini Live WebSocket as before — no protocol changes
- [ ] **AW-05**: AudioWorklet buffer size is configurable via `AudioWorkletNode.port.postMessage()` for latency vs throughput tuning
- [ ] **AW-06**: Output path (AudioBufferSourceNode scheduling) remains unchanged — only microphone input path is modified

### Model Catalog (MC)

- [ ] **MC-01**: New `modelCatalog.ts` builds a `Map<string, Source>` from existing `ModelOption[]` arrays in `settings.ts` (105 models across 5 arrays)
- [ ] **MC-02**: `detectSource()` in `openai.ts` is replaced with catalog lookup function
- [ ] **MC-03**: Heuristic fallback preserved for model IDs not in the catalog (handles user-saved custom models)
- [ ] **MC-04**: Settings UI validates model+source combinations using the catalog, showing a warning for unknown combinations

### Edge Function Modularization (EF)

- [ ] **EF-01**: `ai-proxy/index.ts` (1364 lines) split into ~8 modules: `crypto.ts`, `api-keys.ts`, `providers/openai.ts`, `providers/gemini.ts`, `providers/groq.ts`, `providers/openrouter.ts`, `providers/vertex.ts`, `utils.ts`
- [ ] **EF-02**: Main `index.ts` becomes a thin router (~100 lines) delegating to provider modules
- [ ] **EF-03**: No behavior changes — all existing API contracts (request/response shapes, error codes) remain identical
- [ ] **EF-04**: Modularized function passes local testing via `supabase functions serve` for all action types (chat, TTS, STT, image)
- [ ] **EF-05**: Structured logging with request ID and provider context in a `log.ts` utility for easier debugging

### Dead Code Cleanup (DC)

- [ ] **DC-01**: Remove `/api/groq` proxy block from `vite.config.ts` (lines 37-43) — zero consumers confirmed by grep
- [ ] **DC-02**: Update coverage config in `vite.config.ts` to remove reference to deleted `openaiRealtimeLive.ts` (removed in v1.1)

## Future Requirements

- Pronunciation feedback with phoneme-level analysis (future feature)
- IndexedDB for non-audio data (cards, gamification, sessions) — existing storage facade is sufficient
- Offline-first queue for TTS requests — caching only covers redundant calls
- Service Worker for audio caching — application-level IndexedDB is simpler
- AudioWorklet SharedArrayBuffer path — requires COOP/COEP headers, not compatible with current hosting
- N+1 card save optimization — deferred to future milestone
- Oversized file splitting (storage.ts 968 lines, prompts.ts 438 lines) — deferred to future milestone
- Runtime state window event replacement with Zustand/Jotai — deferred to future milestone

## Out of Scope

- Adding new exercise modes or features — focused on infrastructure cleanup
- Backend/Supabase schema changes — client-side and edge function only
- Test suite expansion beyond what's needed for new modules — addressed separately
- Full accessibility audit — too broad for this milestone
- Replacing the existing storage.ts facade — only adding audioCache.ts alongside it

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AC-01 | TBD | Pending |
| AC-02 | TBD | Pending |
| AC-03 | TBD | Pending |
| AC-04 | TBD | Pending |
| AC-05 | TBD | Pending |
| AC-06 | TBD | Pending |
| AW-01 | TBD | Pending |
| AW-02 | TBD | Pending |
| AW-03 | TBD | Pending |
| AW-04 | TBD | Pending |
| AW-05 | TBD | Pending |
| AW-06 | TBD | Pending |
| MC-01 | TBD | Pending |
| MC-02 | TBD | Pending |
| MC-03 | TBD | Pending |
| MC-04 | TBD | Pending |
| EF-01 | TBD | Pending |
| EF-02 | TBD | Pending |
| EF-03 | TBD | Pending |
| EF-04 | TBD | Pending |
| EF-05 | TBD | Pending |
| DC-01 | TBD | Pending |
| DC-02 | TBD | Pending |

---

*Generated: 2026-04-07*
*Milestone: v1.2 Audio & Proxy Cleanup*
