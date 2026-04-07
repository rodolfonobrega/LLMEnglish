import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type Provider = 'openai' | 'genai' | 'groq' | 'openrouter';

type ProviderKeys = Record<Provider, string | undefined>;

export function loadLocalEnvFiles() {
  loadEnvFile(resolve(repoRoot, '.env'));
  loadEnvFile(resolve(repoRoot, '.env.local'));
}

export function getProviderKeys(): ProviderKeys {
  return {
    openai: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    genai: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    groq: process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY,
    openrouter: process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
  };
}

export function getBaseUrl(source: Provider) {
  switch (source) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'genai':
      return 'https://generativelanguage.googleapis.com/v1beta';
  }
}

export function getAuthHeaders(source: Exclude<Provider, 'genai'>, title = 'SpeakLab Smoke Test') {
  const keys = getProviderKeys();
  const key = keys[source];

  if (!key) {
    return {};
  }

  if (source === 'openrouter') {
    return {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://speaklab.app',
      'X-Title': title,
    };
  }

  return { Authorization: `Bearer ${key}` };
}

export function getPaidSmokeEnabled() {
  return process.env.RUN_PAID_SMOKE_TESTS === 'true';
}

export function assertOk(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${response.statusText}`);
  }
}

export function makeSilentWavBuffer(seconds = 1, sampleRate = 16000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, 'utf8');

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');

    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
