export interface ErrorPattern {
  id: string;
  pattern: string;
  category: ErrorCategory;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  examples: ErrorExample[];
  trend: 'improving' | 'stable' | 'worsening';
  recentScores: number[];
}

export type ErrorCategory =
  | 'grammar'
  | 'pronunciation'
  | 'vocabulary'
  | 'fluency'
  | 'syntax'
  | 'preposition'
  | 'verb-tense'
  | 'article'
  | 'word-order'
  | 'other';

export interface ErrorExample {
  cardId: string;
  date: string;
  userTranscription: string;
  correctedVersion: string;
  score: number;
  prompt: string;
}

export interface ErrorStats {
  totalErrors: number;
  byCategory: Record<ErrorCategory, number>;
  mostFrequent: ErrorPattern[];
  criticalErrors: ErrorPattern[];
  needsAttention: ErrorPattern[];
}

export interface WeakAreas {
  categories: ErrorCategory[];
  patterns: string[];
  recommendedFocus: string;
}

export type ErrorCurrency = 'active' | 'dormant' | 'resolved';

export interface SessionSnapshot {
  date: string;
  totalErrors: number;
  averageScore: number;
  byCategory: Record<ErrorCategory, number>;
  activePatterns: number;
  resolvedPatterns: number;
}

export interface ProgressTimeline {
  snapshots: SessionSnapshot[];
  overallTrend: 'improving' | 'stable' | 'worsening';
}

export interface ProgressSummary {
  text: string;
  improvingCategories: ErrorCategory[];
  worseningCategories: ErrorCategory[];
  resolvedCount: number;
  activeCount: number;
}
