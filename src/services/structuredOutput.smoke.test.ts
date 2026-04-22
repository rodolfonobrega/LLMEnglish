// @vitest-environment node

/**
 * Structured output smoke tests — tests EVERY real schema in the app
 * against every provider/model combination the user can select.
 *
 * Uses `strict: false` (matching the ai-proxy) so schemas with optional
 * fields (like prescribe's `secondary_skill`) are accepted.
 * For Gemini, `additionalProperties` is stripped before sending.
 *
 * Run:
 *   RUN_PAID_SMOKE_TESTS=true npx vitest run --config vitest.smoke.config.ts \
 *     src/services/structuredOutput.smoke.test.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  assertOk,
  getAuthHeaders,
  getBaseUrl,
  getProviderKeys,
  loadLocalEnvFiles,
} from '../test/smoke/smokeTestUtils';

loadLocalEnvFiles();

// ---------------------------------------------------------------------------
// Load real schemas (extracted from source via tsx)
// ---------------------------------------------------------------------------

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const realSchemasRaw = JSON.parse(
  readFileSync(resolve(__dirname, '../test/smoke/realSchemas.json'), 'utf-8'),
) as Record<string, Record<string, unknown>>;

// Master schemas (module-scoped, can't import easily — defined inline)
const briefingSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    target_skill: { type: 'string' },
    secondary_skill: { type: 'string' },
    modality_choice: { type: 'string', enum: ['phrase','text','roleplay','visual','cloze','spotting','reaction','shadowing','reformulation','narrative','listening','live'] },
    disguise_theme: { type: 'string' },
    required_elements: { type: 'array', items: { type: 'string' } },
    forbidden_elements: { type: 'array', items: { type: 'string' } },
    success_criteria: { type: 'string' },
    expected_difficulty: { type: 'string', enum: ['easy','slight_stretch','challenge'] },
    rationale: { type: 'string' },
    session_size: { type: 'string', enum: ['standard','mini'] },
    blend_rationale: { type: 'string' },
  },
  required: ['target_skill','modality_choice','disguise_theme','required_elements','forbidden_elements','success_criteria','expected_difficulty'],
  additionalProperties: false,
};

const metaSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    goal_met: { type: 'boolean' },
    reason: { type: 'string' },
    unexpected_errors: { type: 'array', items: { type: 'string' } },
    engagement_signal: { type: 'string', enum: ['high','medium','low','frustrated'] },
    relevant_correction_ids: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string', enum: ['advance','consolidate','step_back','probe_breadth'] },
  },
  required: ['goal_met','unexpected_errors','engagement_signal','relevant_correction_ids','recommendation'],
  additionalProperties: false,
};

const updateModelSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    patches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string' },
          patch: { type: 'object', properties: { last_session_engagement: { type: 'string' }, themes_that_land: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
          id: { type: 'string' },
          level: { type: 'string' },
          confidence: { type: 'number' },
          target: { type: 'string' },
          success_rate: { type: 'number' },
          plan: { type: 'object', properties: { primary_goal: { type: 'string' }, expected_difficulty: { type: 'string' }, rationale: { type: 'string' }, consolidation_until: { type: 'string' }, avoid_for_now: { type: 'array', items: { type: 'string' } }, secondary_goal: { type: 'string' } }, additionalProperties: false },
          value: { type: 'boolean' },
        },
        required: ['op'],
        additionalProperties: false,
      },
    },
    reason: { type: 'string' },
  },
  required: ['patches','reason'],
  additionalProperties: false,
};

const ALL_SCHEMAS: Record<string, Record<string, unknown>> = {
  ...realSchemasRaw,
  'master/prescribe': briefingSchema,
  'master/evaluate': metaSchema,
  'master/updateModel': updateModelSchema,
};

// ---------------------------------------------------------------------------
// Models — one cheap model per provider
// ---------------------------------------------------------------------------

type Source = 'openai' | 'genai' | 'groq';

const PROVIDERS: Record<string, { source: Source; model: string }> = {
  'GPT-4o-mini': { source: 'openai', model: 'gpt-4o-mini' },
  'Gemini 2.5 Flash Lite': { source: 'genai', model: 'gemini-2.5-flash-lite' },
  'Llama-4-scout (Groq)': { source: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
};

// ---------------------------------------------------------------------------
// Request builders (matching ai-proxy behavior)
// ---------------------------------------------------------------------------

const SYS = 'You are a test assistant. Output ONLY valid JSON matching the schema. No prose.';
const USR = 'Generate a minimal but valid JSON response with plausible values. Keep it short.';

function buildOpenAICompatBody(model: string, schema: Record<string, unknown>) {
  return {
    model,
    messages: [{ role: 'system', content: SYS }, { role: 'user', content: USR }],
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'test', strict: false, schema },
    },
  };
}

function buildGeminiBody(model: string, schema: Record<string, unknown>) {
  return {
    system_instruction: { parts: [{ text: SYS }] },
    contents: [{ role: 'user', parts: [{ text: USR }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: stripForGemini(schema),
    },
  };
}

// ---------------------------------------------------------------------------
// Schema transform
// ---------------------------------------------------------------------------

function stripForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripForGemini(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripForGemini(item as Record<string, unknown>)
          : item,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const keys = getProviderKeys();

function parseJSON(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}

function extractContent(source: Source, data: unknown): string {
  if (source === 'genai') {
    const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  const d = data as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content ?? '';
}

async function doFetch(source: Source, model: string, body: Record<string, unknown>): Promise<Response> {
  if (source === 'genai') {
    const key = keys.genai!;
    return fetch(
      `${getBaseUrl('genai')}/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  }
  return fetch(`${getBaseUrl(source)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(source) },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests: every schema × every provider
// ---------------------------------------------------------------------------

describe('Real schemas vs providers (strict: false)', () => {
  for (const [schemaName, schema] of Object.entries(ALL_SCHEMAS)) {
    describe(schemaName, () => {
      for (const [providerLabel, spec] of Object.entries(PROVIDERS)) {
        const hasKey = !!keys[spec.source];
        const runIt = hasKey ? it : it.skip;

        runIt(`${providerLabel}: accepts & returns valid JSON`, async () => {
          const body = spec.source === 'genai'
            ? buildGeminiBody(spec.model, schema)
            : buildOpenAICompatBody(spec.model, schema);

          const resp = await doFetch(spec.source, spec.model, body);
          assertOk(resp, `${schemaName} @ ${providerLabel}`);
          const data = await resp.json();
          const content = extractContent(spec.source, data);
          expect(content, `${providerLabel} returned empty`).toBeTruthy();

          const parsed = parseJSON(content);
          expect(parsed, `${providerLabel} invalid JSON: ${content.slice(0, 120)}`).not.toBeNull();
        }, 60_000);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Negative: Gemini rejects additionalProperties when NOT stripped
// ---------------------------------------------------------------------------

describe('Gemini additionalProperties rejection', () => {
  const geminiIt = keys.genai ? it : it.skip;

  geminiIt('rejects schema WITH additionalProperties', async () => {
    const key = keys.genai!;
    const body = {
      system_instruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts: [{ text: USR }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: briefingSchema, // has additionalProperties: false
      },
    };

    const resp = await fetch(
      `${getBaseUrl('genai')}/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );

    expect(resp.status).toBe(400);
    const errorText = await resp.text();
    expect(errorText).toContain('additionalProperties');
  }, 30_000);
});
