# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- Vitest 4 (`vitest@^4.0.18`)
- Config: `vite.config.ts` (embedded `test` block, no separate vitest.config)

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`, `beforeEach`, `vi`)
- No separate assertion library (no jest-dom, no chai)

**Environment:**
- `jsdom` (`jsdom@^28.1.0`)
- Configured via `test.environment: 'jsdom'` in `vite.config.ts`

**Globals:**
- `test.globals: true` -- `describe`, `it`, `expect`, `vi` available globally without import
- Tests still explicitly import from `vitest` for clarity

**Run Commands:**
```bash
npm test                 # vitest run (single run)
npm run test:watch       # vitest (watch mode)
npm run test:coverage    # vitest run --coverage
npm run test:models:mock # vitest run src/services (service tests only)
npm run test:models:smoke # node scripts/smoke-models.mjs
```

## Test File Organization

**Location:**
- Tests are co-located with source files in the same directory
- No separate `__tests__` or `test/` directories for unit tests

**Naming:**
- Pattern: `[sourceFile].test.ts`
- Examples:
  - `src/services/openai.ts` -> `src/services/openai.test.ts`
  - `src/config/modes.ts` -> `src/config/modes.test.ts`
  - `src/config/navigation.ts` -> `src/config/navigation.test.ts`
  - `src/config/practice.ts` -> `src/config/practice.test.ts`
  - `src/services/geminiLive.ts` -> `src/services/geminiLive.test.ts`
  - `src/services/openaiRealtimeLive.ts` -> `src/services/openaiRealtimeLive.test.ts`

**Test Setup:**
- Global setup file: `src/test/setup.ts`
- Registered in `vite.config.ts` as `setupFiles: './src/test/setup.ts'`

**Structure:**
```
src/
├── test/
│   └── setup.ts              # Global test setup
├── config/
│   ├── modes.ts
│   ├── modes.test.ts         # Config validation tests
│   ├── navigation.ts
│   ├── navigation.test.ts
│   ├── practice.ts
│   └── practice.test.ts
├── services/
│   ├── openai.ts
│   ├── openai.test.ts        # Service dispatch tests
│   ├── geminiLive.ts
│   ├── geminiLive.test.ts    # Live session tests
│   ├── openaiRealtimeLive.ts
│   └── openaiRealtimeLive.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks at top level using vi.hoisted()
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn(),
}));

// Module mocking with vi.mock()
vi.mock('./storage', () => ({
  getModelConfig: mockFn,
}));

// Import SUT after mocks
import { functionUnderTest } from './module';

// Helper functions for test data
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('module under test', () => {
  beforeEach(() => {
    // Reset mocks and set up default state
  });

  it('does something specific', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

**Patterns:**
- `vi.hoisted()` for defining mock functions before `vi.mock()` calls
- `vi.mock()` for module-level mocking
- `vi.fn()` for function mocks
- `vi.mocked()` for typed mock access: `vi.mocked(fetch).mockResolvedValueOnce(...)`
- `beforeEach` for resetting state between tests
- Helper functions for creating test fixtures (e.g., `jsonResponse`, `FakeAudioContext`)

## Test Coverage

**Requirements:**
- Coverage thresholds configured in `vite.config.ts`:
  - Statements: 35%
  - Branches: 25%
  - Functions: 30%
  - Lines: 40%
- These are low thresholds -- initial coverage setup, not strict enforcement

**Coverage Scope:**
- Coverage only configured for specific service files:
  - `src/services/openai.ts`
  - `src/services/geminiLive.ts`
  - `src/services/openaiRealtimeLive.ts`
- No coverage for components, hooks, config, or other modules

**View Coverage:**
```bash
npm run test:coverage     # Generates text + HTML report
# HTML report in coverage/ directory
```

## Test Types

**Unit Tests:**
- Config validation tests (`src/config/*.test.ts`): Verify data shape, ordering, required fields
- Service dispatch tests (`src/services/*.test.ts`): Verify provider routing, fallback behavior, caching

**Integration Tests:**
- None explicitly. Service tests mock external APIs but test internal integration between dispatch, storage, and provider logic.

**E2E Tests:**
- Not used. No Playwright, Cypress, or similar framework detected.

**Component Tests:**
- Not used. No React Testing Library or similar setup detected. No `.tsx` test files exist.

**Snapshot Tests:**
- Not used.

## Mocking

**Framework:** Vitest built-in (`vi`)

**Module Mocking Pattern:**
```typescript
// 1. Define mocks with vi.hoisted() (allows use in vi.mock factory)
const { getOpenAIKeyMock, getModelConfigMock } = vi.hoisted(() => ({
  getOpenAIKeyMock: vi.fn(),
  getModelConfigMock: vi.fn(),
}));

// 2. Mock the module with factory function
vi.mock('./storage', () => ({
  getOpenAIKey: getOpenAIKeyMock,
  getModelConfig: getModelConfigMock,
}));

// 3. Mock third-party SDKs
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
  Modality: { AUDIO: 'AUDIO' },
}));

// 4. Import SUT AFTER all mocks
import { chatCompletion } from './openai';
```

**Global Mocking (in beforeEach):**
```typescript
beforeEach(() => {
  // Mock fetch globally
  (globalThis.fetch as unknown) = vi.fn();

  // Mock browser APIs
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

  // Mock navigator.mediaDevices
  Object.defineProperty(globalThis, 'navigator', {
    value: { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mediaStream) } },
    writable: true,
    configurable: true,
  });
});
```

**Fake Class Pattern:**
For complex browser APIs (WebSocket, AudioContext), create fake classes:
```typescript
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
  createScriptProcessor() { return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null }; }
  createBuffer(_channels: number, frameCount: number, sampleRate: number) { /* ... */ }
  close() { return Promise.resolve(); }
}
```

**What to Mock:**
- Storage layer (`./storage`) -- always mock, never hit localStorage in tests
- Third-party SDKs (`@google/genai`) -- mock with lightweight class stubs
- Browser APIs (`fetch`, `AudioContext`, `WebSocket`, `navigator.mediaDevices`)
- Use `vi.hoisted()` for all mock functions that need to be referenced in `vi.mock()` factories

**What NOT to Mock:**
- The module under test itself
- Internal helper functions within the same file

## Fixtures and Factories

**Test Data:**
- No separate fixture files or factory libraries
- Fixtures created inline in test files
- Helper functions for common test data:
  - `jsonResponse(body, status)` -- creates mock fetch Response
  - `textResponse(text, status)` -- creates mock error Response
  - `DEFAULT_MODEL_CONFIG` from production code reused in tests
  - `FakeAudioContext` / `FakeWebSocket` -- browser API stubs

**Pattern:**
```typescript
// Reuse production defaults, override as needed
beforeEach(() => {
  config = { ...DEFAULT_MODEL_CONFIG };
  getModelConfigMock.mockImplementation(() => config);
  getOpenAIKeyMock.mockReturnValue('sk-test-openai');
});
```

**Location:**
- Test helpers defined within test files (not shared)
- No shared test utilities directory

## Global Test Setup

**File:** `src/test/setup.ts`
```typescript
import { Buffer } from 'node:buffer';
import { afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Polyfill atob/btoa for jsdom
  if (!globalThis.atob) {
    globalThis.atob = (data: string) => Buffer.from(data, 'base64').toString('binary');
  }
  if (!globalThis.btoa) {
    globalThis.btoa = (data: string) => Buffer.from(data, 'binary').toString('base64');
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
```

**Key behaviors:**
- Polyfills `atob`/`btoa` using Node's `Buffer` (jsdom lacks these)
- Automatically restores and clears all mocks after each test

## CI Testing

**CI Pipeline:**
- Not detected. No `.github/workflows/` or similar CI configuration found.

**Pre-commit Hooks:**
- Not detected. No `husky`, `lint-staged`, or similar tooling configured.

**Manual CI:**
- Tests must be run manually via `npm test`
- Lint must be run manually via `npm run lint`

## Common Patterns

**Async Testing:**
```typescript
it('uses primary chat provider successfully', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse({ choices: [{ message: { content: 'ok from openai' } }] })
  );

  const result = await chatCompletion('sys', 'hi');

  expect(result).toBe('ok from openai');
  expect(fetch).toHaveBeenCalledTimes(1);
});
```

**Error Testing:**
```typescript
it('throws fast when OpenAI key is missing', async () => {
  getOpenAIKeyMock.mockReturnValue('');

  await expect(chatCompletion('sys', 'hi')).rejects.toThrow('OpenAI API key not configured');
  expect(fetch).not.toHaveBeenCalled();
});
```

**Fallback Testing:**
```typescript
it('falls back on chat when primary fails', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(textResponse('boom', 500))          // primary fails
    .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'fallback ok' } }] }));

  const result = await chatCompletion('sys', 'hi');

  expect(result).toBe('fallback ok');
  expect(fetch).toHaveBeenCalledTimes(2);
});
```

**Sequential Mock Responses:**
Chain `.mockResolvedValueOnce()` calls to simulate multi-step flows:
```typescript
vi.mocked(fetch)
  .mockResolvedValueOnce(textResponse('unavailable', 500))  // first call fails
  .mockResolvedValueOnce(new Response('audio-bytes', { status: 200 })); // fallback succeeds
```

**Asserting Mock Call Arguments:**
```typescript
// Check if any sent message contains specific content
expect(ws.sent.some(msg => msg.includes('session.update'))).toBe(true);

// Verify specific callback was called with expected data
expect(onTextResponse).toHaveBeenCalledWith('Hello');
```

## Test Coverage Gaps

**Untested Areas:**
- **React components** -- zero component tests; no React Testing Library setup
- **Custom hooks** -- `useLocalStorage`, `useTheme`, `useTTS`, `useAudioRecorder` have no tests
- **Context providers** -- `AuthContext` has no tests
- **Utility functions** -- `src/utils/cleanJson.ts`, `src/utils/roleplayTrails.ts`, `src/utils/encryption.ts`, `src/utils/prompts.ts` have no tests
- **Supabase services** -- `src/services/supabase/` directory has no tests
- **Runtime state** -- `src/services/runtimeState.ts` has no tests
- **Gamification** -- `src/services/gamification.ts` has no tests
- **Error analysis** -- `src/services/errorAnalysis.ts` has no tests
- **Spaced repetition** -- `src/services/spacedRepetition.ts` has no tests

**Tested Areas (6 test files):**
- `src/config/navigation.test.ts` -- nav item validation
- `src/config/modes.test.ts` -- mode config validation
- `src/config/practice.test.ts` -- practice config validation
- `src/services/openai.test.ts` -- AI provider dispatch + fallback
- `src/services/geminiLive.test.ts` -- Gemini live session
- `src/services/openaiRealtimeLive.test.ts` -- OpenAI realtime session

---

*Testing analysis: 2026-04-01*
