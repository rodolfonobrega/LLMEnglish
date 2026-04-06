import { DEFAULT_MODEL_CONFIG, type ConversationTone, type ModelConfig } from '../types/settings'
import type { GamificationState } from '../types/gamification'
import {
  getApiKey,
  getConversationTone,
  getGamification,
  getModelConfig,
} from './supabase/storage'

const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalSessions: 0,
  totalCards: 0,
  badges: [],
}

type RuntimeState = {
  modelConfig: ModelConfig
  conversationTone: ConversationTone
  gamification: GamificationState
  apiKeys: Record<'openai' | 'gemini' | 'groq', string>
}

const envKeys = {
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || '',
}

let state: RuntimeState = {
  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  conversationTone: 'balanced',
  gamification: { ...DEFAULT_GAMIFICATION },
  apiKeys: { ...envKeys },
}

function emitRuntimeUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('runtime-state-update'))
    window.dispatchEvent(new Event('gamification-update'))
  }
}

export function getRuntimeModelConfig(): ModelConfig {
  return state.modelConfig
}

export function getRuntimeConversationTone(): ConversationTone {
  return state.conversationTone
}

export function getRuntimeGamification(): GamificationState {
  return state.gamification
}

export function getRuntimeApiKey(provider: 'openai' | 'gemini' | 'groq'): string {
  return state.apiKeys[provider]
}

export function setRuntimeModelConfig(config: ModelConfig): void {
  state = { ...state, modelConfig: config }
  emitRuntimeUpdate()
}

export function setRuntimeConversationTone(tone: ConversationTone): void {
  state = { ...state, conversationTone: tone }
  emitRuntimeUpdate()
}

export function setRuntimeGamification(gamification: GamificationState): void {
  state = { ...state, gamification }
  emitRuntimeUpdate()
}

export function setRuntimeApiKeys(keys: Partial<Record<'openai' | 'gemini' | 'groq', string>>): void {
  state = {
    ...state,
    apiKeys: {
      ...state.apiKeys,
      ...keys,
    },
  }
  emitRuntimeUpdate()
}

export async function hydrateRuntimeState(): Promise<void> {
  const [modelConfig, conversationTone, gamification, openaiKey, geminiKey, groqKey] = await Promise.all([
    getModelConfig().catch(() => ({ ...DEFAULT_MODEL_CONFIG })),
    getConversationTone().catch(() => 'balanced' as ConversationTone),
    getGamification().catch(() => ({ ...DEFAULT_GAMIFICATION })),
    getApiKey('openai').catch(() => envKeys.openai),
    getApiKey('gemini').catch(() => envKeys.gemini),
    getApiKey('groq').catch(() => envKeys.groq),
  ])

  state = {
    modelConfig,
    conversationTone,
    gamification,
    apiKeys: {
      openai: openaiKey || envKeys.openai,
      gemini: geminiKey || envKeys.gemini,
      groq: groqKey || envKeys.groq,
    },
  }
  emitRuntimeUpdate()
}

export function resetRuntimeState(): void {
  state = {
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    conversationTone: 'balanced',
    gamification: { ...DEFAULT_GAMIFICATION },
    apiKeys: { ...envKeys },
  }
  emitRuntimeUpdate()
}
