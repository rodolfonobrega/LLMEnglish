import type { Card } from '../types/card';
import type { GamificationState } from '../types/gamification';
import type { LiveSession } from '../types/scenario';
import type { ModelConfig } from '../types/settings';
import { DEFAULT_MODEL_CONFIG } from '../types/settings';

const KEYS = {
  cards: 'el_cards',
  gamification: 'el_gamification',
  liveSessions: 'el_live_sessions',
  openaiKey: 'el_openai_key',
  geminiKey: 'el_gemini_key',
  audioCache: 'el_audio_cache',
  modelConfig: 'el_model_config',
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

const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalSessions: 0,
  totalCards: 0,
  badges: [],
};

export function getGamification(): GamificationState {
  const raw = localStorage.getItem(KEYS.gamification);
  return raw ? JSON.parse(raw) : { ...DEFAULT_GAMIFICATION };
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

// --- API Keys ---
// Priority: localStorage (user-entered in Settings) > .env file (VITE_OPENAI_API_KEY / VITE_GEMINI_API_KEY)

export function getOpenAIKey(): string {
  return localStorage.getItem(KEYS.openaiKey) || import.meta.env.VITE_OPENAI_API_KEY || '';
}

export function setOpenAIKey(key: string): void {
  localStorage.setItem(KEYS.openaiKey, key);
}

export function getGeminiKey(): string {
  return localStorage.getItem(KEYS.geminiKey) || import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function setGeminiKey(key: string): void {
  localStorage.setItem(KEYS.geminiKey, key);
}

// --- Model Config ---

export function getModelConfig(): ModelConfig {
  const raw = localStorage.getItem(KEYS.modelConfig);
  if (!raw) return { ...DEFAULT_MODEL_CONFIG };
  try {
    return { ...DEFAULT_MODEL_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MODEL_CONFIG };
  }
}

export function saveModelConfig(config: ModelConfig): void {
  localStorage.setItem(KEYS.modelConfig, JSON.stringify(config));
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
