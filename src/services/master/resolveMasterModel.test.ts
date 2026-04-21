import { describe, expect, it } from 'vitest';

import { resolveMasterModelFrom } from './resolveMasterModel';
import { DEFAULT_MODEL_CONFIG } from '../../types/settings';
import type { ModelConfig } from '../../types/settings';

describe('Master.resolveMasterModel', () => {
  it('inherits the main chat model when no override exists', () => {
    const config: ModelConfig = { ...DEFAULT_MODEL_CONFIG };
    const r = resolveMasterModelFrom(config, 'prescribe');
    expect(r.from).toBe('inherit');
    expect(r.model).toBe(config.chatModel);
    expect(r.source).toBe(config.chatSource);
  });

  it('uses the role-specific override when set', () => {
    const config: ModelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      masterModels: {
        prescribe: { model: 'gpt-5.4-mini', source: 'openrouter' },
      },
    };
    const r = resolveMasterModelFrom(config, 'prescribe');
    expect(r.from).toBe('override');
    expect(r.model).toBe('gpt-5.4-mini');
    expect(r.source).toBe('openrouter');
  });

  it('falls back to the main chat model when the override is malformed', () => {
    const config: ModelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      masterModels: {
        // empty string model is invalid.
        evaluate: { model: '   ', source: 'genai' },
      },
    };
    const r = resolveMasterModelFrom(config, 'evaluate');
    expect(r.from).toBe('inherit');
    expect(r.model).toBe(config.chatModel);
  });

  it('inherits the main fallback pair regardless of override state', () => {
    const config: ModelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      chatFallbackModel: 'claude-sonnet-4',
      chatFallbackSource: 'openrouter',
      masterModels: {
        evaluate: { model: 'gpt-5.4-mini', source: 'openrouter' },
      },
    };
    const over = resolveMasterModelFrom(config, 'evaluate');
    const inherit = resolveMasterModelFrom(config, 'update_model');
    expect(over.fallbackModel).toBe('claude-sonnet-4');
    expect(over.fallbackSource).toBe('openrouter');
    expect(inherit.fallbackModel).toBe('claude-sonnet-4');
    expect(inherit.fallbackSource).toBe('openrouter');
  });
});
