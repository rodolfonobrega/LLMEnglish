/**
 * Supabase Storage Service
 *
 * CRUD operations for all data via Supabase
 * Replaces the LocalStorage-based storage.ts
 */

import { supabase } from './client'
import type { Card as SupabaseCard, CardReview, CardEvaluation, Badge, ConversationTurn } from '../../types/supabase'
import type { Card } from '../../types/card'
import type { GamificationState, SessionReport, Badge as LocalBadge } from '../../types/gamification'
import type { LiveSession, PathProgress } from '../../types/scenario'
import type { ModelConfig, ConversationTone } from '../../types/settings'
import { DEFAULT_MODEL_CONFIG, migrateModelConfig } from '../../types/settings'
import { getCurrentUser } from './auth'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the current user ID or throw an error
 */
function getUserId(): string {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }
  return user.id
}

/**
 * Convert Supabase card + reviews to local Card format
 */
function supabaseCardToLocal(card: SupabaseCard, reviews?: CardReview[], evaluation?: CardEvaluation): Card {
  return {
    id: card.id,
    type: card.type,
    prompt: card.prompt,
    expectedContext: card.expected_context || undefined,
    imageUrl: card.image_url || undefined,
    targetVocabulary: card.target_vocabulary || undefined,
    context: card.context || undefined,
    theme: card.theme || undefined,
    createdAt: card.created_at,
    lastReviewedAt: card.last_reviewed_at || undefined,
    nextReviewAt: card.next_review_at || undefined,
    easeFactor: Number(card.ease_factor),
    interval: card.interval,
    repetitions: card.repetitions,
    reviews: (reviews || []).map(r => ({
      date: r.date,
      score: Number(r.score),
      userTranscription: r.user_transcription,
    })),
    latestEvaluation: evaluation ? {
      score: Number(evaluation.score),
      userTranscription: evaluation.user_transcription,
      correctedVersion: evaluation.corrected_version,
      betterAlternatives: evaluation.better_alternatives || [],
      corrections: evaluation.corrections || [],
      overallFeedback: evaluation.overall_feedback,
    } : undefined,
  }
}

type SupabaseCardWithRelations = SupabaseCard & {
  card_reviews?: CardReview[] | null
  card_evaluations?: CardEvaluation[] | null
}

// ============================================================================
// CARDS
// ============================================================================

export async function getCards(): Promise<Card[]> {
  const userId = getUserId()

  const { data: cards, error } = await supabase
    .from('cards')
    .select(`
      *,
      card_reviews(*),
      card_evaluations(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to get cards: ${error.message}`)

  return (cards as SupabaseCardWithRelations[]).map(card => {
    const reviews = card.card_reviews || []
    const evaluation = card.card_evaluations?.[0]
    return supabaseCardToLocal(card, reviews, evaluation)
  })
}

export async function saveCards(cards: Card[]): Promise<void> {
  // This is a bulk operation - for simplicity, we'll update each card
  // In production, consider using a more efficient approach
  for (const card of cards) {
    await updateCard(card)
  }
}

export async function addCard(card: Card): Promise<void> {
  const userId = getUserId()

  const { data: insertedCard, error } = await supabase
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

  if (error) throw new Error(`Failed to add card: ${error.message}`)

  // Update the card ID in case it was generated
  card.id = insertedCard.id
}

export async function updateCard(updated: Card): Promise<void> {
  const userId = getUserId()

  // First, update the card
  const { error: cardError } = await supabase
    .from('cards')
    .update({
      type: updated.type,
      prompt: updated.prompt,
      expected_context: updated.expectedContext || null,
      image_url: updated.imageUrl || null,
      target_vocabulary: updated.targetVocabulary || null,
      context: updated.context || null,
      theme: updated.theme || null,
      last_reviewed_at: updated.lastReviewedAt || null,
      next_review_at: updated.nextReviewAt || null,
      ease_factor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
    })
    .eq('id', updated.id)
    .eq('user_id', userId)

  if (cardError) throw new Error(`Failed to update card: ${cardError.message}`)

  // Update latest evaluation if present
  if (updated.latestEvaluation) {
    const { data: existingEval } = await supabase
      .from('card_evaluations')
      .select('id')
      .eq('card_id', updated.id)
      .maybeSingle()

    const evalData = {
      card_id: updated.id,
      user_id: userId,
      score: updated.latestEvaluation.score,
      user_transcription: updated.latestEvaluation.userTranscription,
      corrected_version: updated.latestEvaluation.correctedVersion,
      better_alternatives: updated.latestEvaluation.betterAlternatives,
      corrections: updated.latestEvaluation.corrections,
      overall_feedback: updated.latestEvaluation.overallFeedback,
    }

    if (existingEval) {
      await supabase
        .from('card_evaluations')
        .update(evalData)
        .eq('id', existingEval.id)
    } else {
      await supabase
        .from('card_evaluations')
        .insert(evalData)
    }
  }
}

export async function deleteCard(id: string): Promise<void> {
  const userId = getUserId()

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to delete card: ${error.message}`)
}

export async function getCardById(id: string): Promise<Card | undefined> {
  const cards = await getCards()
  return cards.find(c => c.id === id)
}

export async function getCardsDueForReview(): Promise<Card[]> {
  const userId = getUserId()
  const now = new Date().toISOString()

  const { data: cards, error } = await supabase
    .from('cards')
    .select(`
      *,
      card_reviews(*),
      card_evaluations(*)
    `)
    .eq('user_id', userId)
    .lte('next_review_at', now)
    .order('next_review_at', { ascending: true })

  if (error) throw new Error(`Failed to get cards due for review: ${error.message}`)

  return (cards as SupabaseCardWithRelations[]).map(card => {
    const reviews = card.card_reviews || []
    const evaluation = card.card_evaluations?.[0]
    return supabaseCardToLocal(card, reviews, evaluation)
  })
}

// ============================================================================
// GAMIFICATION
// ============================================================================

const DEFAULT_GAMIFICATION: GamificationState = {
  xp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastPracticeDate: null,
  totalSessions: 0,
  totalCards: 0,
  badges: [],
}

export async function getGamification(): Promise<GamificationState> {
  const userId = getUserId()

  const { data: gami, error } = await supabase
    .from('gamification')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to get gamification: ${error.message}`)
  }

  if (!gami) {
    return { ...DEFAULT_GAMIFICATION }
  }

  const { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('*')
    .eq('user_id', userId)

  if (badgesError) {
    throw new Error(`Failed to get badges: ${badgesError.message}`)
  }

  return {
    xp: gami.xp,
    level: gami.level,
    streak: gami.streak,
    longestStreak: gami.longest_streak,
    lastPracticeDate: gami.last_practice_date,
    totalSessions: gami.total_sessions,
    totalCards: gami.total_cards,
    badges: (badges || []).map((b: Badge) => ({
      id: b.badge_id,
      name: b.name,
      description: b.description || '',
      icon: b.icon || '',
      earnedAt: b.earned_at,
    })),
  }
}

export async function saveGamification(state: GamificationState): Promise<void> {
  const userId = getUserId()

  // Check if record exists
  const { data: existing } = await supabase
    .from('gamification')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const gamiData = {
    user_id: userId,
    xp: state.xp,
    level: state.level,
    streak: state.streak,
    longest_streak: state.longestStreak,
    last_practice_date: state.lastPracticeDate,
    total_sessions: state.totalSessions,
    total_cards: state.totalCards,
  }

  if (existing) {
    const { error } = await supabase
      .from('gamification')
      .update(gamiData)
      .eq('id', existing.id)

    if (error) throw new Error(`Failed to update gamification: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('gamification')
      .insert(gamiData)

    if (error) throw new Error(`Failed to create gamification: ${error.message}`)
  }

  // Sync badges
  await syncBadges(userId, state.badges)
}

async function syncBadges(userId: string, badges: LocalBadge[]): Promise<void> {
  // Get existing badges
  const { data: existing } = await supabase
    .from('badges')
    .select('badge_id')
    .eq('user_id', userId)

  const existingIds = new Set(existing?.map(b => b.badge_id) || [])

  // Insert new badges
  for (const badge of badges) {
    if (!existingIds.has(badge.id)) {
      await supabase
        .from('badges')
        .insert({
          user_id: userId,
          badge_id: badge.id,
          name: badge.name,
          description: badge.description || null,
          icon: badge.icon || null,
          earned_at: badge.earnedAt,
        })
    }
  }
}

// ============================================================================
// LIVE SESSIONS
// ============================================================================

export async function getLiveSessions(): Promise<LiveSession[]> {
  const userId = getUserId()

  const { data: sessions, error } = await supabase
    .from('live_sessions')
    .select(`
      *,
      conversation_turns(*),
      conversation_analyses(*)
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (error) throw new Error(`Failed to get live sessions: ${error.message}`)

  return sessions.map(session => ({
    id: session.id,
    scenario: session.scenario,
    turns: (session.conversation_turns || []).map((t: ConversationTurn) => ({
      role: t.role,
      text: t.text,
      audioBlob: t.audio_path || undefined,
      timestamp: t.timestamp,
    })),
    analysis: session.conversation_analyses?.[0] ? {
      improvements: session.conversation_analyses[0].improvements || [],
      cleanDialogue: session.conversation_analyses[0].clean_dialogue || [],
      overallFeedback: session.conversation_analyses[0].overall_feedback || '',
      dialogueAudioUrl: session.conversation_analyses[0].dialogue_audio_path || undefined,
    } : undefined,
    startedAt: session.started_at,
    endedAt: session.ended_at || undefined,
  }))
}

export async function saveLiveSession(session: LiveSession): Promise<void> {
  const userId = getUserId()

  // Check if session exists
  const { data: existing } = await supabase
    .from('live_sessions')
    .select('id')
    .eq('id', session.id)
    .maybeSingle()

  const sessionData = {
    user_id: userId,
    scenario: session.scenario,
    turn_count: session.turns.length,
    started_at: session.startedAt,
    ended_at: session.endedAt || null,
  }

  if (existing) {
    await supabase
      .from('live_sessions')
      .update(sessionData)
      .eq('id', session.id)

    // Delete existing turns and analysis (will be recreated)
    await supabase
      .from('conversation_turns')
      .delete()
      .eq('live_session_id', session.id)

    await supabase
      .from('conversation_analyses')
      .delete()
      .eq('live_session_id', session.id)
  } else {
    await supabase
      .from('live_sessions')
      .insert({ id: session.id, ...sessionData })
  }

  // Insert conversation turns
  if (session.turns.length > 0) {
    await supabase
      .from('conversation_turns')
      .insert(session.turns.map(t => ({
        live_session_id: session.id,
        user_id: userId,
        role: t.role,
        text: t.text,
        audio_path: t.audioBlob || null,
        timestamp: t.timestamp,
      })))
  }

  // Insert conversation analysis
  if (session.analysis) {
    await supabase
      .from('conversation_analyses')
      .insert({
        live_session_id: session.id,
        user_id: userId,
        improvements: session.analysis.improvements,
        clean_dialogue: session.analysis.cleanDialogue,
        overall_feedback: session.analysis.overallFeedback,
        dialogue_audio_path: session.analysis.dialogueAudioUrl || null,
      })
  }
}

export async function clearLiveSessions(): Promise<void> {
  const userId = getUserId()

  const { error } = await supabase
    .from('live_sessions')
    .delete()
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to clear live sessions: ${error.message}`)
}

// ============================================================================
// PATH PROGRESS
// ============================================================================

const DEFAULT_PATH_PROGRESS: PathProgress = { completedSteps: {} }

export async function getPathProgress(): Promise<PathProgress> {
  const userId = getUserId()

  const { data: progress, error } = await supabase
    .from('path_progress')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    return { ...DEFAULT_PATH_PROGRESS }
  }

  const result: PathProgress = { completedSteps: {} }

  for (const p of progress || []) {
    if (!result.completedSteps[p.trail_id]) {
      result.completedSteps[p.trail_id] = []
    }
    result.completedSteps[p.trail_id].push(p.step_id)
  }

  return result
}

export async function savePathProgress(progress: PathProgress): Promise<void> {
  const userId = getUserId()

  // Get existing progress
  const { data: existing } = await supabase
    .from('path_progress')
    .select('id, trail_id, step_id')
    .eq('user_id', userId)

  const existingKey = new Set(existing?.map(e => `${e.trail_id}:${e.step_id}`) || [])

  // Insert new progress entries
  for (const [trailId, steps] of Object.entries(progress.completedSteps)) {
    for (const stepId of steps) {
      const key = `${trailId}:${stepId}`
      if (!existingKey.has(key)) {
        await supabase
          .from('path_progress')
          .insert({
            user_id: userId,
            trail_id: trailId,
            step_id: stepId,
          })
      }
    }
  }
}

export async function markStepComplete(trailId: string, stepId: string): Promise<void> {
  const userId = getUserId()

  // Check if already exists
  const { data: existing } = await supabase
    .from('path_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('trail_id', trailId)
    .eq('step_id', stepId)
    .maybeSingle()

  if (!existing) {
    await supabase
      .from('path_progress')
      .insert({
        user_id: userId,
        trail_id: trailId,
        step_id: stepId,
      })
  }
}

export async function isStepComplete(trailId: string, stepId: string): Promise<boolean> {
  const userId = getUserId()

  const { data } = await supabase
    .from('path_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('trail_id', trailId)
    .eq('step_id', stepId)
    .maybeSingle()

  return !!data
}

export async function getTrailCompletedCount(trailId: string): Promise<number> {
  const userId = getUserId()

  const { count, error } = await supabase
    .from('path_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('trail_id', trailId)

  if (error) throw new Error(`Failed to get trail completed count: ${error.message}`)

  return count || 0
}

// ============================================================================
// SESSION REPORTS
// ============================================================================

const MAX_SESSION_REPORTS = 200

export async function getSessionReports(): Promise<SessionReport[]> {
  const userId = getUserId()

  const { data: reports, error } = await supabase
    .from('session_reports')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to get session reports: ${error.message}`)

  return (reports || []).map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    exercisesCompleted: r.exercises_completed,
    scores: (r.scores as number[]) || [],
    averageScore: r.average_score ? Number(r.average_score) : 0,
    errorsFound: r.errors_found,
    xpEarned: r.xp_earned,
    timeSpentSeconds: r.time_spent_seconds,
    improvements: (r.improvements as string[]) || [],
  }))
}

export async function saveSessionReport(report: SessionReport): Promise<void> {
  const userId = getUserId()

  // Clean up old reports if needed
  const { data: existingReports } = await supabase
    .from('session_reports')
    .select('id, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (existingReports && existingReports.length >= MAX_SESSION_REPORTS) {
    // Delete oldest reports
    const toDelete = existingReports.slice(MAX_SESSION_REPORTS - 1)
    for (const report of toDelete) {
      await supabase
        .from('session_reports')
        .delete()
        .eq('id', report.id)
    }
  }

  const { error } = await supabase
    .from('session_reports')
    .insert({
      user_id: userId,
      date: report.date,
      type: report.type,
      exercises_completed: report.exercisesCompleted,
      scores: report.scores.length > 0 ? report.scores : null,
      average_score: report.averageScore || null,
      errors_found: report.errorsFound,
      xp_earned: report.xpEarned,
      time_spent_seconds: report.timeSpentSeconds,
      improvements: report.improvements.length > 0 ? report.improvements : null,
    })

  if (error) throw new Error(`Failed to save session report: ${error.message}`)
}

export async function getSessionReportsByDateRange(startDate: string, endDate: string): Promise<SessionReport[]> {
  const userId = getUserId()

  const { data: reports, error } = await supabase
    .from('session_reports')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to get session reports by date range: ${error.message}`)

  return (reports || []).map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    exercisesCompleted: r.exercises_completed,
    scores: (r.scores as number[]) || [],
    averageScore: r.average_score ? Number(r.average_score) : 0,
    errorsFound: r.errors_found,
    xpEarned: r.xp_earned,
    timeSpentSeconds: r.time_spent_seconds,
    improvements: (r.improvements as string[]) || [],
  }))
}

export async function getLatestSessionReports(limit: number): Promise<SessionReport[]> {
  const userId = getUserId()

  const { data: reports, error } = await supabase
    .from('session_reports')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to get latest session reports: ${error.message}`)

  return (reports || []).map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    exercisesCompleted: r.exercises_completed,
    scores: (r.scores as number[]) || [],
    averageScore: r.average_score ? Number(r.average_score) : 0,
    errorsFound: r.errors_found,
    xpEarned: r.xp_earned,
    timeSpentSeconds: r.time_spent_seconds,
    improvements: (r.improvements as string[]) || [],
  }))
}

// ============================================================================
// MODEL CONFIG
// ============================================================================

export async function getModelConfig(): Promise<ModelConfig> {
  const userId = getUserId()

  const { data: config, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !config) {
    return { ...DEFAULT_MODEL_CONFIG }
  }

  // DB columns may use old _provider suffix or new _source suffix
  const raw = {
    chatModel: config.chat_model,
    chatProvider: config.chat_provider,
    chatSource: config.chat_source,
    sttModel: config.stt_model,
    sttProvider: config.stt_provider,
    sttSource: config.stt_source,
    ttsModel: config.tts_model,
    ttsVoice: config.tts_voice,
    ttsProvider: config.tts_provider,
    ttsSource: config.tts_source,
    imageModel: config.image_model,
    imageProvider: config.image_provider,
    imageSource: config.image_source,
    liveModel: config.live_model,
    liveVoice: config.live_voice,
    liveProvider: config.live_provider,
    liveSource: config.live_source,
    chatFallbackModel: config.chat_fallback_model || undefined,
    chatFallbackProvider: config.chat_fallback_provider || undefined,
    chatFallbackSource: config.chat_fallback_source || undefined,
    sttFallbackModel: config.stt_fallback_model || undefined,
    sttFallbackProvider: config.stt_fallback_provider || undefined,
    sttFallbackSource: config.stt_fallback_source || undefined,
    ttsFallbackModel: config.tts_fallback_model || undefined,
    ttsFallbackProvider: config.tts_fallback_provider || undefined,
    ttsFallbackSource: config.tts_fallback_source || undefined,
    ttsFallbackVoice: config.tts_fallback_voice || undefined,
  }

  return migrateModelConfig(raw as Record<string, unknown>)
}

export async function saveModelConfig(config: ModelConfig): Promise<void> {
  const userId = getUserId()

  // Check if config exists
  const { data: existing } = await supabase
    .from('model_config')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const configData = {
    user_id: userId,
    chat_model: config.chatModel,
    chat_source: config.chatSource,
    stt_model: config.sttModel,
    stt_source: config.sttSource,
    tts_model: config.ttsModel,
    tts_voice: config.ttsVoice,
    tts_source: config.ttsSource,
    image_model: config.imageModel,
    image_source: config.imageSource,
    live_model: config.liveModel,
    live_voice: config.liveVoice,
    live_source: config.liveSource,
    chat_fallback_model: config.chatFallbackModel || null,
    chat_fallback_source: config.chatFallbackSource || null,
    stt_fallback_model: config.sttFallbackModel || null,
    stt_fallback_source: config.sttFallbackSource || null,
    tts_fallback_model: config.ttsFallbackModel || null,
    tts_fallback_source: config.ttsFallbackSource || null,
    tts_fallback_voice: config.ttsFallbackVoice || null,
  }

  if (existing) {
    await supabase
      .from('model_config')
      .update(configData)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('model_config')
      .insert(configData)
  }
}

// ============================================================================
// CONVERSATION TONE
// ============================================================================

export async function getConversationTone(): Promise<ConversationTone> {
  const userId = getUserId()

  const { data: profile } = await supabase
    .from('profiles')
    .select('conversation_tone')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return 'balanced'

  const tone = profile.conversation_tone
  if (tone === 'casual' || tone === 'balanced' || tone === 'formal') {
    return tone
  }
  return 'balanced'
}

export async function saveConversationTone(tone: ConversationTone): Promise<void> {
  const userId = getUserId()

  await supabase
    .from('profiles')
    .update({ conversation_tone: tone })
    .eq('id', userId)
}

// ============================================================================
// API KEYS (via Edge Function for security)
// ============================================================================

/**
 * Map source name to DB provider column name.
 * The DB still uses 'gemini' in column names; 'genai' source maps to 'gemini' key.
 * Only sources with existing DB columns are mapped; others are ignored.
 */
function sourceToDbProvider(source: string): string | null {
  const mapping: Record<string, string> = {
    gemini: 'gemini',
    genai: 'gemini',
    openai: 'openai',
    groq: 'groq',
    openrouter: 'openrouter',
  }
  return mapping[source] ?? null
}

function edgeFunctionHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'x-client-info': 'llmenglish-web',
  }
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const sessionResult = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession()

  const session = sessionResult.data.session
  if (!session) {
    throw new Error('Not authenticated')
  }

  return session.access_token
}

async function edgeFunctionFetch(body: unknown): Promise<Response> {
  let accessToken = await getAccessToken()
  let response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`,
    {
      method: 'POST',
      headers: edgeFunctionHeaders(accessToken),
      body: JSON.stringify(body),
    }
  )

  if (response.status === 401) {
    accessToken = await getAccessToken(true)
    response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: edgeFunctionHeaders(accessToken),
        body: JSON.stringify(body),
      }
    )
  }

  return response
}

/**
 * Save an API key (encrypted via Edge Function)
 */
export async function saveApiKey(source: string, key: string): Promise<void> {
  const provider = sourceToDbProvider(source)
  if (!provider) return // no DB column for this source yet

  const response = await edgeFunctionFetch({
    action: 'save_key',
    provider,
    key,
  })

  if (!response.ok) {
    throw new Error('Failed to save API key')
  }
}

/**
 * Get an API key (decrypted via Edge Function)
 */
export async function getApiKey(source: string): Promise<string> {
  const provider = sourceToDbProvider(source)
  if (!provider) return '' // no DB column for this source yet

  const response = await edgeFunctionFetch({
    action: 'get_key',
    provider,
  })

  if (!response.ok) {
    throw new Error('Failed to get API key')
  }

  const data = await response.json()
  return data.key || ''
}

/**
 * Save all API keys at once
 */
export async function saveApiKeys(keys: Record<string, string>): Promise<void> {
  // Map source names to DB provider names, skip unmapped sources
  const mapped: Record<string, string> = {}
  for (const [source, key] of Object.entries(keys)) {
    if (!key) continue
    const provider = sourceToDbProvider(source)
    if (provider) {
      mapped[provider] = key
    }
  }

  if (Object.keys(mapped).length === 0) return

  const response = await edgeFunctionFetch({
    action: 'save_keys',
    keys: mapped,
  })

  if (!response.ok) {
    throw new Error('Failed to save API keys')
  }
}

