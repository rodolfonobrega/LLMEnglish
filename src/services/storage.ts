/**
 * Storage Facade
 *
 * Single import point for all storage operations.
 * Sync functions read from runtimeState cache.
 * Async functions delegate to supabase/storage.
 * Dev mode (no VITE_SUPABASE_URL) returns defaults for reads and no-ops for writes.
 */

import type { Card } from '../types/card';
import type { GamificationState, SessionReport } from '../types/gamification';
import type { LiveSession, PathProgress } from '../types/scenario';
import type { ModelConfig, ConversationTone } from '../types/settings';

import {
  getRuntimeApiKey,
  getRuntimeConversationTone,
  getRuntimeGamification,
  getRuntimeModelConfig,
  setRuntimeCredentials,
} from './runtimeState'

import {
  getCards as supabaseGetCards,
  saveCards as supabaseSaveCards,
  addCard as supabaseAddCard,
  updateCard as supabaseUpdateCard,
  deleteCard as supabaseDeleteCard,
  getCardById as supabaseGetCardById,
  getCardsDueForReview as supabaseGetCardsDueForReview,
  saveGamification as supabaseSaveGamification,
  getLiveSessions as supabaseGetLiveSessions,
  saveLiveSession as supabaseSaveLiveSession,
  clearLiveSessions as supabaseClearLiveSessions,
  getPathProgress as supabaseGetPathProgress,
  savePathProgress as supabaseSavePathProgress,
  markStepComplete as supabaseMarkStepComplete,
  isStepComplete as supabaseIsStepComplete,
  getTrailCompletedCount as supabaseGetTrailCompletedCount,
  getSessionReports as supabaseGetSessionReports,
  saveSessionReport as supabaseSaveSessionReport,
  getSessionReportsByDateRange as supabaseGetSessionReportsByDateRange,
  getLatestSessionReports as supabaseGetLatestSessionReports,
  saveModelConfig as supabaseSaveModelConfig,
  saveConversationTone as supabaseSaveConversationTone,
  saveApiKey as supabaseSaveApiKey,
  getApiKey as supabaseGetApiKey,
  saveApiKeys as supabaseSaveApiKeys,
  getModelConfig as supabaseGetModelConfig,
  getConversationTone as supabaseGetConversationTone,
} from './supabase/storage'

// --- Dev mode detection (consistent with AuthContext.tsx:90, SettingsPage.tsx:50) ---
function isDevMode(): boolean {
  return !import.meta.env.VITE_SUPABASE_URL;
}

// ============================================================
// SYNC FUNCTIONS — delegate to runtimeState cache (D-07, D-11)
// ============================================================

export function getModelConfig(): ModelConfig {
  return getRuntimeModelConfig();
}

export function getGamification(): GamificationState {
  return getRuntimeGamification();
}

export function getConversationTone(): ConversationTone {
  return getRuntimeConversationTone();
}

// Named API key wrappers (D-10, D-11)
export function getOpenAIKey(): string {
  return getRuntimeApiKey('openai') || '';
}

export function setOpenAIKey(key: string): void {
  setRuntimeCredentials({ openai: key });
  if (isDevMode()) {
    console.warn('setOpenAIKey: write ignored in dev mode');
    return;
  }
  void supabaseSaveApiKey('openai', key);
}

export function getGeminiKey(): string {
  return getRuntimeApiKey('genai') || '';
}

export function setGeminiKey(key: string): void {
  setRuntimeCredentials({ genai: key });
  if (isDevMode()) {
    console.warn('setGeminiKey: write ignored in dev mode');
    return;
  }
  void supabaseSaveApiKey('genai', key);
}

export function getGroqKey(): string {
  return getRuntimeApiKey('groq') || '';
}

export function setGroqKey(key: string): void {
  setRuntimeCredentials({ groq: key });
  if (isDevMode()) {
    console.warn('setGroqKey: write ignored in dev mode');
    return;
  }
  void supabaseSaveApiKey('groq', key);
}

// ============================================================
// ASYNC QUERY FUNCTIONS — delegate to supabase/storage (D-08)
// ============================================================

const EMPTY_CARDS: Card[] = [];
const EMPTY_SESSIONS: LiveSession[] = [];
const EMPTY_REPORTS: SessionReport[] = [];
const DEFAULT_PATH_PROGRESS: PathProgress = { completedSteps: {} };

export async function getCards(): Promise<Card[]> {
  if (isDevMode()) return [...EMPTY_CARDS];
  return supabaseGetCards();
}

export async function saveCards(cards: Card[]): Promise<void> {
  if (isDevMode()) {
    console.warn('saveCards: write ignored in dev mode');
    return;
  }
  return supabaseSaveCards(cards);
}

export async function addCard(card: Card): Promise<void> {
  if (isDevMode()) {
    console.warn('addCard: write ignored in dev mode');
    return;
  }
  return supabaseAddCard(card);
}

export async function updateCard(updated: Card): Promise<void> {
  if (isDevMode()) {
    console.warn('updateCard: write ignored in dev mode');
    return;
  }
  return supabaseUpdateCard(updated);
}

export async function deleteCard(id: string): Promise<void> {
  if (isDevMode()) {
    console.warn('deleteCard: write ignored in dev mode');
    return;
  }
  return supabaseDeleteCard(id);
}

export async function getCardById(id: string): Promise<Card | undefined> {
  if (isDevMode()) return undefined;
  return supabaseGetCardById(id);
}

export async function getCardsDueForReview(): Promise<Card[]> {
  if (isDevMode()) return [...EMPTY_CARDS];
  return supabaseGetCardsDueForReview();
}

export async function saveGamification(state: GamificationState): Promise<void> {
  if (isDevMode()) {
    console.warn('saveGamification: write ignored in dev mode');
    return;
  }
  return supabaseSaveGamification(state);
}

export async function getLiveSessions(): Promise<LiveSession[]> {
  if (isDevMode()) return [...EMPTY_SESSIONS];
  return supabaseGetLiveSessions();
}

export async function saveLiveSession(session: LiveSession): Promise<void> {
  if (isDevMode()) {
    console.warn('saveLiveSession: write ignored in dev mode');
    return;
  }
  return supabaseSaveLiveSession(session);
}

export async function clearLiveSessions(): Promise<void> {
  if (isDevMode()) {
    console.warn('clearLiveSessions: write ignored in dev mode');
    return;
  }
  return supabaseClearLiveSessions();
}

export async function getPathProgress(): Promise<PathProgress> {
  if (isDevMode()) return { ...DEFAULT_PATH_PROGRESS };
  return supabaseGetPathProgress();
}

export async function savePathProgress(progress: PathProgress): Promise<void> {
  if (isDevMode()) {
    console.warn('savePathProgress: write ignored in dev mode');
    return;
  }
  return supabaseSavePathProgress(progress);
}

export async function markStepComplete(trailId: string, stepId: string): Promise<void> {
  if (isDevMode()) {
    console.warn('markStepComplete: write ignored in dev mode');
    return;
  }
  return supabaseMarkStepComplete(trailId, stepId);
}

export async function isStepComplete(trailId: string, stepId: string): Promise<boolean> {
  if (isDevMode()) return false;
  return supabaseIsStepComplete(trailId, stepId);
}

export async function getTrailCompletedCount(trailId: string): Promise<number> {
  if (isDevMode()) return 0;
  return supabaseGetTrailCompletedCount(trailId);
}

export async function getSessionReports(): Promise<SessionReport[]> {
  if (isDevMode()) return [...EMPTY_REPORTS];
  return supabaseGetSessionReports();
}

export async function saveSessionReport(report: SessionReport): Promise<void> {
  if (isDevMode()) {
    console.warn('saveSessionReport: write ignored in dev mode');
    return;
  }
  return supabaseSaveSessionReport(report);
}

export async function getSessionReportsByDateRange(startDate: string, endDate: string): Promise<SessionReport[]> {
  if (isDevMode()) return [...EMPTY_REPORTS];
  return supabaseGetSessionReportsByDateRange(startDate, endDate);
}

export async function getLatestSessionReports(limit: number): Promise<SessionReport[]> {
  if (isDevMode()) return [...EMPTY_REPORTS];
  return supabaseGetLatestSessionReports(limit);
}

export async function saveModelConfig(config: ModelConfig): Promise<void> {
  if (isDevMode()) {
    console.warn('saveModelConfig: write ignored in dev mode');
    return;
  }
  return supabaseSaveModelConfig(config);
}

export async function saveConversationTone(tone: ConversationTone): Promise<void> {
  if (isDevMode()) {
    console.warn('saveConversationTone: write ignored in dev mode');
    return;
  }
  return supabaseSaveConversationTone(tone);
}

export async function saveApiKey(source: string, key: string): Promise<void> {
  if (isDevMode()) {
    console.warn('saveApiKey: write ignored in dev mode');
    return;
  }
  return supabaseSaveApiKey(source, key);
}

export async function getApiKey(source: string): Promise<string> {
  if (isDevMode()) return getRuntimeApiKey(source as 'genai' | 'openai' | 'groq' | 'openrouter') || '';
  return supabaseGetApiKey(source);
}

export async function saveApiKeys(keys: Record<string, string>): Promise<void> {
  if (isDevMode()) {
    console.warn('saveApiKeys: write ignored in dev mode');
    return;
  }
  return supabaseSaveApiKeys(keys);
}

// ============================================================
// ASYNC FETCH FUNCTIONS — fresh server reads via supabase/storage
// ============================================================

export async function fetchModelConfig(): Promise<ModelConfig> {
  if (isDevMode()) return getRuntimeModelConfig();
  return supabaseGetModelConfig();
}

export async function fetchConversationTone(): Promise<ConversationTone> {
  if (isDevMode()) return getRuntimeConversationTone();
  return supabaseGetConversationTone();
}
