/**
 * Unified LLM telemetry — Phase 5 (F-P5-04).
 *
 * One record per LLM call, regardless of surface (Review, Live, Paths,
 * Master, etc.), regardless of provider (`genai` / `openai` / `groq` /
 * `openrouter` / `vertex`), and regardless of operation kind (`chat`,
 * `stt`, `tts`, `image`, `live`).
 *
 * Relationship to `masterTelemetry.ts`:
 *   * `master_usage` stays for back-compat with existing dashboards.
 *   * All NEW cost instrumentation goes through this module + the
 *     `llm_usage` table (migration: 20260421_phase5_llm_usage.sql).
 *
 * Cost estimation:
 *   Today the ai-proxy does NOT forward provider-native token usage back
 *   to the client, so we estimate tokens client-side using a crude
 *   `charsToTokens(text)` heuristic and pass it through the static price
 *   table in `src/utils/llmPricing.ts`. Once the ai-proxy is updated to
 *   return real token counts (tracked in `docs/pending-ops-todos.md`),
 *   callers can pass `tokensIn` / `tokensOut` explicitly and the
 *   estimate is bypassed.
 *
 * Non-blocking: any failure is swallowed with `console.warn`. A
 * telemetry outage NEVER breaks a student-facing flow.
 */

import { supabase } from './supabase/client';
import { getCurrentUser } from './supabase/auth';
import type { Source } from '../types/settings';
import { estimateCostUsd } from '../utils/llmPricing';

export type LlmOperation = 'chat' | 'stt' | 'tts' | 'image' | 'live' | 'embed';

export interface LlmUsageRecord {
  /** Provider-native source ("genai", "openai", "groq", "openrouter", "vertex"). */
  provider: Source;
  /** Model id, e.g. "gemini-2.5-flash". */
  model: string;
  /**
   * Feature surface the call originated from. Free-form string so new
   * pages don't need a DB migration. Examples: 'review', 'paths',
   * 'live', 'exercises', 'lesson', 'scripts'.
   */
  surface: string;
  /**
   * Logical role of the call. Matches Master roles where applicable
   * ('prescribe' / 'evaluate' / ...), otherwise a descriptive label
   * ('scenario_generator', 'feedback_drill', 'error_analysis').
   */
  role: string;
  /** Kind of call — used to bucket cost by modality in the dashboard. */
  operation: LlmOperation;
  /** Prompt tokens (provider-native if available, else client estimate). */
  tokensIn?: number;
  /** Completion tokens (provider-native if available, else client estimate). */
  tokensOut?: number;
  /** For duration-billed ops (Live, TTS). */
  secondsUsed?: number;
  /**
   * If provided, overrides the static price-table estimate. Pass through
   * when the provider returns a cost directly (OpenRouter on some models).
   */
  costUsdOverride?: number;
  latencyMs?: number;
}

export async function recordLlmUsage(record: LlmUsageRecord): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  const tokensIn = Math.max(0, Math.floor(record.tokensIn ?? 0));
  const tokensOut = Math.max(0, Math.floor(record.tokensOut ?? 0));
  const secondsUsed =
    typeof record.secondsUsed === 'number' && Number.isFinite(record.secondsUsed)
      ? Math.max(0, record.secondsUsed)
      : null;

  const costUsd =
    typeof record.costUsdOverride === 'number' && Number.isFinite(record.costUsdOverride)
      ? record.costUsdOverride
      : estimateCostUsd({
          provider: record.provider,
          model: record.model,
          operation: record.operation,
          tokensIn,
          tokensOut,
          secondsUsed: secondsUsed ?? 0,
        });

  const payload = {
    user_id: user.id,
    provider: record.provider,
    model: record.model,
    surface: record.surface,
    role: record.role,
    operation: record.operation,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    seconds_used: secondsUsed,
    cost_usd: costUsd ?? null,
    latency_ms:
      typeof record.latencyMs === 'number' && Number.isFinite(record.latencyMs)
        ? Math.max(0, Math.floor(record.latencyMs))
        : null,
  };

  try {
    const { error } = await supabase.from('llm_usage').insert(payload);
    if (error) {
      console.warn(`[llmTelemetry] insert failed: ${error.message}`);
    }
  } catch (err) {
    console.warn('[llmTelemetry] unexpected error', err);
  }
}

/**
 * Tokens-from-chars heuristic used when the ai-proxy does not return
 * provider-native token counts. OpenAI's rule-of-thumb is ~4 chars per
 * token for English; we use 3.5 as a slightly safer upper bound so cost
 * is not underestimated.
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}
