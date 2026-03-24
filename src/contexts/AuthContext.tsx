/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app
 */

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser } from '../services/supabase/auth'
import { hydrateRuntimeState, resetRuntimeState } from '../services/runtimeState'
import {
  getSession,
  signInWithGoogle,
  signInWithGithub,
  signOut,
  onAuthStateChange,
  getOrCreateProfile,
  getProfile,
  updateProfile,
} from '../services/supabase/auth'
import type { Profile } from '../types/supabase'

interface AuthContextValue {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithGithub: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => Promise<Profile>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Load initial session and profile
  useEffect(() => {
    let mounted = true
    const authBootstrapTimeoutMs = 4000
    const bootstrapTimeoutId = window.setTimeout(() => {
      if (!mounted) return
      console.warn(`Auth bootstrap timed out after ${authBootstrapTimeoutMs}ms; continuing without blocking UI.`)
      setLoading(false)
    }, authBootstrapTimeoutMs)

    function finishLoading() {
      window.clearTimeout(bootstrapTimeoutId)
      if (mounted) {
        setLoading(false)
      }
    }

    async function loadProfile(userId: string, email?: string) {
      try {
        const [userProfile] = await Promise.all([
          getOrCreateProfile(userId, email),
          hydrateRuntimeState(),
        ])
        if (mounted) {
          setProfile(userProfile)
        }
      } catch (profileError) {
        console.error('Failed to load profile:', profileError)
      }
    }

    async function loadSession() {
      try {
        const session = await getSession()

        if (!mounted) return

        if (session.user) {
          setUser(session.user)
          void loadProfile(session.user.id, session.user.email ?? undefined)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        finishLoading()
      }
    }

    loadSession()

    // Keep the auth callback synchronous. Supabase recommends not awaiting
    // database calls inside onAuthStateChange handlers to avoid deadlocks.
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (!mounted) return

      console.log('Auth state change:', event, session ? 'has session' : 'no session')

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        resetRuntimeState()
        finishLoading()
        return
      }

      if (session?.user) {
        setUser(session.user)
        if (event !== 'TOKEN_REFRESHED') {
          window.setTimeout(() => {
            void loadProfile(session.user!.id, session.user!.email ?? undefined)
          }, 0)
        }
      } else {
        setUser(null)
        setProfile(null)
        resetRuntimeState()
      }

      finishLoading()
    })

    return () => {
      mounted = false
      window.clearTimeout(bootstrapTimeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (!user) return

    const userProfile = await getProfile()
    if (userProfile) {
      setProfile(userProfile)
    }
  }

  const handleUpdateProfile = async (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => {
    const updatedProfile = await updateProfile(updates)
    setProfile(updatedProfile)
    return updatedProfile
  }

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    updateProfile: handleUpdateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Higher-order component to protect routes that require authentication
 */
interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return fallback || <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  }

  if (!user) {
    // Redirect to login will be handled by the router
    return fallback || null
  }

  return <>{children}</>
}
