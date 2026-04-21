/**
 * Static LLM price table — Phase 5 (cost estimation).
 *
 * Prices are best-effort public rack rates in USD, sampled 2026-04-21.
 * Only the models we actually use are listed; unknown models fall back
 * to a sane generic estimate per provider.
 *
 * Rates are PER 1K tokens (prompt or completion). For duration-billed
 * operations (TTS / Live) we add a `perSecondUsd` row that wins over
 * token pricing.
 *
 * Source of truth: update this file when a provider publishes new
 * prices. No server round-trip: the client can recompute historical
 * `cost_usd` by replaying `tokens_in` / `tokens_out` through this table.
 *
 * NOTE: this lives in `utils/` (not `services/`) because it's pure data
 * + a pure function. No Supabase / no network.
 */

import type { Source } from '../types/settings';

export type ModelOperation = 'chat' | 'stt' | 'tts' | 'image' | 'live' | 'embed';

interface PriceRow {
  /** USD per 1K input tokens. */
  perKTokensInUsd?: number;
  /** USD per 1K output tokens. */
  perKTokensOutUsd?: number;
  /** USD per second (TTS / Live). */
  perSecondUsd?: number;
  /** USD per image (image gen). */
  perImageUsd?: number;
}

/** key = `${provider}:${model}`, fully lowercased. */
const TABLE: Record<string, PriceRow> = {
  // -------- Gemini (genai + vertex share model ids for billing) --------
  'genai:gemini-2.5-flash':        { perKTokensInUsd: 0.000075, perKTokensOutUsd: 0.0003 },
  'genai:gemini-2.5-flash-lite':   { perKTokensInUsd: 0.00001875, perKTokensOutUsd: 0.000075 },
  'genai:gemini-2.5-pro':          { perKTokensInUsd: 0.00125,  perKTokensOutUsd: 0.0050 },
  'genai:gemini-2.5-flash-preview-tts': { perSecondUsd: 0.00016 },
  'genai:gemini-3.1-flash-image-preview': { perImageUsd: 0.04 },
  'genai:gemini-2.5-flash-native-audio-preview-12-2025': { perSecondUsd: 0.002 },
  'vertex:gemini-2.5-flash':        { perKTokensInUsd: 0.000075, perKTokensOutUsd: 0.0003 },
  'vertex:gemini-2.5-flash-lite':   { perKTokensInUsd: 0.00001875, perKTokensOutUsd: 0.000075 },
  'vertex:gemini-2.5-pro':          { perKTokensInUsd: 0.00125,  perKTokensOutUsd: 0.0050 },

  // -------- OpenAI --------
  'openai:gpt-4o-mini':   { perKTokensInUsd: 0.00015, perKTokensOutUsd: 0.0006 },
  'openai:gpt-4o':        { perKTokensInUsd: 0.0025,  perKTokensOutUsd: 0.01 },
  'openai:gpt-5-mini':    { perKTokensInUsd: 0.0003,  perKTokensOutUsd: 0.0012 },
  'openai:gpt-5':         { perKTokensInUsd: 0.005,   perKTokensOutUsd: 0.02 },
  'openai:whisper-1':     { perSecondUsd: 0.0001 },
  'openai:tts-1':         { perKTokensInUsd: 0.015 },
  'openai:gpt-image-1':   { perImageUsd: 0.04 },

  // -------- Groq (very cheap, changes frequently) --------
  'groq:llama-3.3-70b-versatile': { perKTokensInUsd: 0.00059, perKTokensOutUsd: 0.00079 },
  'groq:llama-3.1-8b-instant':    { perKTokensInUsd: 0.00005, perKTokensOutUsd: 0.00008 },

  // -------- OpenRouter (routed: we bill average of common models) --------
  // When we don't know the underlying model, we estimate using a mid-tier row.
  'openrouter:openai/gpt-4o-mini':  { perKTokensInUsd: 0.00015, perKTokensOutUsd: 0.0006 },
  'openrouter:anthropic/claude-sonnet-4.5': { perKTokensInUsd: 0.003, perKTokensOutUsd: 0.015 },
};

/** Fallback prices per provider when the exact model id is unknown. */
const PROVIDER_FALLBACK: Partial<Record<Source, PriceRow>> = {
  genai:      { perKTokensInUsd: 0.000075, perKTokensOutUsd: 0.0003 },
  vertex:     { perKTokensInUsd: 0.000075, perKTokensOutUsd: 0.0003 },
  openai:     { perKTokensInUsd: 0.00015,  perKTokensOutUsd: 0.0006 },
  groq:       { perKTokensInUsd: 0.00059,  perKTokensOutUsd: 0.00079 },
  openrouter: { perKTokensInUsd: 0.001,    perKTokensOutUsd: 0.005 },
};

function lookupPriceRow(provider: Source, model: string): PriceRow {
  const key = `${provider}:${model}`.toLowerCase();
  if (TABLE[key]) return TABLE[key];
  return PROVIDER_FALLBACK[provider] ?? {};
}

export interface EstimateCostInput {
  provider: Source;
  model: string;
  operation: ModelOperation;
  tokensIn?: number;
  tokensOut?: number;
  secondsUsed?: number;
}

/**
 * Estimate USD cost for a single LLM call. Returns `undefined` when no
 * pricing information is available at all (caller stores NULL).
 */
export function estimateCostUsd(input: EstimateCostInput): number | undefined {
  const price = lookupPriceRow(input.provider, input.model);

  if (input.operation === 'image') {
    return price.perImageUsd;
  }

  if (input.operation === 'tts' || input.operation === 'live') {
    if (typeof price.perSecondUsd === 'number' && typeof input.secondsUsed === 'number') {
      return price.perSecondUsd * input.secondsUsed;
    }
  }

  let cost = 0;
  let touched = false;
  if (typeof price.perKTokensInUsd === 'number' && typeof input.tokensIn === 'number') {
    cost += (input.tokensIn / 1000) * price.perKTokensInUsd;
    touched = true;
  }
  if (typeof price.perKTokensOutUsd === 'number' && typeof input.tokensOut === 'number') {
    cost += (input.tokensOut / 1000) * price.perKTokensOutUsd;
    touched = true;
  }
  return touched ? cost : undefined;
}
