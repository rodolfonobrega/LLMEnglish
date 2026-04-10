import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

// Stub env vars used by module-level code
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

import { generateImage } from './aiProxy';

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function extractRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls[0];
  return JSON.parse(call[1].body as string);
}

describe('aiProxy generateImage option forwarding', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSessionMock.mockResolvedValue({
      data: {
        session: { access_token: 'test-token' },
      },
    });
    fetchSpy = mockFetchResponse({ imageUrl: 'https://img.test/result.png' });
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('forwards all OpenAI options to callAIProxy', async () => {
    await generateImage({
      prompt: 'a cat',
      model: 'gpt-image-1',
      source: 'openai',
      size: '1024x1024',
      quality: 'high',
      format: 'png',
      compression: 50,
      background: 'transparent',
      moderation: 'low',
    });

    const body = extractRequestBody(fetchSpy);

    expect(body.action).toBe('image');
    expect(body.prompt).toBe('a cat');
    expect(body.model).toBe('gpt-image-1');
    expect(body.source).toBe('openai');
    expect(body.size).toBe('1024x1024');
    expect(body.quality).toBe('high');
    expect(body.format).toBe('png');
    expect(body.compression).toBe(50);
    expect(body.background).toBe('transparent');
    expect(body.moderation).toBe('low');
  });

  it('forwards all Imagen options to callAIProxy', async () => {
    await generateImage({
      prompt: 'a dog',
      model: 'imagen-4.0-generate-001',
      source: 'genai',
      aspectRatio: '16:9',
      imageSize: '2K',
      personGeneration: 'allow_all',
      numberOfImages: 3,
    });

    const body = extractRequestBody(fetchSpy);

    expect(body.action).toBe('image');
    expect(body.prompt).toBe('a dog');
    expect(body.model).toBe('imagen-4.0-generate-001');
    expect(body.source).toBe('genai');
    expect(body.aspectRatio).toBe('16:9');
    expect(body.imageSize).toBe('2K');
    expect(body.personGeneration).toBe('allow_all');
    expect(body.numberOfImages).toBe(3);
  });

  it('works with minimal options (prompt, model, source only)', async () => {
    await generateImage({
      prompt: 'a sunset',
      model: 'gpt-image-1',
      source: 'openai',
    });

    const body = extractRequestBody(fetchSpy);

    expect(body.action).toBe('image');
    expect(body.prompt).toBe('a sunset');
    expect(body.model).toBe('gpt-image-1');
    expect(body.source).toBe('openai');
    // Optional fields should be undefined
    expect(body.quality).toBeUndefined();
    expect(body.format).toBeUndefined();
    expect(body.compression).toBeUndefined();
    expect(body.background).toBeUndefined();
    expect(body.moderation).toBeUndefined();
    expect(body.aspectRatio).toBeUndefined();
    expect(body.imageSize).toBeUndefined();
    expect(body.personGeneration).toBeUndefined();
    expect(body.numberOfImages).toBeUndefined();
  });

  it('returns imageUrl when edge function returns imageUrl', async () => {
    fetchSpy = mockFetchResponse({ imageUrl: 'https://img.test/cat.png' });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await generateImage({
      prompt: 'a cat',
      model: 'gpt-image-1',
      source: 'openai',
    });

    expect(result).toBe('https://img.test/cat.png');
  });

  it('returns imageData when edge function returns imageData', async () => {
    fetchSpy = mockFetchResponse({ imageData: 'data:image/png;base64,abc123' });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await generateImage({
      prompt: 'a dog',
      model: 'imagen-4.0-generate-001',
      source: 'genai',
    });

    expect(result).toBe('data:image/png;base64,abc123');
  });
});
