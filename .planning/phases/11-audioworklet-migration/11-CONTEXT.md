# Phase 11: AudioWorklet Migration - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — no discuss needed)

<domain>
## Phase Boundary

Gemini Live microphone input uses AudioWorkletNode — off-main-thread processing with no deprecated API usage. Migrate from ScriptProcessorNode to AudioWorkletNode in geminiLive.ts.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/refactoring phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

Success criteria:
1. `geminiLive.ts` contains zero references to ScriptProcessorNode — only AudioWorkletNode for mic input
2. A live roleplay session sends and receives audio without glitches or WebSocket message flooding
3. The PCM processor file exists at `public/worklets/pcm-processor.js` as plain JS with no imports/exports
4. Audio output path (AudioBufferSourceNode scheduling) remains completely unchanged

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
