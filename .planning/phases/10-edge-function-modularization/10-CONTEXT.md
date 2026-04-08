# Phase 10: Edge Function Modularization - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — no discuss needed)

<domain>
## Phase Boundary

The ai-proxy Edge Function is maintainable — thin router delegating to focused provider modules with structured logging. Currently a 743-line monolith in `supabase/functions/ai-proxy/index.ts` needs to be split into focused modules.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria:
1. `ai-proxy/index.ts` is under 120 lines — a thin router that delegates to provider modules
2. All provider logic lives in dedicated modules (crypto.ts, api-keys.ts, providers/openai.ts, providers/gemini.ts, providers/groq.ts, providers/openrouter.ts, providers/vertex.ts, utils.ts)
3. Local testing via `supabase functions serve` passes for all action types (chat, TTS, STT, image) with identical request/response shapes
4. Every request logs a structured entry with request ID, provider, action, and outcome

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
