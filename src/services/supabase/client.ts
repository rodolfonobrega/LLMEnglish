/**
 * Supabase Client Configuration
 *
 * Singleton pattern for Supabase client with typed queries
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
}

/**
 * Singleton Supabase client instance
 */
let clientInstance: ReturnType<typeof createClient<Database>> | null = null

/**
 * Get or create the Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  if (!clientInstance) {
    clientInstance = createClient<Database>(
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

// Export a default client for convenience
export const supabase = getSupabaseClient()

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
