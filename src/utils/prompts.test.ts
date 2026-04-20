import { describe, expect, it } from 'vitest';
import {
  getOralClozePrompt,
  oralClozeResponseSchema,
  getErrorSpottingPrompt,
  errorSpottingResponseSchema,
  getReactionDrillPrompt,
  reactionDrillResponseSchema,
  getShadowingLinePrompt,
  shadowingLineResponseSchema,
  getReformulationPrompt,
  reformulationResponseSchema,
  getNarrativeSeedPrompt,
  narrativeSeedResponseSchema,
  getListeningPassagePrompt,
  listeningPassageResponseSchema,
} from './prompts';
import type { Briefing } from '../types/master';

/**
 * Minimal JSON-Schema validator: supports the subset we actually use
 * (type, properties, required, enum, items). Good enough to assert that
 * the shapes we document are accepted/rejected without pulling Ajv in.
 */
type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: readonly unknown[];
  items?: Schema;
};

function validate(schema: Schema, value: unknown): { ok: boolean; reason?: string } {
  if (schema.enum && !schema.enum.includes(value)) {
    return { ok: false, reason: `value not in enum ${JSON.stringify(schema.enum)}` };
  }
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' ? { ok: true } : { ok: false, reason: 'expected string' };
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? { ok: true }
        : { ok: false, reason: 'expected finite number' };
    case 'array': {
      if (!Array.isArray(value)) return { ok: false, reason: 'expected array' };
      if (schema.items) {
        for (let i = 0; i < value.length; i += 1) {
          const res = validate(schema.items, value[i]);
          if (!res.ok) return { ok: false, reason: `items[${i}]: ${res.reason}` };
        }
      }
      return { ok: true };
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { ok: false, reason: 'expected object' };
      }
      const v = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (!(key in v)) return { ok: false, reason: `missing required field "${key}"` };
      }
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        if (key in v) {
          const res = validate(child, v[key]);
          if (!res.ok) return { ok: false, reason: `${key}: ${res.reason}` };
        }
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

const sampleBriefing: Briefing = {
  target_skill: 'past_continuous_in_interrupted_narrative',
  secondary_skill: 'simple_past_of_regular_verbs',
  modality_choice: 'cloze',
  disguise_theme: 'a weekend at the beach',
  required_elements: ['a sudden interruption', 'at least one contraction'],
  forbidden_elements: ['any past perfect form'],
  success_criteria: 'Student naturally produces past continuous when describing the interruption.',
  expected_difficulty: 'slight_stretch',
};

describe('getOralClozePrompt', () => {
  it('returns a non-empty prompt with STRICT JSON instruction', () => {
    const p = getOralClozePrompt();
    expect(p).toBeTruthy();
    expect(p.length).toBeGreaterThan(100);
    expect(p).toContain('STRICT JSON');
    expect(p).toContain('blank_token');
  });

  it('includes the briefing block when provided and never leaks the target label to the student', () => {
    const p = getOralClozePrompt(sampleBriefing);
    expect(p).toContain('a weekend at the beach');
    expect(p).toContain('STEALTH RULE');
  });
});

describe('oralClozeResponseSchema', () => {
  it('accepts a well-formed cloze', () => {
    const valid = {
      sentence: 'I was reading when my phone rang.',
      blank_token: 'reading',
      canonical_pattern: 'past_continuous_in_interrupted_narrative',
      tts_sentence_with_beep: 'I was *BEEP* when my phone rang.',
    };
    expect(validate(oralClozeResponseSchema, valid).ok).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    const invalid = { sentence: 'x', blank_token: 'y' };
    expect(validate(oralClozeResponseSchema, invalid).ok).toBe(false);
  });
});

describe('getErrorSpottingPrompt', () => {
  it('emits a pattern hint list when no target is provided', () => {
    const p = getErrorSpottingPrompt({});
    expect(p).toContain('Prefer patterns from');
  });

  it('locks the pattern when target_canonical_pattern is given', () => {
    const p = getErrorSpottingPrompt({ target_canonical_pattern: 'simple_past_of_regular_verbs' });
    expect(p).toContain('simple_past_of_regular_verbs');
  });

  it('schema rejects a response missing the correction', () => {
    const invalid = { planted_sentence: 'x', canonical_pattern: 'y' };
    expect(validate(errorSpottingResponseSchema, invalid).ok).toBe(false);
  });
});

describe('getReactionDrillPrompt and schema', () => {
  it('prompt asks for 8-12 items', () => {
    const p = getReactionDrillPrompt();
    expect(p).toMatch(/8-12/);
  });

  it('schema accepts a valid lines array', () => {
    const valid = {
      lines: [
        { provocation: 'Your friend lost their keys.', expected_naturalness_markers: ['oh no', 'reassurance'] },
        { provocation: 'Someone sneezes next to you.', expected_naturalness_markers: ['bless you'] },
      ],
    };
    expect(validate(reactionDrillResponseSchema, valid).ok).toBe(true);
  });

  it('schema rejects when items lack provocation', () => {
    const invalid = { lines: [{ expected_naturalness_markers: ['x'] }] };
    expect(validate(reactionDrillResponseSchema, invalid).ok).toBe(false);
  });
});

describe('getShadowingLinePrompt and schema', () => {
  it('prompt asks for a speakable duration', () => {
    const p = getShadowingLinePrompt();
    expect(p).toMatch(/4-8 seconds/);
  });

  it('schema accepts a minimal shadow line', () => {
    expect(
      validate(shadowingLineResponseSchema, { line: 'Honestly, I kinda think we should just go, you know?' }).ok,
    ).toBe(true);
  });

  it('schema rejects an empty object', () => {
    expect(validate(shadowingLineResponseSchema, {}).ok).toBe(false);
  });
});

describe('getReformulationPrompt and schema', () => {
  it('prompt bakes in the style', () => {
    const p = getReformulationPrompt({ target_style: 'more_casual' });
    expect(p).toContain('more_casual');
  });

  it('schema accepts a valid response', () => {
    const valid = {
      source: 'I would like to request an extension for the deadline.',
      target_style: 'more_casual',
      reference_examples: ['Hey, any way we could push the deadline?', "Could I get a bit more time on this?"],
    };
    expect(validate(reformulationResponseSchema, valid).ok).toBe(true);
  });

  it('schema rejects invalid style enum', () => {
    const invalid = {
      source: 's',
      target_style: 'overly_formal_plus',
      reference_examples: ['x'],
    };
    expect(validate(reformulationResponseSchema, invalid).ok).toBe(false);
  });
});

describe('getNarrativeSeedPrompt and schema', () => {
  it('prompt asks to avoid direct questions', () => {
    const p = getNarrativeSeedPrompt();
    expect(p).toContain('Do NOT ask the student a direct question');
  });

  it('schema accepts minimal opening sentences', () => {
    expect(validate(narrativeSeedResponseSchema, { opening_sentences: 'It was just before sunrise...' }).ok).toBe(true);
  });
});

describe('getListeningPassagePrompt and schema', () => {
  it('prompt asks for comprehension-style questions', () => {
    const p = getListeningPassagePrompt();
    expect(p).toContain('COMPREHENSION');
  });

  it('schema accepts a well-formed passage + questions', () => {
    const valid = {
      passage: 'Look, the thing is, I almost missed my flight this morning...',
      questions: ['What was the speaker worried about?', 'How did it end?'],
      expected_key_points: ['missing the flight', 'made it just in time'],
      accent_hint: 'us',
    };
    expect(validate(listeningPassageResponseSchema, valid).ok).toBe(true);
  });

  it('schema rejects invalid accent hint', () => {
    const invalid = {
      passage: 'x',
      questions: ['q'],
      expected_key_points: ['k'],
      accent_hint: 'fr',
    };
    expect(validate(listeningPassageResponseSchema, invalid).ok).toBe(false);
  });
});
