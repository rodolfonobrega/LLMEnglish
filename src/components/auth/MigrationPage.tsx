/**
 * Migration Page
 *
 * Detects LocalStorage data and guides user through migration to Supabase
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// LocalStorage keys to check for migration
const LOCAL_STORAGE_KEYS = {
  cards: 'el_cards',
  gamification: 'el_gamification',
  liveSessions: 'el_live_sessions',
  sessionReports: 'el_session_reports',
  pathProgress: 'el_path_progress',
  modelConfig: 'el_model_config',
  userContext: 'el_user_context',
  conversationTone: 'el_conversation_tone',
}

interface MigrationData {
  hasData: boolean
  cardsCount: number
  hasGamification: boolean
  liveSessionsCount: number
  sessionReportsCount: number
  hasPathProgress: boolean
  hasModelConfig: boolean
  hasUserContext: boolean
}

interface MigrationProgress {
  stage: string
  progress: number
  total: number
}

export function MigrationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [migrationData, setMigrationData] = useState<MigrationData | null>(null)
  const [migrating, setMigrating] = useState(false)
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Check for existing LocalStorage data
    const data: MigrationData = {
      hasData: false,
      cardsCount: 0,
      hasGamification: false,
      liveSessionsCount: 0,
      sessionReportsCount: 0,
      hasPathProgress: false,
      hasModelConfig: false,
      hasUserContext: false,
    }

    try {
      const cards = localStorage.getItem(LOCAL_STORAGE_KEYS.cards)
      if (cards) {
        const parsed = JSON.parse(cards)
        data.cardsCount = Array.isArray(parsed) ? parsed.length : 0
      }

      data.hasGamification = !!localStorage.getItem(LOCAL_STORAGE_KEYS.gamification)

      const liveSessions = localStorage.getItem(LOCAL_STORAGE_KEYS.liveSessions)
      if (liveSessions) {
        const parsed = JSON.parse(liveSessions)
        data.liveSessionsCount = Array.isArray(parsed) ? parsed.length : 0
      }

      const sessionReports = localStorage.getItem(LOCAL_STORAGE_KEYS.sessionReports)
      if (sessionReports) {
        const parsed = JSON.parse(sessionReports)
        data.sessionReportsCount = Array.isArray(parsed) ? parsed.length : 0
      }

      data.hasPathProgress = !!localStorage.getItem(LOCAL_STORAGE_KEYS.pathProgress)
      data.hasModelConfig = !!localStorage.getItem(LOCAL_STORAGE_KEYS.modelConfig)
      data.hasUserContext = !!localStorage.getItem(LOCAL_STORAGE_KEYS.userContext)

      data.hasData =
        data.cardsCount > 0 ||
        data.hasGamification ||
        data.liveSessionsCount > 0 ||
        data.sessionReportsCount > 0 ||
        data.hasPathProgress ||
        data.hasModelConfig ||
        data.hasUserContext
    } catch (err) {
      console.error('Error checking LocalStorage:', err)
    }

    setMigrationData(data)
  }, [])

  const handleStartMigration = async () => {
    if (!user || !migrationData) return

    setMigrating(true)
    setError(null)

    try {
      // Import the migration utility
      const { migrateToSupabase } = await import('../../utils/migrateToSupabase')

      await migrateToSupabase(user.id, (update) => {
        setProgress(update)
      })

      setSuccess(true)

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  const handleSkipMigration = () => {
    navigate('/')
  }

  if (!migrationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // If no data to migrate, redirect to home
  if (!migrationData.hasData && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All set!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You have no local data to migrate.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue to SpeakLab
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Migration Complete!</h1>
          <p className="text-gray-600 dark:text-gray-400">Your data has been synced to the cloud.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Migrate Your Data</h1>
            <p className="text-gray-600 dark:text-gray-400">
              We found data on this device. Would you like to sync it to the cloud?
            </p>
          </div>

          {/* Data Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Data to migrate:</h3>
            <ul className="space-y-2 text-sm">
              {migrationData.cardsCount > 0 && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {migrationData.cardsCount} flashcard{migrationData.cardsCount !== 1 ? 's' : ''}
                </li>
              )}
              {migrationData.hasGamification && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  XP, level, and achievements
                </li>
              )}
              {migrationData.liveSessionsCount > 0 && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {migrationData.liveSessionsCount} conversation session{migrationData.liveSessionsCount !== 1 ? 's' : ''}
                </li>
              )}
              {migrationData.sessionReportsCount > 0 && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {migrationData.sessionReportsCount} session report{migrationData.sessionReportsCount !== 1 ? 's' : ''}
                </li>
              )}
              {migrationData.hasPathProgress && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Trail progress
                </li>
              )}
              {migrationData.hasModelConfig && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Model configuration
                </li>
              )}
              {migrationData.hasUserContext && (
                <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  User profile settings
                </li>
              )}
            </ul>
          </div>

          {/* Progress */}
          {migrating && progress && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{progress.stage}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{progress.progress} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.progress / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSkipMigration}
              disabled={migrating}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleStartMigration}
              disabled={migrating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {migrating ? 'Migrating...' : 'Migrate Data'}
            </button>
          </div>

          <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
            Your local data will be kept as a backup.
          </p>
        </div>
      </div>
    </div>
  )
}
