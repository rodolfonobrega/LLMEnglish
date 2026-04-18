export type CardType = 'phrase' | 'text' | 'roleplay' | 'image';

export interface CorrectionItem {
  tip: string;
  example?: string;
}

export interface EvaluationResult {
  score: number;
  userTranscription: string;
  correctedVersion: string;
  betterAlternatives: string[];
  highlights?: string[];
  /** New format: array of {tip, example}. Legacy data may still be string[]. */
  corrections: CorrectionItem[] | string[];
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
