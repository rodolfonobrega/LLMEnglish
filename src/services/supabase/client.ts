/**
 * Supabase Client Configuration
 *
 * Singleton pattern for Supabase client with typed queries
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
}

/**
 * Singleton Supabase client instance
 */
let clientInstance: SupabaseClient | null = null

/**
 * Get or create the Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  if (!clientInstance) {
    clientInstance = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }
    )
  }

  return clientInstance
}

/**
 * Reset the Supabase client instance
 * Useful for testing or after logout
 */
export function resetSupabaseClient(): void {
  clientInstance = null
}

// Export a lazy client getter — avoids crashing at import time when env vars are missing (dev mode)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabaseClient(), prop)
  },
})

// Re-export types for convenience
export type { Database }
export type {
  Profile,
  Card,
  CardReview,
  CardEvaluation,
  Gamification,
  Badge,
  LiveSession,
  ConversationTurn,
  ConversationAnalysis,
  SessionReport,
  PathProgress,
  ModelConfig,
  EncryptedApiKeys,
} from '../../types/supabase'
