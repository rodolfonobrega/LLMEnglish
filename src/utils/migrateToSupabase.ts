/**
 * Migration Utility: LocalStorage → Supabase
 *
 * Reads data from LocalStorage and migrates it to Supabase
 */

import { supabase } from '../services/supabase/client'
import type { Card } from '../types/card'
import type { ErrorPattern, SessionSnapshot } from '../types/errors'
import type { GamificationState, SessionReport } from '../types/gamification'
import type { LiveSession, PathProgress } from '../types/scenario'
import type { ModelConfig } from '../types/settings'
import type {
  Badge as SupabaseBadge,
  CardReview,
  ConversationTurn,
  PathProgress as SupabasePathProgress,
  SessionReport as SupabaseSessionReport,
} from '../types/supabase'

export interface MigrationProgress {
  stage: string
  progress: number
  total: number
}

type ProgressCallback = (progress: MigrationProgress) => void

// LocalStorage keys
const KEYS = {
  cards: 'el_cards',
  gamification: 'el_gamification',
  liveSessions: 'el_live_sessions',
  sessionReports: 'el_session_reports',
  pathProgress: 'el_path_progress',
  modelConfig: 'el_model_config',
  conversationTone: 'el_conversation_tone',
  errorPatterns: 'el_error_patterns',
  errorSnapshots: 'el_session_snapshots',
}

/**
 * Main migration function
 */
export async function migrateToSupabase(
  userId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const stages: Array<{ name: string; fn: () => Promise<void> }> = []

  // Collect all migration stages
  if (localStorage.getItem(KEYS.cards)) {
    stages.push({ name: 'Migrating cards...', fn: () => migrateCards(userId) })
  }

  if (localStorage.getItem(KEYS.gamification)) {
    stages.push({ name: 'Migrating achievements...', fn: () => migrateGamification(userId) })
  }

  if (localStorage.getItem(KEYS.liveSessions)) {
    stages.push({ name: 'Migrating conversations...', fn: () => migrateLiveSessions(userId) })
  }

  if (localStorage.getItem(KEYS.sessionReports)) {
    stages.push({ name: 'Migrating reports...', fn: () => migrateSessionReports(userId) })
  }

  if (localStorage.getItem(KEYS.pathProgress)) {
    stages.push({ name: 'Migrating progress...', fn: () => migratePathProgress(userId) })
  }

  if (localStorage.getItem(KEYS.modelConfig)) {
    stages.push({ name: 'Migrating settings...', fn: () => migrateModelConfig(userId) })
  }

  if (localStorage.getItem(KEYS.conversationTone)) {
    stages.push({ name: 'Migrating preferences...', fn: () => migrateConversationTone(userId) })
  }

  if (localStorage.getItem(KEYS.errorPatterns) || localStorage.getItem(KEYS.errorSnapshots)) {
    stages.push({ name: 'Migrating error analytics...', fn: () => migrateErrorAnalytics(userId) })
  }

  const total = stages.length

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    onProgress?.({ stage: stage.name, progress: i + 1, total })
    await stage.fn()
  }

  onProgress?.({ stage: 'Complete!', progress: total, total: total })
}

/**
 * Migrate cards
 */
async function migrateCards(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.cards)
  if (!raw) return

  const cards: Card[] = JSON.parse(raw)

  for (const card of cards) {
    // Insert card
    const { data: insertedCard, error: cardError } = await supabase
      .from('cards')
      .insert({
        user_id: userId,
        type: card.type,
        prompt: card.prompt,
        expected_context: card.expectedContext || null,
        image_url: card.imageUrl || null,
        target_vocabulary: card.targetVocabulary || null,
        context: card.context || null,
        theme: card.theme || null,
        created_at: card.createdAt,
        last_reviewed_at: card.lastReviewedAt || null,
        next_review_at: card.nextReviewAt || null,
        ease_factor: card.easeFactor,
        interval: card.interval,
        repetitions: card.repetitions,
      })
      .select('id')
      .single()

    if (cardError) {
      console.error('Error inserting card:', cardError)
      continue
    }

    // Insert reviews
    if (card.reviews && card.reviews.length > 0) {
      const reviews: Omit<CardReview, 'id' | 'created_at'>[] = card.reviews.map(r => ({
        card_id: insertedCard.id,
        user_id: userId,
        date: r.date,
        score: r.score,
        user_transcription: r.userTranscription,
      }))

      const { error: reviewsError } = await supabase
        .from('card_reviews')
        .insert(reviews)

      if (reviewsError) {
        console.error('Error inserting reviews:', reviewsError)
      }
    }

    // Insert latest evaluation
    if (card.latestEvaluation) {
      const { error: evalError } = await supabase
        .from('card_evaluations')
        .insert({
          card_id: insertedCard.id,
          user_id: userId,
          score: card.latestEvaluation.score,
          user_transcription: card.latestEvaluation.userTranscription,
          corrected_version: card.latestEvaluation.correctedVersion,
          better_alternatives: card.latestEvaluation.betterAlternatives || null,
          corrections: card.latestEvaluation.corrections || null,
          overall_feedback: card.latestEvaluation.overallFeedback,
        })

      if (evalError) {
        console.error('Error inserting evaluation:', evalError)
      }
    }
  }
}

/**
 * Migrate gamification data
 */
async function migrateGamification(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.gamification)
  if (!raw) return

  const gami: GamificationState = JSON.parse(raw)

  // Insert gamification record
  const { error: gamiError } = await supabase
    .from('gamification')
    .insert({
      user_id: userId,
      xp: gami.xp,
      level: gami.level,
      streak: gami.streak,
      longest_streak: gami.longestStreak,
      last_practice_date: gami.lastPracticeDate || null,
      total_sessions: gami.totalSessions,
      total_cards: gami.totalCards,
    })

  if (gamiError) {
    console.error('Error inserting gamification:', gamiError)
    return
  }

  // Insert badges
  if (gami.badges && gami.badges.length > 0) {
    const badges: Omit<SupabaseBadge, 'id' | 'earned_at'>[] = gami.badges.map(b => ({
      user_id: userId,
      badge_id: b.id,
      name: b.name,
      description: b.description || null,
      icon: b.icon || null,
      earned_at: b.earnedAt,
    }))

    const { error: badgesError } = await supabase
      .from('badges')
      .insert(badges)

    if (badgesError) {
      console.error('Error inserting badges:', badgesError)
    }
  }
}

/**
 * Migrate live sessions
 */
async function migrateLiveSessions(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.liveSessions)
  if (!raw) return

  const sessions: LiveSession[] = JSON.parse(raw)

  for (const session of sessions) {
    // Insert live session
    const { data: insertedSession, error: sessionError } = await supabase
      .from('live_sessions')
      .insert({
        user_id: userId,
        scenario: session.scenario,
        turn_count: session.turns.length,
        started_at: session.startedAt,
        ended_at: session.endedAt || null,
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Error inserting live session:', sessionError)
      continue
    }

    // Insert conversation turns
    if (session.turns && session.turns.length > 0) {
      const turns: Omit<ConversationTurn, 'id'>[] = session.turns.map(t => ({
        live_session_id: insertedSession.id,
        user_id: userId,
        role: t.role,
        text: t.text,
        audio_path: t.audioBlob || null, // Note: blob URLs won't work after refresh
        timestamp: t.timestamp,
      }))

      const { error: turnsError } = await supabase
        .from('conversation_turns')
        .insert(turns)

      if (turnsError) {
        console.error('Error inserting conversation turns:', turnsError)
      }
    }

    // Insert conversation analysis
    if (session.analysis) {
      const { error: analysisError } = await supabase
        .from('conversation_analyses')
        .insert({
          live_session_id: insertedSession.id,
          user_id: userId,
          improvements: session.analysis.improvements || null,
          clean_dialogue: session.analysis.cleanDialogue || null,
          overall_feedback: session.analysis.overallFeedback || null,
          dialogue_audio_path: session.analysis.dialogueAudioUrl || null,
        })

      if (analysisError) {
        console.error('Error inserting conversation analysis:', analysisError)
      }
    }
  }
}

/**
 * Migrate session reports
 */
async function migrateSessionReports(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.sessionReports)
  if (!raw) return

  const reports: SessionReport[] = JSON.parse(raw)

  const reportsToInsert: Omit<SupabaseSessionReport, 'id' | 'date'>[] = reports.map(r => ({
    user_id: userId,
    type: r.type,
    exercises_completed: r.exercisesCompleted,
    scores: r.scores.length > 0 ? r.scores : null,
    average_score: r.averageScore || null,
    errors_found: r.errorsFound,
    xp_earned: r.xpEarned,
    time_spent_seconds: r.timeSpentSeconds,
    improvements: r.improvements.length > 0 ? r.improvements : null,
  }))

  const { error } = await supabase
    .from('session_reports')
    .insert(reportsToInsert)

  if (error) {
    console.error('Error inserting session reports:', error)
  }
}

/**
 * Migrate path progress
 */
async function migratePathProgress(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.pathProgress)
  if (!raw) return

  const progress: PathProgress = JSON.parse(raw)

  const entries: Omit<SupabasePathProgress, 'id' | 'completed_at'>[] = []

  for (const [trailId, steps] of Object.entries(progress.completedSteps)) {
    for (const stepId of steps) {
      entries.push({
        user_id: userId,
        trail_id: trailId,
        step_id: stepId,
      })
    }
  }

  if (entries.length === 0) return

  const { error } = await supabase
    .from('path_progress')
    .insert(entries)

  if (error) {
    console.error('Error inserting path progress:', error)
  }
}

/**
 * Migrate model config
 */
async function migrateModelConfig(userId: string): Promise<void> {
  const raw = localStorage.getItem(KEYS.modelConfig)
  if (!raw) return

  const config: ModelConfig = JSON.parse(raw)

  const { error } = await supabase
    .from('model_config')
    .insert({
      user_id: userId,
      chat_model: config.chatModel,
      chat_provider: config.chatProvider,
      stt_model: config.sttModel,
      stt_provider: config.sttProvider,
      tts_model: config.ttsModel,
      tts_voice: config.ttsVoice,
      tts_provider: config.ttsProvider,
      image_model: config.imageModel,
      image_provider: config.imageProvider,
      live_model: config.liveModel,
      live_voice: config.liveVoice,
      live_provider: config.liveProvider,
      chat_fallback_model: config.chatFallbackModel || null,
      chat_fallback_provider: config.chatFallbackProvider || null,
      stt_fallback_model: config.sttFallbackModel || null,
      stt_fallback_provider: config.sttFallbackProvider || null,
      tts_fallback_model: config.ttsFallbackModel || null,
      tts_fallback_provider: config.ttsFallbackProvider || null,
      tts_fallback_voice: config.ttsFallbackVoice || null,
    })

  if (error) {
    console.error('Error inserting model config:', error)
  }
}

/**
 * Migrate conversation tone
 */
async function migrateConversationTone(userId: string): Promise<void> {
  const tone = localStorage.getItem(KEYS.conversationTone)
  if (!tone) return

  const validTones = ['casual', 'balanced', 'formal']
  if (!validTones.includes(tone)) return

  const { error } = await supabase
    .from('profiles')
    .update({ conversation_tone: tone })
    .eq('id', userId)

  if (error) {
    console.error('Error updating conversation tone:', error)
  }
}

/**
 * Migrate error analytics
 */
async function migrateErrorAnalytics(userId: string): Promise<void> {
  const rawPatterns = localStorage.getItem(KEYS.errorPatterns)
  const rawSnapshots = localStorage.getItem(KEYS.errorSnapshots)

  if (rawPatterns) {
    const patterns: ErrorPattern[] = JSON.parse(rawPatterns)
    if (patterns.length > 0) {
      const { error } = await supabase
        .from('error_patterns')
        .insert(patterns.map(pattern => ({
          user_id: userId,
          pattern_key: pattern.id,
          pattern: pattern.pattern,
          category: pattern.category,
          occurrences: pattern.occurrences,
          first_seen: pattern.firstSeen,
          last_seen: pattern.lastSeen,
          examples: pattern.examples,
          trend: pattern.trend,
          recent_scores: pattern.recentScores,
        })))

      if (error) {
        console.error('Error inserting error patterns:', error)
      }
    }
  }

  if (rawSnapshots) {
    const snapshots: SessionSnapshot[] = JSON.parse(rawSnapshots)
    if (snapshots.length > 0) {
      const { error } = await supabase
        .from('error_snapshots')
        .insert(snapshots.map(snapshot => ({
          user_id: userId,
          date: snapshot.date,
          total_errors: snapshot.totalErrors,
          average_score: snapshot.averageScore,
          by_category: snapshot.byCategory,
          active_patterns: snapshot.activePatterns,
          resolved_patterns: snapshot.resolvedPatterns,
        })))

      if (error) {
        console.error('Error inserting error snapshots:', error)
      }
    }
  }
}
