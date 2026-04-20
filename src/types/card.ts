export type CardType = 'phrase' | 'text' | 'roleplay' | 'image';

/**
 * Canonical pattern id (stable semantic identifier for an error phenomenon).
 * The actual catalogue lives in `src/services/patterns.ts` (introduced in Wave 2).
 * Kept as a plain string here to avoid coupling types to the catalogue.
 */
export type CanonicalPatternId = string;

export type CorrectionSeverity = 'critical' | 'moderate' | 'polish';

export interface CorrectionItem {
  tip: string;
  example?: string;
  /** Stable canonical pattern id (see src/services/patterns.ts). Optional — legacy entries are `undefined`. */
  canonical_pattern?: CanonicalPatternId;
  /** How impactful the correction is for the current utterance. */
  severity?: CorrectionSeverity;
}

/**
 * Five-dimensional scorecard (each axis on a 0..100 scale).
 * - naturalness: sounds like a native speaker in the target register
 * - accuracy: grammar/vocabulary correctness
 * - fluency: rhythm, filler usage, connected speech
 * - pragmatics: register, politeness, situational fit
 * - completeness: covers the prompt fully
 */
export interface Scores5D {
  naturalness: number;
  accuracy: number;
  fluency: number;
  pragmatics: number;
  completeness: number;
}

export type ScoreDimension = keyof Scores5D;

export const SCORE_DIMENSIONS: readonly ScoreDimension[] = [
  'naturalness',
  'accuracy',
  'fluency',
  'pragmatics',
  'completeness',
] as const;

/** Optional fluency-related metrics computed client-side (e.g. narrative wpm). */
export interface FluencyStats {
  /** Speaking rate in words per minute, derived from the transcription + duration. */
  wpm?: number;
}

export interface EvaluationResult {
  score: number;
  userTranscription: string;
  correctedVersion: string;
  betterAlternatives: string[];
  highlights?: string[];
  /** New format: array of {tip, example}. Legacy data may still be string[]. */
  corrections: CorrectionItem[] | string[];
  /** 5D scorecard. Optional — legacy evaluations only have `score`. */
  scores5d?: Scores5D;
  /** The dimension the tutor considers most impactful for this response. */
  primaryDimension?: ScoreDimension;
  /** Optional fluency metrics attached to the evaluation (Wave 4 F28 narrative). */
  fluency_stats?: FluencyStats;
  // TODO: Reactivate pronunciation feedback when a solid phonetic model is implemented
  /* pronunciationFeedback?: {
    rhythm: string;
    intonation: string;
    connectedSpeech: string;
    tips: string[];
  }; */
  overallFeedback: string;
}

/** Normalize a correction entry (legacy string or new object) into CorrectionItem. */
export function normalizeCorrectionItem(item: CorrectionItem | string): CorrectionItem {
  if (typeof item === 'string') return { tip: item };
  return item;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Derive a 5D scorecard from a legacy 0..10 scalar by scaling each axis identically.
 * Used as a fallback when the LLM (or a legacy row) only supplies `score`.
 */
export function deriveScores5dFromScalar(score: number): Scores5D {
  const axis = clamp(Math.round(score * 10), 0, 100);
  return {
    naturalness: axis,
    accuracy: axis,
    fluency: axis,
    pragmatics: axis,
    completeness: axis,
  };
}

/** Derive a 0..10 scalar score from a 5D scorecard (rounded mean). */
export function deriveScalarFromScores5d(scores: Scores5D): number {
  const avg = (
    scores.naturalness +
    scores.accuracy +
    scores.fluency +
    scores.pragmatics +
    scores.completeness
  ) / 5;
  return Math.round(clamp(avg / 10, 0, 10) * 10) / 10;
}

/**
 * Backward-compatible normalizer for an evaluation returned by the LLM or loaded from storage.
 *
 * - If `scores5d` is missing but `score` is present, fill 5D with the scalar scaled to 0..100.
 * - If `scores5d` is present but `score` is missing or NaN, derive `score` as the rounded mean.
 * - Leaves the rest of the object untouched (same reference fields).
 * - Never mutates input.
 */
export function normalizeEvaluationResult(result: EvaluationResult): EvaluationResult {
  const next: EvaluationResult = { ...result };

  if (!next.scores5d) {
    const scalar = typeof next.score === 'number' && Number.isFinite(next.score) ? next.score : 0;
    next.scores5d = deriveScores5dFromScalar(scalar);
  } else {
    next.scores5d = {
      naturalness: clamp(next.scores5d.naturalness, 0, 100),
      accuracy: clamp(next.scores5d.accuracy, 0, 100),
      fluency: clamp(next.scores5d.fluency, 0, 100),
      pragmatics: clamp(next.scores5d.pragmatics, 0, 100),
      completeness: clamp(next.scores5d.completeness, 0, 100),
    };
  }

  if (typeof next.score !== 'number' || !Number.isFinite(next.score)) {
    next.score = deriveScalarFromScores5d(next.scores5d);
  }

  if (next.primaryDimension && !SCORE_DIMENSIONS.includes(next.primaryDimension)) {
    next.primaryDimension = undefined;
  }

  return next;
}

export interface ReviewEntry {
  date: string;
  score: number;
  userTranscription: string;
}

export interface Card {
  id: string;
  type: CardType;
  prompt: string; // Portuguese prompt or situation description
  expectedContext?: string; // What the AI expects (internal, not shown in review)
  imageUrl?: string; // For image cards
  targetVocabulary?: string[];
  context?: string;
  theme?: string;
  createdAt: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  // SM-2 fields
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  // History
  reviews: ReviewEntry[];
  // Latest evaluation
  latestEvaluation?: EvaluationResult;
  // Audio
  userAudioBlob?: string; // base64 encoded
  aiAudioCache?: string; // base64 encoded TTS
}
