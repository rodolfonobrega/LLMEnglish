import { DEFAULT_MODEL_CONFIG, migrateModelConfig, type ConversationTone, type ModelConfig, type SourceCredentials } from '../types/settings'
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
  credentials: SourceCredentials
}

const envCredentials: SourceCredentials = {
  genai: import.meta.env.VITE_GEMINI_API_KEY || '',
  openai: import.meta.env.VITE_OPENAI_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || '',
}

let state: RuntimeState = {
  modelConfig: { ...DEFAULT_MODEL_CONFIG },
  conversationTone: 'balanced',
  gamification: { ...DEFAULT_GAMIFICATION },
  credentials: { ...envCredentials },
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

export function getRuntimeApiKey(source: keyof SourceCredentials): string | undefined {
  const cred = state.credentials[source]
  if (source === 'vertex') return undefined // vertex uses project-based auth
  return typeof cred === 'string' ? cred : undefined
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

export function setRuntimeCredentials(creds: Partial<SourceCredentials>): void {
  state = {
    ...state,
    credentials: {
      ...state.credentials,
      ...creds,
    },
  }
  emitRuntimeUpdate()
}

export async function hydrateRuntimeState(): Promise<void> {
  const [rawModelConfig, conversationTone, gamification, openaiKey, genaiKey, groqKey] = await Promise.all([
    getModelConfig().catch(() => ({ ...DEFAULT_MODEL_CONFIG })),
    getConversationTone().catch(() => 'balanced' as ConversationTone),
    getGamification().catch(() => ({ ...DEFAULT_GAMIFICATION })),
    getApiKey('openai').catch(() => envCredentials.openai || ''),
    getApiKey('genai').catch(() => envCredentials.genai || ''),
    getApiKey('groq').catch(() => envCredentials.groq || ''),
  ])

  state = {
    modelConfig: migrateModelConfig(rawModelConfig as Record<string, unknown>),
    conversationTone,
    gamification,
    credentials: {
      genai: genaiKey || envCredentials.genai || '',
      openai: openaiKey || envCredentials.openai || '',
      groq: groqKey || envCredentials.groq || '',
    },
  }
  emitRuntimeUpdate()
}

export function resetRuntimeState(): void {
  state = {
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    conversationTone: 'balanced',
    gamification: { ...DEFAULT_GAMIFICATION },
    credentials: { ...envCredentials },
  }
  emitRuntimeUpdate()
}
