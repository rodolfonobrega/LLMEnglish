import { Buffer } from 'node:buffer';
import { afterEach, beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
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
