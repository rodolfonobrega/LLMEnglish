/**
 * Runtime Config Context
 *
 * Holds the per-user runtime configuration (model config, conversation
 * tone, gamification, encrypted API keys). The single source of truth is
 * the module-level snapshot in `runtimeConfigSnapshot.ts`; the Provider
 * subscribes to it via `useSyncExternalStore` and exposes actions.
 *
 * This means any writer — React setter, shim, or service module that calls
 * `patchSnapshot(...)` — triggers a re-render of every hook consumer. No
 * window events. No state mirror. One pub/sub channel.
 *
 * Must be mounted INSIDE `AuthProvider` so it can read `useAuth()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_MODEL_CONFIG,
  migrateModelConfig,
  type ConversationTone,
  type ModelConfig,
  type SourceCredentials,
} from '../types/settings'
import type { GamificationState } from '../types/gamification'
import {
  getApiKey as supaGetApiKey,
  getConversationTone as supaGetConversationTone,
  getGamification as supaGetGamification,
  getModelConfig as supaGetModelConfig,
} from '../services/supabase/storage'
import {
  DEFAULT_GAMIFICATION,
  envCredentials,
  getSnapshot,
  patchSnapshot,
  resetSnapshot,
  setMasterUserOverride,
  setSnapshot,
  subscribe,
} from '../services/runtimeConfigSnapshot'
import { useAuth } from './AuthContext'

interface RuntimeConfigValue {
  modelConfig: ModelConfig
  conversationTone: ConversationTone
  gamification: GamificationState
  credentials: SourceCredentials
  getApiKey: (source: keyof SourceCredentials) => string | undefined
  setModelConfig: (config: ModelConfig) => void
  setConversationTone: (tone: ConversationTone) => void
  setGamification: (gamification: GamificationState) => void
  setCredentials: (creds: Partial<SourceCredentials>) => void
  hydrate: () => Promise<void>
  reset: () => void
}

const RuntimeConfigContext = createContext<RuntimeConfigValue | undefined>(undefined)

interface RuntimeConfigProviderProps {
  children: ReactNode
}

export function RuntimeConfigProvider({ children }: RuntimeConfigProviderProps) {
  const { user, profile } = useAuth()
  const state = useSyncExternalStore(subscribe, getSnapshot)

  // Hydrate the per-user Master override from profile.master_enabled.
  // `null` means "not yet loaded" — the env flag decides until we know.
  useEffect(() => {
    if (!profile) {
      setMasterUserOverride(null)
      return
    }
    setMasterUserOverride(
      typeof profile.master_enabled === 'boolean' ? profile.master_enabled : null,
    )
  }, [profile])

  const setModelConfig = useCallback((config: ModelConfig) => {
    patchSnapshot({ modelConfig: config })
  }, [])

  const setConversationTone = useCallback((tone: ConversationTone) => {
    patchSnapshot({ conversationTone: tone })
  }, [])

  const setGamification = useCallback((gamification: GamificationState) => {
    patchSnapshot({ gamification })
  }, [])

  const setCredentials = useCallback((creds: Partial<SourceCredentials>) => {
    const current = getSnapshot().credentials
    patchSnapshot({ credentials: { ...current, ...creds } })
  }, [])

  const getApiKey = useCallback((source: keyof SourceCredentials): string | undefined => {
    const cred = getSnapshot().credentials[source]
    if (source === 'vertex') return undefined
    return typeof cred === 'string' ? cred : undefined
  }, [])

  const reset = useCallback(() => {
    resetSnapshot()
  }, [])

  const hydrate = useCallback(async () => {
    const [
      rawModelConfig,
      conversationTone,
      gamification,
      openaiKey,
      genaiKey,
      groqKey,
      openrouterKey,
    ] = await Promise.all([
      supaGetModelConfig().catch(() => ({ ...DEFAULT_MODEL_CONFIG })),
      supaGetConversationTone().catch(() => 'balanced' as ConversationTone),
      supaGetGamification().catch(() => ({ ...DEFAULT_GAMIFICATION })),
      supaGetApiKey('openai').catch(() => ''),
      supaGetApiKey('genai').catch(() => ''),
      supaGetApiKey('groq').catch(() => ''),
      supaGetApiKey('openrouter').catch(() => ''),
    ])

    setSnapshot({
      modelConfig: migrateModelConfig(rawModelConfig as Record<string, unknown>),
      conversationTone,
      gamification,
      credentials: {
        genai: genaiKey || envCredentials.genai || '',
        openai: openaiKey || envCredentials.openai || '',
        groq: groqKey || envCredentials.groq || '',
        openrouter: openrouterKey || envCredentials.openrouter || '',
      },
      masterUserOverride: null,
    })
  }, [])

  // Dev-mode-without-Supabase: seed a richer mock gamification once so the
  // Discovery/Sidebar UIs have something to render. Matches the values the
  // old `AuthContext` used to push via `setRuntimeGamification`.
  const devModeNoSupabase =
    import.meta.env.DEV &&
    (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)

  useEffect(() => {
    if (!devModeNoSupabase) return
    patchSnapshot({
      gamification: {
        xp: 1250,
        level: 5,
        streak: 7,
        longestStreak: 14,
        lastPracticeDate: new Date().toISOString().split('T')[0],
        totalSessions: 42,
        totalCards: 87,
        badges: [
          { id: 'first_card', name: 'First Steps', description: 'Complete your first exercise', icon: '🎯', earnedAt: '2026-03-15' },
          { id: 'streak_7', name: 'Unstoppable', description: '7-day streak', icon: '⚡', earnedAt: '2026-03-28' },
          { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', earnedAt: '2026-03-30' },
        ],
      },
    })
  }, [devModeNoSupabase])

  // Hydrate when the user signs in; reset when they sign out.
  // Skip in dev-mode-without-Supabase — no backend to hydrate from.
  useEffect(() => {
    if (devModeNoSupabase) return
    if (user) {
      void hydrate()
    } else {
      reset()
    }
    // hydrate/reset are stable (useCallback with []); user drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const value = useMemo<RuntimeConfigValue>(
    () => ({
      modelConfig: state.modelConfig,
      conversationTone: state.conversationTone,
      gamification: state.gamification,
      credentials: state.credentials,
      getApiKey,
      setModelConfig,
      setConversationTone,
      setGamification,
      setCredentials,
      hydrate,
      reset,
    }),
    [
      state,
      getApiKey,
      setModelConfig,
      setConversationTone,
      setGamification,
      setCredentials,
      hydrate,
      reset,
    ],
  )

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRuntimeConfig(): RuntimeConfigValue {
  const ctx = useContext(RuntimeConfigContext)
  if (!ctx) {
    throw new Error('useRuntimeConfig must be used within a RuntimeConfigProvider')
  }
  return ctx
}
