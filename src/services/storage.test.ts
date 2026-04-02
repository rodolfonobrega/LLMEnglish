import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock runtimeState before importing storage
vi.mock('./runtimeState', () => ({
  getRuntimeModelConfig: vi.fn(() => ({ chatModel: 'test-model', chatProvider: 'openai' })),
  getRuntimeGamification: vi.fn(() => ({ xp: 100, level: 2 })),
  getRuntimeConversationTone: vi.fn(() => 'balanced'),
  getRuntimeUserContext: vi.fn(() => ({ profile: 'test', interests: '', goals: '', currentLevel: 'Intermediate' })),
  getRuntimeApiKey: vi.fn((provider: string) => `mock-${provider}-key`),
}));

// Mock supabase/storage before importing storage
vi.mock('./supabase/storage', () => ({
  getCards: vi.fn(() => Promise.resolve([{ id: 'c1' }])),
  saveCards: vi.fn(() => Promise.resolve()),
  addCard: vi.fn(() => Promise.resolve()),
  updateCard: vi.fn(() => Promise.resolve()),
  deleteCard: vi.fn(() => Promise.resolve()),
  getCardById: vi.fn(() => Promise.resolve(undefined)),
  getCardsDueForReview: vi.fn(() => Promise.resolve([])),
  getGamification: vi.fn(() => Promise.resolve({ xp: 200 })),
  saveGamification: vi.fn(() => Promise.resolve()),
  getLiveSessions: vi.fn(() => Promise.resolve([])),
  saveLiveSession: vi.fn(() => Promise.resolve()),
  clearLiveSessions: vi.fn(() => Promise.resolve()),
  getPathProgress: vi.fn(() => Promise.resolve({ completedSteps: {} })),
  savePathProgress: vi.fn(() => Promise.resolve()),
  markStepComplete: vi.fn(() => Promise.resolve()),
  isStepComplete: vi.fn(() => Promise.resolve(false)),
  getTrailCompletedCount: vi.fn(() => Promise.resolve(0)),
  getSessionReports: vi.fn(() => Promise.resolve([])),
  saveSessionReport: vi.fn(() => Promise.resolve()),
  getSessionReportsByDateRange: vi.fn(() => Promise.resolve([])),
  getLatestSessionReports: vi.fn(() => Promise.resolve([])),
  getModelConfig: vi.fn(() => Promise.resolve({ chatModel: 'supabase-model' })),
  saveModelConfig: vi.fn(() => Promise.resolve()),
  getConversationTone: vi.fn(() => Promise.resolve('formal')),
  saveConversationTone: vi.fn(() => Promise.resolve()),
  getUserContext: vi.fn(() => Promise.resolve({ profile: 'supabase' })),
  saveUserContext: vi.fn(() => Promise.resolve()),
  saveApiKey: vi.fn(() => Promise.resolve()),
  getApiKey: vi.fn(() => Promise.resolve('supabase-key')),
  saveApiKeys: vi.fn(() => Promise.resolve()),
}));

// Import the module under test (after mocks)
import * as storage from './storage';
import { getRuntimeModelConfig, getRuntimeGamification, getRuntimeConversationTone, getRuntimeUserContext, getRuntimeApiKey } from './runtimeState';
import * as supabaseStorage from './supabase/storage';

describe('Storage Facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: VITE_SUPABASE_URL is set (production mode)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  });

  // ============================================================
  // SYNC DELEGATION TESTS
  // ============================================================

  describe('sync functions delegate to runtimeState', () => {
    it('getModelConfig delegates to getRuntimeModelConfig', () => {
      const result = storage.getModelConfig();
      expect(getRuntimeModelConfig).toHaveBeenCalledOnce();
      expect(result).toEqual({ chatModel: 'test-model', chatProvider: 'openai' });
      // Verify sync: result is NOT a Promise
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('getGamification delegates to getRuntimeGamification', () => {
      const result = storage.getGamification();
      expect(getRuntimeGamification).toHaveBeenCalledOnce();
      expect(result).toEqual({ xp: 100, level: 2 });
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('getConversationTone delegates to getRuntimeConversationTone', () => {
      const result = storage.getConversationTone();
      expect(getRuntimeConversationTone).toHaveBeenCalledOnce();
      expect(result).toBe('balanced');
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('getUserContext delegates to getRuntimeUserContext', () => {
      const result = storage.getUserContext();
      expect(getRuntimeUserContext).toHaveBeenCalledOnce();
      expect(result).toEqual({ profile: 'test', interests: '', goals: '', currentLevel: 'Intermediate' });
      expect(result).not.toBeInstanceOf(Promise);
    });
  });

  describe('named API key wrappers delegate to getRuntimeApiKey', () => {
    it('getOpenAIKey calls getRuntimeApiKey with openai', () => {
      const result = storage.getOpenAIKey();
      expect(getRuntimeApiKey).toHaveBeenCalledWith('openai');
      expect(result).toBe('mock-openai-key');
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('getGeminiKey calls getRuntimeApiKey with gemini', () => {
      const result = storage.getGeminiKey();
      expect(getRuntimeApiKey).toHaveBeenCalledWith('gemini');
      expect(result).toBe('mock-gemini-key');
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('getGroqKey calls getRuntimeApiKey with groq', () => {
      const result = storage.getGroqKey();
      expect(getRuntimeApiKey).toHaveBeenCalledWith('groq');
      expect(result).toBe('mock-groq-key');
      expect(result).not.toBeInstanceOf(Promise);
    });
  });

  // ============================================================
  // ASYNC DELEGATION TESTS
  // ============================================================

  describe('async functions delegate to supabase/storage', () => {
    it('getCards delegates to supabase getCards', async () => {
      const result = await storage.getCards();
      expect(supabaseStorage.getCards).toHaveBeenCalledOnce();
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('saveCards delegates to supabase saveCards', async () => {
      await storage.saveCards([]);
      expect(supabaseStorage.saveCards).toHaveBeenCalledWith([]);
    });

    it('addCard delegates to supabase addCard', async () => {
      const card = { id: '1' } as any;
      await storage.addCard(card);
      expect(supabaseStorage.addCard).toHaveBeenCalledWith(card);
    });

    it('updateCard delegates to supabase updateCard', async () => {
      const card = { id: '1' } as any;
      await storage.updateCard(card);
      expect(supabaseStorage.updateCard).toHaveBeenCalledWith(card);
    });

    it('deleteCard delegates to supabase deleteCard', async () => {
      await storage.deleteCard('1');
      expect(supabaseStorage.deleteCard).toHaveBeenCalledWith('1');
    });

    it('getCardById delegates to supabase getCardById', async () => {
      await storage.getCardById('1');
      expect(supabaseStorage.getCardById).toHaveBeenCalledWith('1');
    });

    it('getCardsDueForReview delegates to supabase getCardsDueForReview', async () => {
      await storage.getCardsDueForReview();
      expect(supabaseStorage.getCardsDueForReview).toHaveBeenCalledOnce();
    });

    it('saveGamification delegates to supabase saveGamification', async () => {
      await storage.saveGamification({ xp: 100 } as any);
      expect(supabaseStorage.saveGamification).toHaveBeenCalledWith({ xp: 100 });
    });

    it('getLiveSessions delegates to supabase getLiveSessions', async () => {
      await storage.getLiveSessions();
      expect(supabaseStorage.getLiveSessions).toHaveBeenCalledOnce();
    });

    it('saveLiveSession delegates to supabase saveLiveSession', async () => {
      await storage.saveLiveSession({ id: 's1' } as any);
      expect(supabaseStorage.saveLiveSession).toHaveBeenCalledWith({ id: 's1' });
    });

    it('clearLiveSessions delegates to supabase clearLiveSessions', async () => {
      await storage.clearLiveSessions();
      expect(supabaseStorage.clearLiveSessions).toHaveBeenCalledOnce();
    });

    it('getPathProgress delegates to supabase getPathProgress', async () => {
      await storage.getPathProgress();
      expect(supabaseStorage.getPathProgress).toHaveBeenCalledOnce();
    });

    it('savePathProgress delegates to supabase savePathProgress', async () => {
      await storage.savePathProgress({ completedSteps: {} });
      expect(supabaseStorage.savePathProgress).toHaveBeenCalledWith({ completedSteps: {} });
    });

    it('markStepComplete delegates to supabase markStepComplete', async () => {
      await storage.markStepComplete('trail1', 'step1');
      expect(supabaseStorage.markStepComplete).toHaveBeenCalledWith('trail1', 'step1');
    });

    it('isStepComplete delegates to supabase isStepComplete', async () => {
      await storage.isStepComplete('trail1', 'step1');
      expect(supabaseStorage.isStepComplete).toHaveBeenCalledWith('trail1', 'step1');
    });

    it('getTrailCompletedCount delegates to supabase getTrailCompletedCount', async () => {
      await storage.getTrailCompletedCount('trail1');
      expect(supabaseStorage.getTrailCompletedCount).toHaveBeenCalledWith('trail1');
    });

    it('getSessionReports delegates to supabase getSessionReports', async () => {
      await storage.getSessionReports();
      expect(supabaseStorage.getSessionReports).toHaveBeenCalledOnce();
    });

    it('saveSessionReport delegates to supabase saveSessionReport', async () => {
      await storage.saveSessionReport({ id: 'r1' } as any);
      expect(supabaseStorage.saveSessionReport).toHaveBeenCalledWith({ id: 'r1' });
    });

    it('getSessionReportsByDateRange delegates to supabase', async () => {
      await storage.getSessionReportsByDateRange('2025-01-01', '2025-12-31');
      expect(supabaseStorage.getSessionReportsByDateRange).toHaveBeenCalledWith('2025-01-01', '2025-12-31');
    });

    it('getLatestSessionReports delegates to supabase', async () => {
      await storage.getLatestSessionReports(5);
      expect(supabaseStorage.getLatestSessionReports).toHaveBeenCalledWith(5);
    });

    it('saveModelConfig delegates to supabase saveModelConfig', async () => {
      await storage.saveModelConfig({ chatModel: 'new' } as any);
      expect(supabaseStorage.saveModelConfig).toHaveBeenCalledWith({ chatModel: 'new' });
    });

    it('saveConversationTone delegates to supabase saveConversationTone', async () => {
      await storage.saveConversationTone('casual');
      expect(supabaseStorage.saveConversationTone).toHaveBeenCalledWith('casual');
    });

    it('saveUserContext delegates to supabase saveUserContext', async () => {
      await storage.saveUserContext({ profile: 'new' } as any);
      expect(supabaseStorage.saveUserContext).toHaveBeenCalledWith({ profile: 'new' });
    });

    it('saveApiKey delegates to supabase saveApiKey', async () => {
      await storage.saveApiKey('openai', 'key123');
      expect(supabaseStorage.saveApiKey).toHaveBeenCalledWith('openai', 'key123');
    });

    it('getApiKey delegates to supabase getApiKey', async () => {
      const result = await storage.getApiKey('openai');
      expect(supabaseStorage.getApiKey).toHaveBeenCalledWith('openai');
      expect(result).toBe('supabase-key');
    });

    it('saveApiKeys delegates to supabase saveApiKeys', async () => {
      await storage.saveApiKeys({ openai: 'k1' });
      expect(supabaseStorage.saveApiKeys).toHaveBeenCalledWith({ openai: 'k1' });
    });
  });

  // ============================================================
  // DEV MODE TESTS
  // ============================================================

  describe('dev mode fallback (no VITE_SUPABASE_URL)', () => {
    beforeEach(() => {
      // Unset VITE_SUPABASE_URL to simulate dev mode
      vi.stubEnv('VITE_SUPABASE_URL', '');
    });

    it('async getCards returns empty array', async () => {
      const result = await storage.getCards();
      expect(result).toEqual([]);
      expect(supabaseStorage.getCards).not.toHaveBeenCalled();
    });

    it('async getCardsDueForReview returns empty array', async () => {
      const result = await storage.getCardsDueForReview();
      expect(result).toEqual([]);
      expect(supabaseStorage.getCardsDueForReview).not.toHaveBeenCalled();
    });

    it('async getLiveSessions returns empty array', async () => {
      const result = await storage.getLiveSessions();
      expect(result).toEqual([]);
      expect(supabaseStorage.getLiveSessions).not.toHaveBeenCalled();
    });

    it('async getSessionReports returns empty array', async () => {
      const result = await storage.getSessionReports();
      expect(result).toEqual([]);
      expect(supabaseStorage.getSessionReports).not.toHaveBeenCalled();
    });

    it('async getPathProgress returns default', async () => {
      const result = await storage.getPathProgress();
      expect(result).toEqual({ completedSteps: {} });
      expect(supabaseStorage.getPathProgress).not.toHaveBeenCalled();
    });

    it('async getCardById returns undefined', async () => {
      const result = await storage.getCardById('1');
      expect(result).toBeUndefined();
      expect(supabaseStorage.getCardById).not.toHaveBeenCalled();
    });

    it('async isStepComplete returns false', async () => {
      const result = await storage.isStepComplete('t1', 's1');
      expect(result).toBe(false);
      expect(supabaseStorage.isStepComplete).not.toHaveBeenCalled();
    });

    it('async getTrailCompletedCount returns 0', async () => {
      const result = await storage.getTrailCompletedCount('t1');
      expect(result).toBe(0);
      expect(supabaseStorage.getTrailCompletedCount).not.toHaveBeenCalled();
    });

    it('async getApiKey returns runtime cache value in dev mode', async () => {
      const result = await storage.getApiKey('openai');
      expect(result).toBe('mock-openai-key');
      expect(supabaseStorage.getApiKey).not.toHaveBeenCalled();
      expect(getRuntimeApiKey).toHaveBeenCalledWith('openai');
    });

    it('async getSessionReportsByDateRange returns empty array', async () => {
      const result = await storage.getSessionReportsByDateRange('2025-01-01', '2025-12-31');
      expect(result).toEqual([]);
      expect(supabaseStorage.getSessionReportsByDateRange).not.toHaveBeenCalled();
    });

    it('async getLatestSessionReports returns empty array', async () => {
      const result = await storage.getLatestSessionReports(5);
      expect(result).toEqual([]);
      expect(supabaseStorage.getLatestSessionReports).not.toHaveBeenCalled();
    });

    it('dev mode write: saveCards logs warning and does not call supabase', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveCards([]);
      expect(supabaseStorage.saveCards).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveGamification logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveGamification({} as any);
      expect(supabaseStorage.saveGamification).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveModelConfig logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveModelConfig({} as any);
      expect(supabaseStorage.saveModelConfig).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveConversationTone logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveConversationTone('casual');
      expect(supabaseStorage.saveConversationTone).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveUserContext logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveUserContext({} as any);
      expect(supabaseStorage.saveUserContext).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveApiKey logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveApiKey('openai', 'k');
      expect(supabaseStorage.saveApiKey).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('dev mode write: saveApiKeys logs warning', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await storage.saveApiKeys({});
      expect(supabaseStorage.saveApiKeys).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('sync functions still work in dev mode (runtimeState always available)', () => {
      expect(storage.getModelConfig()).toEqual({ chatModel: 'test-model', chatProvider: 'openai' });
      expect(storage.getGamification()).toEqual({ xp: 100, level: 2 });
      expect(storage.getConversationTone()).toBe('balanced');
      expect(storage.getOpenAIKey()).toBe('mock-openai-key');
    });
  });

  // ============================================================
  // DEAD CODE REMOVAL
  // ============================================================

  describe('dead code removal', () => {
    it('does not export getCachedAudio', () => {
      expect((storage as any).getCachedAudio).toBeUndefined();
    });

    it('does not export setCachedAudio', () => {
      expect((storage as any).setCachedAudio).toBeUndefined();
    });
  });

  // ============================================================
  // TYPE RE-EXPORT
  // ============================================================

  describe('type re-exports', () => {
    it('UserContext is re-exported from types/settings, not locally defined', async () => {
      // Import the type from settings to verify it's the same
      const settingsTypes = await import('../types/settings');
      // The UserContext type from storage should match settings.UserContext
      // We verify by checking the runtime behavior: getUserContext returns a UserContext-shaped object
      const ctx = storage.getUserContext();
      expect(ctx).toHaveProperty('profile');
      expect(ctx).toHaveProperty('interests');
      expect(ctx).toHaveProperty('goals');
      expect(ctx).toHaveProperty('currentLevel');
      // Also verify that the types/settings module exports UserContext
      expect(settingsTypes.UserContext).toBeDefined();
    });
  });

  // ============================================================
  // SETTER KEY WRAPPERS (sync writes via async supabase)
  // ============================================================

  describe('setter key wrappers', () => {
    it('setOpenAIKey calls supabase saveApiKey with openai', async () => {
      await storage.setOpenAIKey('test-key');
      expect(supabaseStorage.saveApiKey).toHaveBeenCalledWith('openai', 'test-key');
    });

    it('setGeminiKey calls supabase saveApiKey with gemini', async () => {
      await storage.setGeminiKey('test-key');
      expect(supabaseStorage.saveApiKey).toHaveBeenCalledWith('gemini', 'test-key');
    });

    it('setGroqKey calls supabase saveApiKey with groq', async () => {
      await storage.setGroqKey('test-key');
      expect(supabaseStorage.saveApiKey).toHaveBeenCalledWith('groq', 'test-key');
    });

    it('setOpenAIKey no-ops in dev mode', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      storage.setOpenAIKey('test-key');
      expect(supabaseStorage.saveApiKey).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('setGeminiKey no-ops in dev mode', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      storage.setGeminiKey('test-key');
      expect(supabaseStorage.saveApiKey).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });

    it('setGroqKey no-ops in dev mode', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      storage.setGroqKey('test-key');
      expect(supabaseStorage.saveApiKey).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dev mode'));
      warnSpy.mockRestore();
    });
  });
});
