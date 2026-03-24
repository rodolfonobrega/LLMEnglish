/**
 * Supabase Services Index
 *
 * Centralized exports for all Supabase-related services
 */

// Client
export { supabase, getSupabaseClient, resetSupabaseClient } from './client'

// Auth
export {
  signInWithGoogle,
  signInWithGithub,
  signOut,
  getSession,
  getCurrentUser,
  onAuthStateChange,
  getOrCreateProfile,
  updateProfile,
  getProfile,
  type AuthUser,
  type AuthSession,
} from './auth'

// Storage
export {
  // Cards
  getCards,
  saveCards,
  addCard,
  updateCard,
  deleteCard,
  getCardById,
  getCardsDueForReview,

  // Gamification
  getGamification,
  saveGamification,

  // Live Sessions
  getLiveSessions,
  saveLiveSession,
  clearLiveSessions,

  // Path Progress
  getPathProgress,
  savePathProgress,
  markStepComplete,
  isStepComplete,
  getTrailCompletedCount,

  // Session Reports
  getSessionReports,
  saveSessionReport,
  getSessionReportsByDateRange,
  getLatestSessionReports,

  // Model Config
  getModelConfig,
  saveModelConfig,

  // User Context
  getUserContext,
  saveUserContext,

  // Conversation Tone
  getConversationTone,
  saveConversationTone,

  // API Keys (via Edge Function)
  saveApiKey,
  getApiKey,
  saveApiKeys,
} from './storage'

// AI Proxy
export {
  chatCompletion,
  chatCompletionWithImage,
  textToSpeech,
  speechToText,
  generateImage,
  getGeminiKeyForLive,
  withFallback,
  type ChatCompletionOptions,
  type ChatCompletionWithImageOptions,
  type TextToSpeechOptions,
  type SpeechToTextOptions,
  type ImageGenerationOptions,
} from './aiProxy'
