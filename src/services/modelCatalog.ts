/**
 * Model Catalog - Deterministic source resolution for AI model IDs.
 *
 * Builds a Map<string, Set<Source>> from all 5 model arrays in settings.
 * Uses catalog-first lookup with heuristic fallback for unknown/custom models.
 */

import type { ModelOption, Source } from '../types/settings';
import {
  CHAT_MODELS,
  IMAGE_MODELS,
  LIVE_MODELS,
  STT_MODELS,
  TTS_MODELS,
} from '../types/settings';

// ---------------------------------------------------------------------------
// Catalog construction
// ---------------------------------------------------------------------------

const catalog = new Map<string, Set<Source>>();

function registerModels(models: readonly ModelOption[]): void {
  for (const { value, source } of models) {
    const existing = catalog.get(value);
    if (existing) {
      existing.add(source);
    } else {
      catalog.set(value, new Set([source]));
    }
  }
}

registerModels(CHAT_MODELS);
registerModels(STT_MODELS);
registerModels(TTS_MODELS);
registerModels(IMAGE_MODELS);
registerModels(LIVE_MODELS);

// ---------------------------------------------------------------------------
// Heuristic fallback (preserved from openai.ts detectSource)
// ---------------------------------------------------------------------------

function detectSource(modelId: string): Source {
  if (modelId.startsWith('gemini')) return 'genai';
  // OpenRouter models use owner/model format (e.g. "anthropic/claude-sonnet-4")
  // but Groq also uses slashes — exclude known Groq prefixes first.
  if (
    modelId.startsWith('llama-') ||
    modelId.startsWith('meta-llama/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('canopylabs/') ||
    modelId.startsWith('whisper-large-v3')
  ) {
    return 'groq';
  }
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check if a model ID is known for a specific source. */
export function isKnownModel(modelId: string, source: Source): boolean {
  return catalog.get(modelId)?.has(source) ?? false;
}

/** Get all sources registered for a model ID, or undefined if not in catalog. */
export function getSourcesForModel(modelId: string): Set<Source> | undefined {
  return catalog.get(modelId);
}

/**
 * Resolve the source for a model ID.
 * Catalog-first: if exactly 1 source, use it. If multiple, use heuristic tiebreaker.
 * Falls back to heuristic for models not in the catalog.
 */
export function resolveSource(modelId: string): Source {
  const sources = catalog.get(modelId);
  if (sources) {
    if (sources.size === 1) {
      const [source] = sources;
      return source;
    }
    // Multiple sources — use heuristic as tiebreaker
    return detectSource(modelId);
  }
  // Not in catalog — heuristic fallback
  return detectSource(modelId);
}
