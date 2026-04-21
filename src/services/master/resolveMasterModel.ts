/**
 * Master.resolveMasterModel — Phase 5 (F-P5-02).
 *
 * Central resolver for "which LLM model should this Master role use?".
 *
 * Resolution order:
 *   1. If the user configured `masterModels[role]` in Settings → use it.
 *   2. Otherwise inherit the main `chatModel` + `chatSource`.
 *   3. Fallback on failure is still `chatFallbackModel` +
 *      `chatFallbackSource` (unchanged — we don't override fallbacks
 *      per role; the goal of Phase 5 is cost control, not full
 *      duplication of the fallback chain per role).
 *
 * This helper reads from `runtimeConfigSnapshot` so it stays in sync
 * with the same snapshot the Master gate already uses, and never calls
 * React hooks (so it works from deep in the Master services).
 */

import { getModelConfig } from '../runtimeConfigSnapshot';
import type {
  MasterModelOverride,
  MasterModelOverrides,
  ModelConfig,
  Source,
} from '../../types/settings';

export interface ResolvedMasterModel {
  model: string;
  source: Source;
  /** Optional fallback (inherited from the main chat fallback). */
  fallbackModel?: string;
  fallbackSource?: Source;
  /** Where the resolution came from (diagnostic, useful in telemetry). */
  from: 'override' | 'inherit';
}

export type MasterModelRole = keyof MasterModelOverrides;

/**
 * Resolve the effective `(model, source)` pair for a given Master
 * role. Non-throwing. Falls back to the main chat model on any
 * malformed override so a corrupt profile never blocks the Master.
 */
export function resolveMasterModel(role: MasterModelRole): ResolvedMasterModel {
  const config = getModelConfig();
  return resolveMasterModelFrom(config, role);
}

/**
 * Pure variant for tests and deterministic callers. No global reads.
 */
export function resolveMasterModelFrom(
  config: ModelConfig,
  role: MasterModelRole,
): ResolvedMasterModel {
  const override = config.masterModels?.[role];
  if (override && isValidOverride(override)) {
    return {
      model: override.model,
      source: override.source,
      fallbackModel: config.chatFallbackModel,
      fallbackSource: config.chatFallbackSource,
      from: 'override',
    };
  }
  return {
    model: config.chatModel,
    source: config.chatSource,
    fallbackModel: config.chatFallbackModel,
    fallbackSource: config.chatFallbackSource,
    from: 'inherit',
  };
}

function isValidOverride(override: MasterModelOverride): boolean {
  return (
    typeof override.model === 'string' &&
    override.model.trim().length > 0 &&
    typeof override.source === 'string' &&
    override.source.trim().length > 0
  );
}
