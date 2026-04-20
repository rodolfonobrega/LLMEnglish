/**
 * Runtime Config Snapshot
 *
 * Non-React accessor for the runtime config that is owned by
 * `RuntimeConfigProvider`. The Provider writes into this module via a
 * `useEffect`; services that cannot use hooks read from it here.
 *
 * IMPORTANT: Services that read this snapshot before the Provider mounts
 * (e.g. at import time, before `<App />` is rendered) will see default
 * values. In practice this is fine because:
 *   - Network/AI calls only fire after the user interacts with the UI, which
 *     is long after the Provider has hydrated.
 *   - In dev mode without Supabase we seed `envCredentials` synchronously so
 *     the defaults already include `VITE_*_API_KEY` values.
 *
 * React components subscribe via `useRuntimeConfig()`, which in turn uses
 * `useSyncExternalStore(subscribe, getSnapshot)` — no window events.
 * Non-React services can also call `subscribe()` if they need a listener,
 * but typically they just `patchSnapshot(...)` and let React react.
 */

import {
  DEFAULT_MODEL_CONFIG,
  type ConversationTone,
  type ModelConfig,
  type SourceCredentials,
} from '../types/settings'
import type { GamificationState } from '../types/gamification'

export const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalSessions: 0,
  totalCards: 0,
  badges: [],
}

// Previously loaded whenever Supabase was missing — that also fires in prod
// builds where env was forgotten. Lock to `import.meta.env.DEV` so prod never
// reads `VITE_*_API_KEY`.
const useEnvCredentials =
  import.meta.env.DEV &&
  (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)

export const envCredentials: SourceCredentials = useEnvCredentials
  ? {
      genai: import.meta.env.VITE_GEMINI_API_KEY || '',
      openai: import.meta.env.VITE_OPENAI_API_KEY || '',
      groq: import.meta.env.VITE_GROQ_API_KEY || '',
      openrouter: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    }
  : {}

export interface RuntimeConfigSnapshot {
  modelConfig: ModelConfig
  conversationTone: ConversationTone
  gamification: GamificationState
  credentials: SourceCredentials
}

function createDefaultSnapshot(): RuntimeConfigSnapshot {
  return {
    modelConfig: { ...DEFAULT_MODEL_CONFIG },
    conversationTone: 'balanced',
    gamification: { ...DEFAULT_GAMIFICATION },
    credentials: { ...envCredentials },
  }
}

// Module-level ref. Writers call `setSnapshot` / `patchSnapshot` / `resetSnapshot`
// and every write notifies all `subscribe()` listeners — this is the sole
// pub/sub mechanism replacing the old `runtime-state-update` /
// `gamification-update` window events.
let snapshot: RuntimeConfigSnapshot = createDefaultSnapshot()

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapshot(): RuntimeConfigSnapshot {
  return snapshot
}

export function setSnapshot(next: RuntimeConfigSnapshot): void {
  snapshot = next
  notify()
}

export function patchSnapshot(patch: Partial<RuntimeConfigSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  notify()
}

export function resetSnapshot(): void {
  snapshot = createDefaultSnapshot()
  notify()
}

// Convenience readers used by the deprecation shim and by services that
// can't call hooks. Thin wrappers over `getSnapshot()`.
export function getModelConfig(): ModelConfig {
  return snapshot.modelConfig
}

export function getConversationTone(): ConversationTone {
  return snapshot.conversationTone
}

export function getGamification(): GamificationState {
  return snapshot.gamification
}

export function getApiKey(source: keyof SourceCredentials): string | undefined {
  const cred = snapshot.credentials[source]
  if (source === 'vertex') return undefined // vertex uses project-based auth
  return typeof cred === 'string' ? cred : undefined
}

// Merge credential patch into the snapshot. Used by the storage facade when
// components outside of a React render need to update keys (e.g. settings
// save path doing optimistic update + rollback).
export function patchCredentials(patch: Partial<SourceCredentials>): void {
  snapshot = {
    ...snapshot,
    credentials: { ...snapshot.credentials, ...patch },
  }
  notify()
}
