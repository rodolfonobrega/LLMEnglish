/**
 * Master telemetry — append-only usage log for the Master pedagogical agent.
 *
 * Every LLM call the Master makes (prescribe / evaluate / update_model /
 * compose_lesson / render_moment) records a row in `master_usage`. Rows are
 * per-user and RLS-protected. The helper is non-blocking: persistence
 * failures are swallowed and surfaced via `console.warn` so a telemetry
 * outage never breaks a student-facing flow.
 *
 * Wave 3 introduces the helper + schema. Waves 5 and 6 are the actual
 * callers that consume it.
 */

import { supabase } from './supabase/client';
import { getCurrentUser } from './supabase/auth';
import { masterEnabled, getModelConfig } from './runtimeConfigSnapshot';
import { recordLlmUsage, estimateTokensFromText } from './llmTelemetry';
import type { Source } from '../types/settings';

export type MasterRole =
  | 'prescribe'
  | 'evaluate'
  | 'update_model'
  | 'compose_lesson'
  | 'render_moment'
  /**
   * Phase 2 — post-conversation Live evaluation. Requires extending the
   * `master_usage.role` CHECK constraint (migration tracked in
   * `docs/pending-ops-todos.md`). Until the migration lands, inserts with
   * role `live_meta` will be rejected by the DB; the catch block below
   * swallows the error with a warning — no user-facing breakage.
   */
  | 'live_meta'
  /**
   * Phase 3 — end-of-session reflection. Same provenance story as
   * `live_meta`: migration pending.
   */
  | 'summarize_session'
  /**
   * Phase 9 — card variation. Same provenance story as `live_meta` and
   * `summarize_session`: until the DB CHECK constraint is extended
   * (tracked in `docs/pending-ops-todos.md`), inserts with role
   * `vary_card` get swallowed with a warning, never breaking the UX.
   */
  | 'vary_card';

export interface MasterUsageRecord {
  role: MasterRole;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  latencyMs?: number;
}

export async function recordMasterUsage(record: MasterUsageRecord): Promise<void> {
  if (!masterEnabled()) return;
  const user = getCurrentUser();
  if (!user) return;

  const payload = {
    user_id: user.id,
    role: record.role,
    tokens_in: Math.max(0, Math.floor(record.tokensIn ?? 0)),
    tokens_out: Math.max(0, Math.floor(record.tokensOut ?? 0)),
    model: record.model ?? null,
    latency_ms:
      typeof record.latencyMs === 'number' && Number.isFinite(record.latencyMs)
        ? Math.max(0, Math.floor(record.latencyMs))
        : null,
  };

  try {
    const { error } = await supabase.from('master_usage').insert(payload);
    if (error) {
      console.warn(`[masterTelemetry] insert failed: ${error.message}`);
    }
  } catch (err) {
    console.warn('[masterTelemetry] unexpected error', err);
  }

  // Phase 5 — mirror the Master call into the unified `llm_usage` table
  // so the cost dashboard can query Master calls alongside every other
  // LLM call in the app. Non-blocking; a failure here is swallowed by
  // `recordLlmUsage` itself (console.warn only).
  try {
    const config = getModelConfig();
    const model = record.model ?? config.chatModel;
    const source: Source = inferSourceFromModel(model, config.chatSource);
    await recordLlmUsage({
      provider: source,
      model,
      surface: 'master',
      role: record.role,
      operation: 'chat',
      tokensIn: record.tokensIn,
      tokensOut: record.tokensOut,
      latencyMs: record.latencyMs,
    });
  } catch (err) {
    console.warn('[masterTelemetry] llm_usage mirror failed', err);
  }
}

/**
 * Lightweight mirror of `src/services/openai.ts#detectSource` — kept
 * inline so masterTelemetry doesn't have to import openai.ts and pull
 * the audio cache / proxy dependencies into every caller.
 */
function inferSourceFromModel(modelId: string, fallback: Source): Source {
  if (!modelId) return fallback;
  if (modelId.startsWith('gemini')) return 'genai';
  if (
    modelId.startsWith('llama-') ||
    modelId.startsWith('meta-llama/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('canopylabs/') ||
    modelId.startsWith('whisper-large-v3') ||
    modelId.startsWith('openai/gpt-oss')
  ) {
    return 'groq';
  }
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}

/** Re-exported for tests / cost-dashboard queries. */
export { estimateTokensFromText };
