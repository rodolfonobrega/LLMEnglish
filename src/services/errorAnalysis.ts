import { getCurrentUser } from './supabase/auth'
import { supabase } from './supabase/client'
import { getCards } from './storage'
import type { Card, EvaluationResult } from '../types/card'
import type {
  ErrorCategory,
  ErrorCurrency,
  ErrorPattern,
  ErrorStats,
  ProgressSummary,
  ProgressTimeline,
  SessionSnapshot,
  WeakAreas,
} from '../types/errors'
import type { ErrorPatternRow, ErrorSnapshotRow } from '../types/supabase'

const ERROR_CATEGORIES: ErrorCategory[] = [
  'grammar',
  'pronunciation',
  'vocabulary',
  'fluency',
  'syntax',
  'preposition',
  'verb-tense',
  'article',
  'word-order',
  'other',
]

function getUserId(): string {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('User not authenticated')
  }
  return user.id
}

function emptyCategoryCounts(): Record<ErrorCategory, number> {
  return {
    grammar: 0,
    pronunciation: 0,
    vocabulary: 0,
    fluency: 0,
    syntax: 0,
    preposition: 0,
    'verb-tense': 0,
    article: 0,
    'word-order': 0,
    other: 0,
  }
}

function mapPatternRow(row: ErrorPatternRow): ErrorPattern {
  return {
    id: row.pattern_key,
    pattern: row.pattern,
    category: row.category as ErrorCategory,
    occurrences: row.occurrences,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    examples: Array.isArray(row.examples) ? row.examples as unknown as ErrorPattern['examples'] : [],
    trend: row.trend,
    recentScores: Array.isArray(row.recent_scores) ? row.recent_scores.map(Number) : [],
  }
}

function mapSnapshotRow(row: ErrorSnapshotRow): SessionSnapshot {
  const rawCounts = typeof row.by_category === 'object' && row.by_category ? row.by_category as Record<string, number> : {}
  const byCategory = emptyCategoryCounts()
  for (const category of ERROR_CATEGORIES) {
    byCategory[category] = Number(rawCounts[category] || 0)
  }

  return {
    date: row.date,
    totalErrors: row.total_errors,
    averageScore: Number(row.average_score || 0),
    byCategory,
    activePatterns: row.active_patterns,
    resolvedPatterns: row.resolved_patterns,
  }
}

async function loadPatterns(): Promise<ErrorPattern[]> {
  const userId = getUserId()
  const { data, error } = await supabase
    .from('error_patterns')
    .select('*')
    .eq('user_id', userId)
    .order('occurrences', { ascending: false })
    .order('last_seen', { ascending: false })

  if (error) throw new Error(`Failed to load error patterns: ${error.message}`)
  return (data || []).map(row => mapPatternRow(row as ErrorPatternRow))
}

async function loadSnapshots(): Promise<SessionSnapshot[]> {
  const userId = getUserId()
  const { data, error } = await supabase
    .from('error_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to load error snapshots: ${error.message}`)
  return (data || []).map(row => mapSnapshotRow(row as ErrorSnapshotRow))
}

function buildErrorStats(patterns: ErrorPattern[]): ErrorStats {
  const byCategory = emptyCategoryCounts()
  let totalErrors = 0

  for (const pattern of patterns) {
    byCategory[pattern.category] += pattern.occurrences
    totalErrors += pattern.occurrences
  }

  const mostFrequent = [...patterns]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10)

  const safeAvg = (scores: number[]) =>
    scores.length > 0 ? scores.reduce((x, y) => x + y, 0) / scores.length : 0

  const criticalErrors = patterns
    .filter(pattern => pattern.occurrences >= 3 && pattern.trend === 'worsening')
    .sort((a, b) => safeAvg(a.recentScores) - safeAvg(b.recentScores))
    .slice(0, 5)

  const needsAttention = patterns
    .filter(pattern => pattern.occurrences >= 2 && pattern.trend !== 'improving')
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10)

  return {
    totalErrors,
    byCategory,
    mostFrequent,
    criticalErrors,
    needsAttention,
  }
}

function calculateTrend(scores: number[]): 'improving' | 'stable' | 'worsening' {
  if (scores.length < 3) return 'stable'

  const recent = scores.slice(0, 3)
  const older = scores.slice(3, 6)

  if (older.length === 0) return 'stable'

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

  if (recentAvg > olderAvg + 0.5) return 'improving'
  if (recentAvg < olderAvg - 0.5) return 'worsening'
  return 'stable'
}

function getCategoryFocus(category: ErrorCategory): string {
  const focusMap: Record<ErrorCategory, string> = {
    grammar: 'Grammar fundamentals and sentence structure',
    pronunciation: 'Pronunciation practice with shadowing',
    vocabulary: 'Vocabulary building and word usage',
    fluency: 'Speaking fluency and connected speech',
    syntax: 'Sentence construction and word order',
    preposition: 'Preposition usage in context',
    'verb-tense': 'Verb tenses and conjugation',
    article: 'Article usage (a, an, the)',
    'word-order': 'Word order in sentences',
    other: 'General English practice',
  }
  return focusMap[category]
}

/**
 * Extract error patterns from an evaluation result using AI
 */
export async function extractErrorPatterns(
  evaluation: EvaluationResult,
  cardPrompt: string,
  cardId: string
): Promise<ErrorPattern[]> {
  const patterns: ErrorPattern[] = []

  for (const correction of evaluation.corrections) {
    const category = guessCategory(correction)
    const pattern = createPatternFromCorrection(correction, category, cardPrompt, evaluation, cardId)
    if (pattern) patterns.push(pattern)
  }

  return patterns
}

function guessCategory(correction: string): ErrorCategory {
  const lower = correction.toLowerCase()
  // Check explicit category keywords first (highest priority)
  if (lower.includes('tense') || lower.includes('past') || lower.includes('present') || lower.includes('future')) {
    return 'verb-tense'
  }
  if (lower.includes('preposition')) {
    return 'preposition'
  }
  if (lower.includes('article')) {
    return 'article'
  }
  if (lower.includes('word order') || lower.includes('should be')) {
    return 'word-order'
  }
  if (lower.includes('grammar')) {
    return 'grammar'
  }
  if (lower.includes('pronunciation') || lower.includes('sounds')) {
    return 'pronunciation'
  }
  if (lower.includes('vocabulary') || lower.includes('word choice') || lower.includes('wrong word')) {
    return 'vocabulary'
  }
  if (lower.includes('fluency') || lower.includes('natural') || lower.includes('phrasing')) {
    return 'fluency'
  }
  // Fallback: only match short substrings if they appear as corrections themselves
  // (e.g., "Use 'in' instead of 'on'" -- the preposition IS the topic)
  if (/\b(in|on|at|to|for|with|by|from)\b.*\b(instead|rather|use|should)\b/i.test(lower) ||
      /\b(instead|rather|use|should)\b.*\b(in|on|at|to|for|with|by|from)\b/i.test(lower)) {
    return 'preposition'
  }
  // Only use unambiguous articles 'an' and 'the' in fallback context — 'a' is too common
  if (/\b(an|the)\b.*\b(instead|use|should)\b/i.test(lower) ||
      /\b(instead|use|should)\b.*\b(an|the)\b/i.test(lower)) {
    return 'article'
  }
  return 'other'
}

function createPatternFromCorrection(
  correction: string,
  category: ErrorCategory,
  prompt: string,
  evaluation: EvaluationResult,
  cardId: string
): ErrorPattern | null {
  const patternId = `${category}_${correction.slice(0, 30).replace(/\s+/g, '_')}`

  return {
    id: patternId,
    pattern: correction,
    category,
    occurrences: 1,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    examples: [{
      cardId,
      date: new Date().toISOString(),
      userTranscription: evaluation.userTranscription,
      correctedVersion: evaluation.correctedVersion,
      score: evaluation.score,
      prompt,
    }],
    trend: 'stable',
    recentScores: [evaluation.score],
  }
}

export async function recordErrorPatterns(patterns: ErrorPattern[]): Promise<void> {
  if (patterns.length === 0) return

  const userId = getUserId()
  const keys = patterns.map(pattern => pattern.id)
  const { data, error } = await supabase
    .from('error_patterns')
    .select('*')
    .eq('user_id', userId)
    .in('pattern_key', keys)

  if (error) throw new Error(`Failed to load existing error patterns: ${error.message}`)

  const existingByKey = new Map((data || []).map(row => [row.pattern_key, mapPatternRow(row as ErrorPatternRow)]))

  for (const newPattern of patterns) {
    const existing = existingByKey.get(newPattern.id)
    if (existing) {
      const recentScores = [...existing.recentScores, ...newPattern.recentScores].slice(-10)
      const examples = [newPattern.examples[0], ...existing.examples].slice(0, 10)
      const updated = {
        pattern: newPattern.pattern,
        category: newPattern.category,
        occurrences: existing.occurrences + 1,
        last_seen: new Date().toISOString(),
        examples,
        recent_scores: recentScores,
        trend: calculateTrend(recentScores),
      }

      const { error: updateError } = await supabase
        .from('error_patterns')
        .update(updated)
        .eq('user_id', userId)
        .eq('pattern_key', newPattern.id)

      if (updateError) throw new Error(`Failed to update error pattern: ${updateError.message}`)
      continue
    }

    const { error: insertError } = await supabase
      .from('error_patterns')
      .insert({
        user_id: userId,
        pattern_key: newPattern.id,
        pattern: newPattern.pattern,
        category: newPattern.category,
        occurrences: newPattern.occurrences,
        first_seen: newPattern.firstSeen,
        last_seen: newPattern.lastSeen,
        examples: newPattern.examples,
        trend: newPattern.trend,
        recent_scores: newPattern.recentScores,
      })

    if (insertError) throw new Error(`Failed to insert error pattern: ${insertError.message}`)
  }
}

export async function getErrorStats(): Promise<ErrorStats> {
  const patterns = await loadPatterns()
  return buildErrorStats(patterns)
}

export async function identifyWeakAreas(): Promise<WeakAreas> {
  const stats = await getErrorStats()

  const categoriesByErrors = Object.entries(stats.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category]) => category as ErrorCategory)

  const patterns = stats.mostFrequent.slice(0, 5).map(pattern => pattern.pattern)
  const recommendedFocus = categoriesByErrors.length > 0
    ? getCategoryFocus(categoriesByErrors[0])
    : 'General practice'

  return {
    categories: categoriesByErrors,
    patterns,
    recommendedFocus,
  }
}

const categoryToCardThemes: Partial<Record<ErrorCategory, string[]>> = {
  'verb-tense': ['verb-tense', 'tense', 'grammar'],
  'preposition': ['preposition', 'grammar'],
  'article': ['article', 'grammar'],
  'word-order': ['word-order', 'grammar', 'syntax'],
  'grammar': ['grammar', 'verb-tense', 'preposition', 'article', 'word-order', 'syntax'],
  'pronunciation': ['pronunciation'],
  'vocabulary': ['vocabulary', 'vocab'],
  'fluency': ['fluency'],
  'syntax': ['syntax', 'grammar', 'word-order'],
  'other': [],
}

export async function getCardsForWeakArea(weakArea: ErrorCategory): Promise<Card[]> {
  const allCards = await getCards()
  const themeKeywords = categoryToCardThemes[weakArea] || []

  const matchingCards = allCards.filter(card => {
    if (!card.latestEvaluation || card.latestEvaluation.score >= 7) return false
    if (themeKeywords.length === 0) return true // 'other' returns all low-scoring
    const cardTheme = (card.theme || '').toLowerCase()
    const cardContext = (card.context || '').toLowerCase()
    const cardPrompt = card.prompt.toLowerCase()
    return themeKeywords.some(keyword =>
      cardTheme.includes(keyword) || cardContext.includes(keyword) || cardPrompt.includes(keyword)
    )
  })

  if (matchingCards.length === 0) {
    return allCards
      .filter(card => card.latestEvaluation && card.latestEvaluation.score < 7)
      .sort((a, b) => (a.latestEvaluation?.score || 0) - (b.latestEvaluation?.score || 0))
      .slice(0, 10)
  }

  return matchingCards
    .sort((a, b) => (a.latestEvaluation?.score || 0) - (b.latestEvaluation?.score || 0))
    .slice(0, 10)
}

export async function getPrioritizedReviewCards(limit: number = 10): Promise<Card[]> {
  const allCards = await getCards()

  return allCards
    .map(card => {
      let priorityScore = 0
      const isDue = card.nextReviewAt && new Date(card.nextReviewAt) <= new Date()
      if (isDue) priorityScore += 100

      const avgScore = card.reviews.length > 0
        ? card.reviews.reduce((a, b) => a + b.score, 0) / card.reviews.length
        : 10
      priorityScore += (10 - avgScore) * 5

      if (card.latestEvaluation && card.latestEvaluation.score < 7) {
        priorityScore += 20
      }

      return { card, priorityScore }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
    .map(item => item.card)
}

export async function clearErrorPatterns(): Promise<void> {
  const userId = getUserId()

  const { error: snapshotError } = await supabase
    .from('error_snapshots')
    .delete()
    .eq('user_id', userId)

  if (snapshotError) throw new Error(`Failed to clear error snapshots: ${snapshotError.message}`)

  const { error: patternError } = await supabase
    .from('error_patterns')
    .delete()
    .eq('user_id', userId)

  if (patternError) throw new Error(`Failed to clear error patterns: ${patternError.message}`)
}

export function getErrorCurrency(pattern: ErrorPattern): ErrorCurrency {
  const lastSeen = new Date(pattern.lastSeen).getTime()
  const now = Date.now()
  const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24)

  if (daysSince <= 14) return 'active'
  if (daysSince <= 60) return 'dormant'
  return 'resolved'
}

export async function recordSessionSnapshot(): Promise<void> {
  const userId = getUserId()
  const patterns = await loadPatterns()
  const stats = buildErrorStats(patterns)

  const activeCount = patterns.filter(pattern => getErrorCurrency(pattern) === 'active').length
  const resolvedCount = patterns.filter(pattern => getErrorCurrency(pattern) === 'resolved').length
  const allScores = patterns.flatMap(pattern => pattern.recentScores)
  const averageScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0

  const { error: insertError } = await supabase
    .from('error_snapshots')
    .insert({
      user_id: userId,
      date: new Date().toISOString(),
      total_errors: stats.totalErrors,
      average_score: averageScore,
      by_category: stats.byCategory,
      active_patterns: activeCount,
      resolved_patterns: resolvedCount,
    })

  if (insertError) throw new Error(`Failed to create error snapshot: ${insertError.message}`)

  const { data: snapshots, error: listError } = await supabase
    .from('error_snapshots')
    .select('id')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (listError) throw new Error(`Failed to list error snapshots: ${listError.message}`)

  if ((snapshots || []).length > 100) {
    const toDelete = snapshots!.slice(100).map(snapshot => snapshot.id)
    const { error: deleteError } = await supabase
      .from('error_snapshots')
      .delete()
      .in('id', toDelete)

    if (deleteError) throw new Error(`Failed to trim error snapshots: ${deleteError.message}`)
  }
}

export async function getProgressTimeline(): Promise<ProgressTimeline> {
  const snapshots = await loadSnapshots()

  if (snapshots.length < 2) {
    return { snapshots, overallTrend: 'stable' }
  }

  const mid = Math.floor(snapshots.length / 2)
  const firstHalf = snapshots.slice(0, mid)
  const secondHalf = snapshots.slice(mid)

  const firstAvg = firstHalf.reduce((a, snapshot) => a + snapshot.averageScore, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, snapshot) => a + snapshot.averageScore, 0) / secondHalf.length

  let overallTrend: 'improving' | 'stable' | 'worsening' = 'stable'
  if (secondAvg > firstAvg + 0.5) overallTrend = 'improving'
  else if (secondAvg < firstAvg - 0.5) overallTrend = 'worsening'

  return { snapshots, overallTrend }
}

export async function getProgressSummary(): Promise<ProgressSummary> {
  const [patterns, snapshots] = await Promise.all([loadPatterns(), loadSnapshots()])

  const activeCount = patterns.filter(pattern => getErrorCurrency(pattern) === 'active').length
  const resolvedCount = patterns.filter(pattern => getErrorCurrency(pattern) === 'resolved').length

  const now = Date.now()
  const msPerDay = 1000 * 60 * 60 * 24
  const last7Days = snapshots.filter(snapshot => (now - new Date(snapshot.date).getTime()) <= 7 * msPerDay)
  const prev7Days = snapshots.filter(snapshot => {
    const age = now - new Date(snapshot.date).getTime()
    return age > 7 * msPerDay && age <= 14 * msPerDay
  })

  const improvingCategories: ErrorCategory[] = []
  const worseningCategories: ErrorCategory[] = []

  if (last7Days.length > 0 && prev7Days.length > 0) {
    for (const category of ERROR_CATEGORIES) {
      const lastAvg = last7Days.reduce((a, snapshot) => a + (snapshot.byCategory[category] ?? 0), 0) / last7Days.length
      const prevAvg = prev7Days.reduce((a, snapshot) => a + (snapshot.byCategory[category] ?? 0), 0) / prev7Days.length

      if (lastAvg < prevAvg - 0.5) improvingCategories.push(category)
      else if (lastAvg > prevAvg + 0.5) worseningCategories.push(category)
    }
  }

  let text: string

  if (snapshots.length < 2 || (last7Days.length === 0 && prev7Days.length === 0)) {
    text = 'Great start! Keep practicing to see your progress over time.'
  } else {
    const parts: string[] = []

    if (improvingCategories.length > 0) {
      const names = improvingCategories.map(category => category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' '))
      parts.push(`You've improved in ${names.join(' and ')}!`)
    }

    if (resolvedCount > 0) {
      parts.push(`${resolvedCount} error pattern${resolvedCount === 1 ? '' : 's'} ${resolvedCount === 1 ? 'has' : 'have'} been resolved.`)
    }

    if (worseningCategories.length > 0) {
      const names = worseningCategories.map(category => category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' '))
      parts.push(`Keep working on ${names.join(' and ')}.`)
    } else if (activeCount > 0 && improvingCategories.length === 0 && resolvedCount === 0) {
      parts.push('Keep practicing to improve.')
    }

    text = parts.length > 0 ? parts.join(' ') : 'Keep practicing to see your progress over time.'
  }

  return {
    text,
    improvingCategories,
    worseningCategories,
    resolvedCount,
    activeCount,
  }
}

export async function getPatternsByStatus(status: ErrorCurrency): Promise<ErrorPattern[]> {
  const patterns = await loadPatterns()
  return patterns.filter(pattern => getErrorCurrency(pattern) === status)
}
