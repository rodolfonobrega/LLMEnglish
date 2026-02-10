import { getCards } from './storage';
import type { Card, EvaluationResult } from '../types/card';
import type { ErrorPattern, ErrorCategory, ErrorStats, WeakAreas } from '../types/errors';

// Storage key for error patterns
const ERRORS_KEY = 'el_error_patterns';

// --- Error Pattern Extraction ---

/**
 * Extract error patterns from an evaluation result using AI
 */
export async function extractErrorPatterns(
  evaluation: EvaluationResult,
  cardPrompt: string,
  cardId: string
): Promise<ErrorPattern[]> {
  // For now, use a simpler heuristic approach
  // In production, you'd use AI to categorize errors
  const patterns: ErrorPattern[] = [];

  // Extract from corrections
  for (const correction of evaluation.corrections) {
    const category = guessCategory(correction);
    const pattern = createPatternFromCorrection(correction, category, cardPrompt, evaluation, cardId);
    if (pattern) patterns.push(pattern);
  }

  // Extract from pronunciation feedback
  if (evaluation.pronunciationFeedback.tips.length > 0) {
    const pattern = createPronunciationPattern(evaluation, cardPrompt, cardId);
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}

function guessCategory(correction: string): ErrorCategory {
  const lower = correction.toLowerCase();
  if (lower.includes('tense') || lower.includes('past') || lower.includes('present') || lower.includes('future')) {
    return 'verb-tense';
  }
  if (lower.includes('preposition') || lower.includes('in ') || lower.includes('on ') || lower.includes('at ')) {
    return 'preposition';
  }
  if (lower.includes('article') || lower.includes('a ') || lower.includes('an ') || lower.includes('the ')) {
    return 'article';
  }
  if (lower.includes('word order') || lower.includes('should be')) {
    return 'word-order';
  }
  if (lower.includes('grammar')) {
    return 'grammar';
  }
  if (lower.includes('pronunciation') || lower.includes('sounds')) {
    return 'pronunciation';
  }
  if (lower.includes('vocabulary') || lower.includes('word')) {
    return 'vocabulary';
  }
  return 'other';
}

function createPatternFromCorrection(
  correction: string,
  category: ErrorCategory,
  prompt: string,
  evaluation: EvaluationResult,
  cardId: string
): ErrorPattern | null {
  // Create a pattern ID from the correction
  const patternId = `${category}_${correction.slice(0, 30).replace(/\s+/g, '_')}`;

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
  };
}

function createPronunciationPattern(
  evaluation: EvaluationResult,
  prompt: string,
  cardId: string
): ErrorPattern | null {
  const patternId = `pronunciation_${Date.now()}`;

  return {
    id: patternId,
    pattern: evaluation.pronunciationFeedback.tips.join('; '),
    category: 'pronunciation',
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
  };
}

// --- Error Storage ---

function getStoredPatterns(): ErrorPattern[] {
  try {
    const raw = localStorage.getItem(ERRORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePatterns(patterns: ErrorPattern[]): void {
  localStorage.setItem(ERRORS_KEY, JSON.stringify(patterns));
}

/**
 * Add new error patterns from an evaluation
 */
export function recordErrorPatterns(
  patterns: ErrorPattern[]
): void {
  const stored = getStoredPatterns();

  for (const newPattern of patterns) {
    const existing = stored.find(p => p.id === newPattern.id);

    if (existing) {
      // Update existing pattern
      existing.occurrences += 1;
      existing.lastSeen = new Date().toISOString();
      existing.recentScores.push(newPattern.examples[0].score);
      existing.examples.unshift(newPattern.examples[0]);

      // Keep only last 10 examples and scores
      if (existing.examples.length > 10) existing.examples = existing.examples.slice(0, 10);
      if (existing.recentScores.length > 10) existing.recentScores = existing.recentScores.slice(0, 10);

      // Update trend
      existing.trend = calculateTrend(existing.recentScores);
    } else {
      // Add new pattern
      stored.push(newPattern);
    }
  }

  savePatterns(stored);
}

function calculateTrend(scores: number[]): 'improving' | 'stable' | 'worsening' {
  if (scores.length < 3) return 'stable';

  const recent = scores.slice(0, 3);
  const older = scores.slice(3, 6);

  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  if (recentAvg > olderAvg + 0.5) return 'improving';
  if (recentAvg < olderAvg - 0.5) return 'worsening';
  return 'stable';
}

// --- Error Statistics ---

/**
 * Get comprehensive error statistics
 */
export function getErrorStats(): ErrorStats {
  const patterns = getStoredPatterns();

  const byCategory: Record<ErrorCategory, number> = {
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
  };

  let totalErrors = 0;
  for (const pattern of patterns) {
    byCategory[pattern.category] += pattern.occurrences;
    totalErrors += pattern.occurrences;
  }

  // Sort by frequency
  const mostFrequent = [...patterns]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  // Critical errors: high occurrence, low scores, worsening trend
  const criticalErrors = patterns
    .filter(p => p.occurrences >= 3 && p.trend === 'worsening')
    .sort((a, b) => {
      const aAvg = a.recentScores.reduce((x, y) => x + y, 0) / a.recentScores.length;
      const bAvg = b.recentScores.reduce((x, y) => x + y, 0) / b.recentScores.length;
      return aAvg - bAvg;
    })
    .slice(0, 5);

  // Needs attention: occurring frequently but not improving
  const needsAttention = patterns
    .filter(p => p.occurrences >= 2 && p.trend !== 'improving')
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  return {
    totalErrors,
    byCategory,
    mostFrequent,
    criticalErrors,
    needsAttention,
  };
}

/**
 * Identify user's weak areas based on error patterns
 */
export function identifyWeakAreas(): WeakAreas {
  const stats = getErrorStats();

  // Find categories with most errors
  const categoriesByErrors = Object.entries(stats.byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat as ErrorCategory);

  // Get most common patterns
  const patterns = stats.mostFrequent.slice(0, 5).map(p => p.pattern);

  // Generate recommended focus
  let recommendedFocus = 'General practice';
  if (categoriesByErrors.length > 0) {
    const topCategory = categoriesByErrors[0];
    recommendedFocus = getCategoryFocus(topCategory);
  }

  return {
    categories: categoriesByErrors,
    patterns,
    recommendedFocus,
  };
}

function getCategoryFocus(category: ErrorCategory): string {
  const focusMap: Record<ErrorCategory, string> = {
    'grammar': 'Grammar fundamentals and sentence structure',
    'pronunciation': 'Pronunciation practice with shadowing',
    'vocabulary': 'Vocabulary building and word usage',
    'fluency': 'Speaking fluency and connected speech',
    'syntax': 'Sentence construction and word order',
    'preposition': 'Preposition usage in context',
    'verb-tense': 'Verb tenses and conjugation',
    'article': 'Article usage (a, an, the)',
    'word-order': 'Word order in sentences',
    'other': 'General English practice',
  };
  return focusMap[category];
}

/**
 * Find cards that match specific weak areas
 */
export function getCardsForWeakArea(_weakArea: ErrorCategory): Card[] {
  const allCards = getCards();
  // Simple approach: return cards with low scores
  // In production, you'd use semantic matching
  return allCards
    .filter(c => c.latestEvaluation && c.latestEvaluation.score < 7)
    .sort((a, b) => {
      const aScore = a.latestEvaluation?.score || 0;
      const bScore = b.latestEvaluation?.score || 0;
      return aScore - bScore;
    })
    .slice(0, 10);
}

/**
 * Get cards prioritized for review based on weak areas
 */
export function getPrioritizedReviewCards(limit: number = 10): Card[] {
  const allCards = getCards();

  // Score cards based on:
  // 1. Due for review (higher priority)
  // 2. Low previous scores
  // 3. Related to weak areas
  const scoredCards = allCards.map(card => {
    let priorityScore = 0;

    // Is due for review?
    const isDue = card.nextReviewAt && new Date(card.nextReviewAt) <= new Date();
    if (isDue) priorityScore += 100;

    // Low previous score?
    const avgScore = card.reviews.length > 0
      ? card.reviews.reduce((a, b) => a + b.score, 0) / card.reviews.length
      : 10;
    priorityScore += (10 - avgScore) * 5;

    // Related to weak areas? (simple heuristic)
    if (card.latestEvaluation && card.latestEvaluation.score < 7) {
      priorityScore += 20;
    }

    return { card, priorityScore };
  });

  return scoredCards
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
    .map(item => item.card);
}

/**
 * Clear all error patterns (for testing or reset)
 */
export function clearErrorPatterns(): void {
  localStorage.removeItem(ERRORS_KEY);
}
