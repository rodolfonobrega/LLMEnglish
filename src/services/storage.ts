import type { Card } from '../types/card';
import type { GamificationState, SessionReport } from '../types/gamification';
import type { LiveSession, PathProgress } from '../types/scenario';
import type { ModelConfig, ConversationTone } from '../types/settings';
import {
  getRuntimeApiKey,
  getRuntimeConversationTone,
  getRuntimeGamification,
  getRuntimeModelConfig,
  getRuntimeUserContext,
} from './runtimeState'

const KEYS = {
  cards: 'el_cards',
  gamification: 'el_gamification',
  liveSessions: 'el_live_sessions',
  sessionReports: 'el_session_reports',
  pathProgress: 'el_path_progress',
  openaiKey: 'el_openai_key',
  geminiKey: 'el_gemini_key',
  groqKey: 'el_groq_key',
  audioCache: 'el_audio_cache',
  modelConfig: 'el_model_config',
  conversationTone: 'el_conversation_tone',
};

// --- Cards ---

export function getCards(): Card[] {
  const raw = localStorage.getItem(KEYS.cards);
  return raw ? JSON.parse(raw) : [];
}

export function saveCards(cards: Card[]): void {
  localStorage.setItem(KEYS.cards, JSON.stringify(cards));
}

export function addCard(card: Card): void {
  const cards = getCards();
  cards.push(card);
  saveCards(cards);
}

export function updateCard(updated: Card): void {
  const cards = getCards().map(c => (c.id === updated.id ? updated : c));
  saveCards(cards);
}

export function deleteCard(id: string): void {
  const cards = getCards().filter(c => c.id !== id);
  saveCards(cards);
}

export function getCardById(id: string): Card | undefined {
  return getCards().find(c => c.id === id);
}

export function getCardsDueForReview(): Card[] {
  const now = new Date().toISOString();
  return getCards().filter(c => c.nextReviewAt && c.nextReviewAt <= now);
}

// --- Gamification ---

export function getGamification(): GamificationState {
  return getRuntimeGamification();
}

export function saveGamification(state: GamificationState): void {
  localStorage.setItem(KEYS.gamification, JSON.stringify(state));
}

// --- Live Sessions ---

export function getLiveSessions(): LiveSession[] {
  const raw = localStorage.getItem(KEYS.liveSessions);
  return raw ? JSON.parse(raw) : [];
}

export function saveLiveSession(session: LiveSession): void {
  const sessions = getLiveSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(KEYS.liveSessions, JSON.stringify(sessions));
}

// --- Path Progress ---

const DEFAULT_PATH_PROGRESS: PathProgress = { completedSteps: {} };

export function getPathProgress(): PathProgress {
  const raw = localStorage.getItem(KEYS.pathProgress);
  if (!raw) return { ...DEFAULT_PATH_PROGRESS };
  try {
    return { ...DEFAULT_PATH_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PATH_PROGRESS };
  }
}

export function savePathProgress(progress: PathProgress): void {
  localStorage.setItem(KEYS.pathProgress, JSON.stringify(progress));
}

export function markStepComplete(trailId: string, stepId: string): void {
  const progress = getPathProgress();
  const steps = progress.completedSteps[trailId] ?? [];
  if (!steps.includes(stepId)) {
    progress.completedSteps[trailId] = [...steps, stepId];
    savePathProgress(progress);
  }
}

export function isStepComplete(trailId: string, stepId: string): boolean {
  const progress = getPathProgress();
  return (progress.completedSteps[trailId] ?? []).includes(stepId);
}

export function getTrailCompletedCount(trailId: string): number {
  const progress = getPathProgress();
  return (progress.completedSteps[trailId] ?? []).length;
}

// --- Session Reports ---

const MAX_SESSION_REPORTS = 200;

export function getSessionReports(): SessionReport[] {
  const raw = localStorage.getItem(KEYS.sessionReports);
  return raw ? JSON.parse(raw) : [];
}

export function saveSessionReport(report: SessionReport): void {
  const reports = getSessionReports();
  reports.push(report);
  if (reports.length > MAX_SESSION_REPORTS) {
    reports.splice(0, reports.length - MAX_SESSION_REPORTS);
  }
  localStorage.setItem(KEYS.sessionReports, JSON.stringify(reports));
}

export function getSessionReportsByDateRange(startDate: string, endDate: string): SessionReport[] {
  const reports = getSessionReports();
  return reports.filter(
    r => r.date >= startDate && r.date <= endDate
  );
}

export function getLatestSessionReports(limit: number): SessionReport[] {
  const reports = getSessionReports();
  return [...reports]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, limit);
}

// --- API Keys ---
// Priority: localStorage (user-entered in Settings) > .env file (VITE_OPENAI_API_KEY / VITE_GEMINI_API_KEY)

export function getOpenAIKey(): string {
  return getRuntimeApiKey('openai');
}

export function setOpenAIKey(key: string): void {
  localStorage.setItem(KEYS.openaiKey, key);
}

export function getGeminiKey(): string {
  return getRuntimeApiKey('gemini');
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(KEYS.geminiKey, key);
}

export function getGroqKey(): string {
  return getRuntimeApiKey('groq');
}

export function setGroqKey(key: string): void {
  localStorage.setItem(KEYS.groqKey, key);
}

// --- Model Config ---

export function getModelConfig(): ModelConfig {
  return getRuntimeModelConfig();
}

export function saveModelConfig(config: ModelConfig): void {
  localStorage.setItem(KEYS.modelConfig, JSON.stringify(config));
}

// --- Conversation Tone ---

export function getConversationTone(): ConversationTone {
  return getRuntimeConversationTone();
}

export function saveConversationTone(tone: ConversationTone): void {
  localStorage.setItem(KEYS.conversationTone, tone);
}

// --- Audio Cache ---

export function getCachedAudio(key: string): string | null {
  try {
    const cache = JSON.parse(localStorage.getItem(KEYS.audioCache) || '{}');
    return cache[key] || null;
  } catch {
    return null;
  }
}

export function setCachedAudio(key: string, base64Audio: string): void {
  try {
    const cache = JSON.parse(localStorage.getItem(KEYS.audioCache) || '{}');
    cache[key] = base64Audio;
    localStorage.setItem(KEYS.audioCache, JSON.stringify(cache));
  } catch {
    // If storage is full, clear cache and retry
    localStorage.setItem(KEYS.audioCache, JSON.stringify({ [key]: base64Audio }));
  }
}

// --- User Context ---

export interface UserContext {
  profile: string;
  interests: string;
  goals: string;
  currentLevel: string;
}

export function getUserContext(): UserContext {
  return getRuntimeUserContext();
}

export function saveUserContext(context: UserContext): void {
  localStorage.setItem('el_user_context', JSON.stringify(context));
}
