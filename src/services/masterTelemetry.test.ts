import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('./supabase/client', () => {
  const insert = vi.fn();
  return {
    supabase: {
      from: vi.fn(() => ({ insert })),
    },
    __insert: insert,
  };
});

vi.mock('./runtimeConfigSnapshot', () => ({
  masterEnabled: vi.fn(),
}));

import { recordMasterUsage } from './masterTelemetry';
import { getCurrentUser } from './supabase/auth';
import { masterEnabled } from './runtimeConfigSnapshot';
import { supabase } from './supabase/client';

const mockedMasterEnabled = vi.mocked(masterEnabled);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedFrom = vi.mocked(supabase.from);

function makeInsertMock(result: { error: { message: string } | null } | Error) {
  const insert = vi.fn(() =>
    result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve(result),
  );
  mockedFrom.mockReturnValue({ insert } as unknown as ReturnType<typeof mockedFrom>);
  return insert;
}

function firstInsertPayload(
  insert: ReturnType<typeof vi.fn>,
): Record<string, unknown> {
  const call = insert.mock.calls[0];
  expect(call).toBeDefined();
  return call![0] as Record<string, unknown>;
}

describe('recordMasterUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedMasterEnabled.mockReturnValue(true);
    mockedGetCurrentUser.mockReturnValue({ id: 'user-1', email: 'u@x.test' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early when the master flag is off', async () => {
    mockedMasterEnabled.mockReturnValue(false);
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({ role: 'prescribe' });

    expect(insert).not.toHaveBeenCalled();
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('returns early when there is no current user', async () => {
    mockedGetCurrentUser.mockReturnValue(null);
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({ role: 'prescribe' });

    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a row with the expected payload shape', async () => {
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({
      role: 'evaluate',
      tokensIn: 123,
      tokensOut: 45,
      model: 'gpt-4o-mini',
      latencyMs: 870,
    });

    expect(mockedFrom).toHaveBeenCalledWith('master_usage');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      role: 'evaluate',
      tokens_in: 123,
      tokens_out: 45,
      model: 'gpt-4o-mini',
      latency_ms: 870,
    });
  });

  it('clamps negative and fractional token counts to >= 0 integers', async () => {
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({
      role: 'prescribe',
      tokensIn: -5,
      tokensOut: 17.9,
    });

    const call = firstInsertPayload(insert);
    expect(call.tokens_in).toBe(0);
    expect(call.tokens_out).toBe(17);
  });

  it('coerces non-finite latency to null', async () => {
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({
      role: 'update_model',
      latencyMs: Number.NaN,
    });

    const call = firstInsertPayload(insert);
    expect(call.latency_ms).toBeNull();
  });

  it('defaults model and latency to null when absent', async () => {
    const insert = makeInsertMock({ error: null });

    await recordMasterUsage({ role: 'render_moment' });

    const call = firstInsertPayload(insert);
    expect(call.model).toBeNull();
    expect(call.latency_ms).toBeNull();
    expect(call.tokens_in).toBe(0);
    expect(call.tokens_out).toBe(0);
  });

  it('swallows insert errors and logs a warning without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    makeInsertMock({ error: { message: 'RLS violation' } });

    await expect(recordMasterUsage({ role: 'compose_lesson' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('swallows unexpected exceptions and logs a warning without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    makeInsertMock(new Error('network down'));

    await expect(recordMasterUsage({ role: 'compose_lesson' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
