import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtimeConfigSnapshot', async () => {
  const actual =
    await vi.importActual<typeof import('../runtimeConfigSnapshot')>(
      '../runtimeConfigSnapshot',
    );
  return {
    ...actual,
    masterEnabled: vi.fn(),
  };
});

vi.mock('../learnerModel', () => ({
  loadLearnerModel: vi.fn(),
}));

vi.mock('../supabase/auth', () => ({
  getProfile: vi.fn(),
}));

vi.mock('./summarizeSession', () => ({
  summarizeSession: vi.fn(),
}));

vi.mock('../sessionReflections', () => ({
  saveSessionReflection: vi.fn(),
}));

import { masterEnabled } from '../runtimeConfigSnapshot';
import { loadLearnerModel } from '../learnerModel';
import { getProfile } from '../supabase/auth';
import { summarizeSession } from './summarizeSession';
import { saveSessionReflection } from '../sessionReflections';
import { generateSessionReflection } from './generateSessionReflection';
import {
  createDiagnosticModel,
  type LearnerModel,
} from '../../types/learnerModel';
import type { SessionRecap, SessionReflection } from './summarizeSession';
import type { StoredSessionReflection } from '../sessionReflections';

const masterEnabledMock = vi.mocked(masterEnabled);
const loadLearnerModelMock = vi.mocked(loadLearnerModel) as unknown as ReturnType<
  typeof vi.fn
>;
const getProfileMock = vi.mocked(getProfile) as unknown as ReturnType<typeof vi.fn>;
const summarizeSessionMock = vi.mocked(summarizeSession);
const saveSessionReflectionMock = vi.mocked(saveSessionReflection);

const diagnosticModel: LearnerModel = createDiagnosticModel();

function baseRecap(overrides: Partial<SessionRecap> = {}): SessionRecap {
  return {
    surface: 'review',
    themes: ['weekend'],
    patterns_correct: [],
    patterns_incorrect: [],
    attempts: 5,
    avg_score: 7.2,
    had_live: false,
    ...overrides,
  };
}

const dummyReflection: SessionReflection = {
  strength_text: 'Suas respostas ficaram mais completas hoje.',
  opportunity_text: 'Tente explorar um tema novo na próxima rodada.',
  salient_patterns: [],
  themes_observed: ['weekend'],
};

const dummyStored: StoredSessionReflection = {
  id: 'ref-1',
  session_key: 'review-xxx',
  surface: 'review',
  strength_text: dummyReflection.strength_text,
  opportunity_text: dummyReflection.opportunity_text,
  salient_patterns: [],
  themes_observed: ['weekend'],
  dismissed_at: null,
  opted_out_at: null,
  created_at: new Date().toISOString(),
};

describe('generateSessionReflection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    masterEnabledMock.mockReturnValue(true);
    loadLearnerModelMock.mockResolvedValue(diagnosticModel);
    getProfileMock.mockResolvedValue({
      id: 'user-1',
      email: 'x@y.z',
      profile: '',
      interests: '',
      goals: '',
      current_level: 'Intermediate',
      conversation_tone: 'balanced',
      master_enabled: true,
      lessons_opt_in: true,
      reflections_opt_in: true,
      created_at: '',
      updated_at: '',
    });
    summarizeSessionMock.mockResolvedValue(dummyReflection);
    saveSessionReflectionMock.mockResolvedValue(dummyStored);
  });

  it('skips when Master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result).toEqual({ reflection: null, skippedReason: 'master_disabled' });
    expect(summarizeSessionMock).not.toHaveBeenCalled();
  });

  it('skips when attempts is zero', async () => {
    const result = await generateSessionReflection({
      recap: baseRecap({ attempts: 0 }),
      sessionKey: 'k',
    });
    expect(result).toEqual({ reflection: null, skippedReason: 'empty_session' });
    expect(summarizeSessionMock).not.toHaveBeenCalled();
  });

  it('skips when the user has opted out', async () => {
    getProfileMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'x@y.z',
      profile: '',
      interests: '',
      goals: '',
      current_level: 'Intermediate',
      conversation_tone: 'balanced',
      master_enabled: true,
      lessons_opt_in: true,
      reflections_opt_in: false,
      created_at: '',
      updated_at: '',
    });
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result).toEqual({ reflection: null, skippedReason: 'opted_out' });
    expect(summarizeSessionMock).not.toHaveBeenCalled();
  });

  it('treats null opt-in as opted-in (backward compat)', async () => {
    getProfileMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'x@y.z',
      profile: '',
      interests: '',
      goals: '',
      current_level: 'Intermediate',
      conversation_tone: 'balanced',
      master_enabled: true,
      lessons_opt_in: true,
      reflections_opt_in: null,
      created_at: '',
      updated_at: '',
    });
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result.reflection).toEqual(dummyStored);
  });

  it('returns the stored reflection on the happy path', async () => {
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'review-abc',
    });
    expect(summarizeSessionMock).toHaveBeenCalledTimes(1);
    expect(saveSessionReflectionMock).toHaveBeenCalledWith({
      session_key: 'review-abc',
      surface: 'review',
      reflection: dummyReflection,
    });
    expect(result.reflection).toEqual(dummyStored);
  });

  it('marks llm_failed when summarizeSession returns null', async () => {
    summarizeSessionMock.mockResolvedValueOnce(null);
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result).toEqual({ reflection: null, skippedReason: 'llm_failed' });
    expect(saveSessionReflectionMock).not.toHaveBeenCalled();
  });

  it('marks persist_failed when saveSessionReflection returns null', async () => {
    saveSessionReflectionMock.mockResolvedValueOnce(null);
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result).toEqual({ reflection: null, skippedReason: 'persist_failed' });
  });

  it('swallows profile read errors and treats as opt-in', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('network'));
    const result = await generateSessionReflection({
      recap: baseRecap(),
      sessionKey: 'k',
    });
    expect(result.reflection).toEqual(dummyStored);
  });
});
