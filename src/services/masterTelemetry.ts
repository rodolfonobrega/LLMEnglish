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
import { masterEnabled } from './runtimeConfigSnapshot';

export type MasterRole =
  | 'prescribe'
  | 'evaluate'
  | 'update_model'
  | 'compose_lesson'
  | 'render_moment';

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
}
