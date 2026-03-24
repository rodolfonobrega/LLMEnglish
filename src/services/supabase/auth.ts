/**
 * Supabase Authentication Service
 *
 * Handles OAuth login (Google, GitHub), sign out, and user profile management
 */

import { supabase } from './client'
import type { Profile } from '../../types/supabase'
import { storeSessionToken, clearSessionToken } from '../../utils/encryption'

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthSession {
  user: AuthUser | null
  accessToken: string | null
}

export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    throw new Error(`Google sign-in failed: ${error.message}`)
  }
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGithub(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  })

  if (error) {
    throw new Error(`GitHub sign-in failed: ${error.message}`)
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  clearSessionToken()

  if (error) {
    throw new Error(`Sign-out failed: ${error.message}`)
  }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<AuthSession> {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Failed to get session:', error)
    // Return empty session instead of throwing
    return {
      user: null,
      accessToken: null,
    }
  }

  if (session) {
    // Store session token for key derivation (ignore errors)
    try {
      await storeSessionToken(session.access_token)
    } catch (e) {
      console.warn('Failed to store session token:', e)
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      accessToken: session.access_token,
    }
  }

  return {
    user: null,
    accessToken: null,
  }
}

/**
 * Get the current user (without session validation)
 */
export function getCurrentUser(): AuthUser | null {
  const { data } = supabase.auth.getUser()

  if (data.user) {
    return {
      id: data.user.id,
      email: data.user.email,
    }
  }

  return null
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: AuthEvent, session: AuthSession) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'TOKEN_REFRESHED') {
      return
    }

    if (session) {
      void storeSessionToken(session.access_token).catch((e) => {
        console.warn('Failed to store session token:', e)
      })

      callback(event, {
        user: {
          id: session.user.id,
          email: session.user.email,
        },
        accessToken: session.access_token,
      })
    } else {
      clearSessionToken()
      callback(event, {
        user: null,
        accessToken: null,
      })
    }
  })
}

/**
 * Get or create the user's profile
 */
export async function getOrCreateProfile(userId: string, email?: string): Promise<Profile> {
  // Try to get existing profile
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (existingProfile) {
    return existingProfile
  }

  // Profile doesn't exist, create it
  if (fetchError?.code === 'PGRST116') {
    const newProfile: Omit<Profile, 'created_at' | 'updated_at'> = {
      id: userId,
      email: email || null,
      profile: '',
      interests: '',
      goals: '',
      current_level: 'Intermediate',
      conversation_tone: 'balanced',
    }

    const { data: createdProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`)
    }

    return createdProfile
  }

  throw new Error(`Failed to get profile: ${fetchError?.message}`)
}

/**
 * Update the user's profile
 */
export async function updateProfile(updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>): Promise<Profile> {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`)
  }

  return data
}

/**
 * Get the user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  const user = getCurrentUser()
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Profile doesn't exist
    }
    throw new Error(`Failed to get profile: ${error.message}`)
  }

  return data
}
