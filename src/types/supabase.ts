/**
 * Supabase Database Types
 *
 * Generated types matching the versioned database schema in supabase/migrations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Source = 'genai' | 'vertex' | 'openrouter' | 'openai' | 'groq'
export type ConversationTone = 'casual' | 'balanced' | 'formal'
export type CardType = 'phrase' | 'text' | 'roleplay' | 'image'
export type ScenarioIntensity = 'normal' | 'adventurous' | 'wild' | 'skill'
export type SessionType = 'exercise' | 'review' | 'live-roleplay'
export type ConversationRole = 'user' | 'ai'

type TableDefinition<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<Profile, ProfileInsert, ProfileUpdate>
      cards: TableDefinition<Card, CardInsert, CardUpdate>
      card_reviews: TableDefinition<CardReview, CardReviewInsert, CardReviewUpdate>
      card_evaluations: TableDefinition<CardEvaluation, CardEvaluationInsert, CardEvaluationUpdate>
      gamification: TableDefinition<Gamification, GamificationInsert, GamificationUpdate>
      badges: TableDefinition<Badge, BadgeInsert, BadgeUpdate>
      live_sessions: TableDefinition<LiveSession, LiveSessionInsert, LiveSessionUpdate>
      conversation_turns: TableDefinition<ConversationTurn, ConversationTurnInsert, ConversationTurnUpdate>
      conversation_analyses: TableDefinition<ConversationAnalysis, ConversationAnalysisInsert, ConversationAnalysisUpdate>
      session_reports: TableDefinition<SessionReport, SessionReportInsert, SessionReportUpdate>
      path_progress: TableDefinition<PathProgress, PathProgressInsert, PathProgressUpdate>
      model_config: TableDefinition<ModelConfig, ModelConfigInsert, ModelConfigUpdate>
      encrypted_api_keys: TableDefinition<EncryptedApiKeys, EncryptedApiKeysInsert, EncryptedApiKeysUpdate>
      error_patterns: TableDefinition<ErrorPatternRow, ErrorPatternInsert, ErrorPatternUpdate>
      error_snapshots: TableDefinition<ErrorSnapshotRow, ErrorSnapshotInsert, ErrorSnapshotUpdate>
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cards_due_for_review: {
        Args: { user_param: string }
        Returns: Card[]
      }
      get_or_create_gamification: {
        Args: { user_param: string }
        Returns: Gamification
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// PROFILE
// ============================================================================

export interface Profile {
  id: string
  email: string | null
  profile: string
  interests: string
  goals: string
  current_level: string
  conversation_tone: ConversationTone
  created_at: string
  updated_at: string
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>
export type ProfileUpdate = Partial<ProfileInsert>

// ============================================================================
// CARD
// ============================================================================

export interface Card {
  id: string
  user_id: string
  type: CardType
  prompt: string
  expected_context: string | null
  image_url: string | null
  target_vocabulary: string[] | null
  context: string | null
  theme: string | null
  created_at: string
  last_reviewed_at: string | null
  next_review_at: string | null
  ease_factor: number
  interval: number
  repetitions: number
}

export type CardInsert = Omit<Card, 'id'>
export type CardUpdate = Partial<CardInsert>

// ============================================================================
// CARD REVIEW
// ============================================================================

export interface CardReview {
  id: string
  card_id: string
  user_id: string
  date: string
  score: number
  user_transcription: string
  created_at: string
}

export type CardReviewInsert = Omit<CardReview, 'id' | 'created_at'>
export type CardReviewUpdate = Partial<CardReviewInsert>

// ============================================================================
// CARD EVALUATION
// ============================================================================

export interface CardEvaluation {
  id: string
  card_id: string
  user_id: string
  score: number
  user_transcription: string
  corrected_version: string
  better_alternatives: string[] | null
  corrections: string[] | null
  overall_feedback: string
  created_at: string
}

export type CardEvaluationInsert = Omit<CardEvaluation, 'id' | 'created_at'>
export type CardEvaluationUpdate = Partial<CardEvaluationInsert>

// ============================================================================
// GAMIFICATION
// ============================================================================

export interface Gamification {
  id: string
  user_id: string
  xp: number
  level: number
  streak: number
  longest_streak: number
  last_practice_date: string | null
  total_sessions: number
  total_cards: number
  created_at: string
  updated_at: string
}

export type GamificationInsert = Omit<Gamification, 'id' | 'created_at' | 'updated_at'>
export type GamificationUpdate = Partial<GamificationInsert>

// ============================================================================
// BADGE
// ============================================================================

export interface Badge {
  id: string
  user_id: string
  badge_id: string
  name: string
  description: string | null
  icon: string | null
  earned_at: string
}

export type BadgeInsert = Omit<Badge, 'id'>
export type BadgeUpdate = Partial<BadgeInsert>

// ============================================================================
// LIVE SESSION
// ============================================================================

export interface LiveScenario {
  id: string
  theme: string
  intensity: ScenarioIntensity
  descriptionPt: string
  systemPrompt: string
  brandName?: string
  location?: string
  userRole: string
  aiRole: string
  characterPersonality?: string
  characterSpeechStyle?: string
  suggestedVoice?: string
  sceneImageUrl?: string
}

export interface LiveSession {
  id: string
  user_id: string
  scenario: LiveScenario
  turn_count: number
  started_at: string
  ended_at: string | null
}

export type LiveSessionInsert = LiveSession
export type LiveSessionUpdate = Partial<LiveSessionInsert>

// ============================================================================
// CONVERSATION TURN
// ============================================================================

export interface ConversationTurn {
  id: string
  live_session_id: string
  user_id: string
  role: ConversationRole
  text: string
  audio_path: string | null
  timestamp: number
}

export type ConversationTurnInsert = Omit<ConversationTurn, 'id'>
export type ConversationTurnUpdate = Partial<ConversationTurnInsert>

// ============================================================================
// CONVERSATION ANALYSIS
// ============================================================================

export interface ConversationAnalysis {
  id: string
  live_session_id: string
  user_id: string
  improvements: string[] | null
  clean_dialogue: ConversationTurn[] | null
  overall_feedback: string | null
  dialogue_audio_path: string | null
  created_at: string
}

export type ConversationAnalysisInsert = Omit<ConversationAnalysis, 'id' | 'created_at'>
export type ConversationAnalysisUpdate = Partial<ConversationAnalysisInsert>

// ============================================================================
// SESSION REPORT
// ============================================================================

export interface SessionReport {
  id: string
  user_id: string
  date: string
  type: SessionType
  exercises_completed: number
  scores: number[] | null
  average_score: number | null
  errors_found: number
  xp_earned: number
  time_spent_seconds: number
  improvements: string[] | null
}

export type SessionReportInsert = Omit<SessionReport, 'id'>
export type SessionReportUpdate = Partial<SessionReportInsert>

// ============================================================================
// PATH PROGRESS
// ============================================================================

export interface PathProgress {
  id: string
  user_id: string
  trail_id: string
  step_id: string
  completed_at: string
}

export type PathProgressInsert = Omit<PathProgress, 'id' | 'completed_at'>
export type PathProgressUpdate = Partial<PathProgressInsert>

// ============================================================================
// MODEL CONFIG
// ============================================================================

export interface ModelConfig {
  id: string
  user_id: string
  chat_model: string
  chat_provider: Source
  chat_source: Source | null
  stt_model: string
  stt_provider: Source
  stt_source: Source | null
  tts_model: string
  tts_voice: string
  tts_provider: Source
  tts_source: Source | null
  image_model: string
  image_provider: 'genai' | 'vertex' | 'openai' | 'openrouter'
  image_source: 'genai' | 'vertex' | 'openai' | 'openrouter' | null
  live_model: string
  live_voice: string
  live_provider: 'genai' | 'vertex' | 'openai'
  live_source: 'genai' | 'vertex' | 'openai' | null
  chat_fallback_model: string | null
  chat_fallback_provider: Source | null
  chat_fallback_source: Source | null
  stt_fallback_model: string | null
  stt_fallback_provider: Source | null
  stt_fallback_source: Source | null
  tts_fallback_model: string | null
  tts_fallback_provider: Source | null
  tts_fallback_source: Source | null
  tts_fallback_voice: string | null
}

export type ModelConfigInsert = Omit<ModelConfig, 'id'>
export type ModelConfigUpdate = Partial<ModelConfigInsert>

// ============================================================================
// ENCRYPTED API KEYS
// ============================================================================

export interface EncryptedApiKeys {
  id: string
  user_id: string
  openai_key: string | null
  gemini_key: string | null
  groq_key: string | null
  openrouter_key: string | null
  openai_key_updated_at: string | null
  gemini_key_updated_at: string | null
  groq_key_updated_at: string | null
  openrouter_key_updated_at: string | null
  created_at: string
  updated_at: string
}

export type EncryptedApiKeysInsert = Omit<EncryptedApiKeys, 'id' | 'created_at' | 'updated_at'>
export type EncryptedApiKeysUpdate = Partial<EncryptedApiKeysInsert>

// ============================================================================
// ERROR ANALYTICS
// ============================================================================

export interface ErrorPatternRow {
  id: string
  user_id: string
  pattern_key: string
  pattern: string
  category: string
  occurrences: number
  first_seen: string
  last_seen: string
  examples: Json
  trend: 'improving' | 'stable' | 'worsening'
  recent_scores: number[]
}

export type ErrorPatternInsert = Omit<ErrorPatternRow, 'id'>
export type ErrorPatternUpdate = Partial<ErrorPatternInsert>

export interface ErrorSnapshotRow {
  id: string
  user_id: string
  date: string
  total_errors: number
  average_score: number
  by_category: Json
  active_patterns: number
  resolved_patterns: number
}

export type ErrorSnapshotInsert = Omit<ErrorSnapshotRow, 'id'>
export type ErrorSnapshotUpdate = Partial<ErrorSnapshotInsert>
