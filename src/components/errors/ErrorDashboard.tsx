import { useState, useEffect } from 'react';
import {
  getErrorStats,
  identifyWeakAreas,
  clearErrorPatterns,
} from '../../services/errorAnalysis';
import type { ErrorPattern, ErrorCategory, ErrorStats } from '../../types/errors';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  grammar: 'Grammar',
  pronunciation: 'Pronunciation',
  vocabulary: 'Vocabulary',
  fluency: 'Fluency',
  syntax: 'Syntax',
  preposition: 'Prepositions',
  'verb-tense': 'Verb Tenses',
  article: 'Articles',
  'word-order': 'Word Order',
  other: 'Other',
};

const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  grammar: 'bg-purple-soft text-purple',
  pronunciation: 'bg-coral-soft text-coral',
  vocabulary: 'bg-sky-soft text-sky',
  fluency: 'bg-leaf-soft text-leaf',
  syntax: 'bg-amber-soft text-amber',
  preposition: 'bg-pink-soft text-pink',
  'verb-tense': 'bg-orange-soft text-orange',
  article: 'bg-blue-soft text-blue',
  'word-order': 'bg-teal-soft text-teal',
  other: 'bg-gray-soft text-gray',
};

export function ErrorDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    const errorStats = getErrorStats();
    setStats(errorStats);
  };

  const handleClear = () => {
    clearErrorPatterns();
    loadStats();
    setShowClearConfirm(false);
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <RefreshCw className="animate-spin text-ink-muted mx-auto mb-3" size={32} />
          <p className="text-ink-muted">Loading error analysis...</p>
        </div>
      </div>
    );
  }

  const weakAreas = identifyWeakAreas();
  const filteredPatterns = selectedCategory
    ? stats.mostFrequent.filter(p => p.category === selectedCategory)
    : stats.mostFrequent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink text-balance">Error Analysis</h2>
          <p className="text-ink-muted text-sm">Track your progress and identify areas for improvement</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowClearConfirm(true)}
          className="text-danger hover:text-danger hover:bg-danger-soft"
        >
          <Trash2 size={16} />
          Clear Data
        </Button>
      </div>

      {stats.totalErrors === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-20 bg-leaf-soft rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-leaf" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-ink">No Errors Recorded Yet</h3>
            <p className="text-ink-muted max-w-sm">
              Complete more exercises to see your error patterns and get personalized recommendations.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-sm)]">
              <p className="text-3xl font-extrabold text-ink tabular-nums">{stats.totalErrors}</p>
              <p className="text-xs text-ink-muted">Total Errors Recorded</p>
            </div>
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-sm)]">
              <p className="text-3xl font-extrabold text-coral tabular-nums">{stats.criticalErrors.length}</p>
              <p className="text-xs text-ink-muted">Critical Issues</p>
            </div>
          </div>

          {/* Recommended Focus */}
          <div className="bg-gradient-to-r from-sky-soft to-coral-soft rounded-2xl p-5 shadow-[var(--shadow-md)]">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                <Target className="text-sky" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink-secondary mb-1">Recommended Focus</p>
                <p className="text-lg font-bold text-ink">{weakAreas.recommendedFocus}</p>
              </div>
            </div>
          </div>

          {/* Error Categories */}
          <div>
            <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wide mb-3">Errors by Category</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.byCategory)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(
                      selectedCategory === category ? null : category as ErrorCategory
                    )}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedCategory === category
                        ? 'ring-2 ring-sky bg-white shadow-md scale-[1.02]'
                        : 'bg-card hover:shadow-md hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        selectedCategory === category
                          ? CATEGORY_COLORS[category as ErrorCategory]
                          : 'bg-card-warm text-ink-muted'
                      }`}>
                        {CATEGORY_LABELS[category as ErrorCategory]}
                      </span>
                      <span className="text-lg font-bold text-ink tabular-nums">{count}</span>
                    </div>
                    {selectedCategory === category && (
                      <p className="text-xs text-ink-muted mt-2">
                        Click to deselect
                      </p>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Critical Errors */}
          {stats.criticalErrors.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-danger uppercase tracking-wide mb-3 flex items-center gap-2">
                <AlertCircle size={16} />
                Needs Immediate Attention
              </h3>
              <div className="space-y-2">
                {stats.criticalErrors.map((pattern) => (
                  <ErrorPatternCard key={pattern.id} pattern={pattern} expanded />
                ))}
              </div>
            </div>
          )}

          {/* Most Frequent Errors */}
          <div>
            <h3 className="text-sm font-bold text-ink-secondary uppercase tracking-wide mb-3">
              {selectedCategory ? `${CATEGORY_LABELS[selectedCategory]} Errors` : 'Most Frequent Errors'}
            </h3>
            {filteredPatterns.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 text-center text-ink-muted">
                No errors found for this category
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatterns.slice(0, 10).map((pattern) => (
                  <ErrorPatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-[var(--shadow-lg)]">
            <h3 className="text-lg font-bold text-ink mb-2">Clear Error Data?</h3>
            <p className="text-ink-muted text-sm mb-4">
              This will delete all recorded error patterns. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="coral"
                onClick={handleClear}
                className="flex-1 bg-danger hover:bg-danger-hover text-white"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Error Pattern Card Component ---

interface ErrorPatternCardProps {
  pattern: ErrorPattern;
  expanded?: boolean;
}

function ErrorPatternCard({ pattern, expanded = false }: ErrorPatternCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const avgScore = pattern.recentScores.length > 0
    ? (pattern.recentScores.reduce((a, b) => a + b, 0) / pattern.recentScores.length).toFixed(1)
    : 'N/A';

  const TrendIcon = pattern.trend === 'improving' ? TrendingUp
    : pattern.trend === 'worsening' ? TrendingDown
    : Minus;

  const trendColor = pattern.trend === 'improving' ? 'text-leaf'
    : pattern.trend === 'worsening' ? 'text-danger'
    : 'text-ink-muted';

  return (
    <div
      className={`bg-card rounded-2xl p-4 shadow-[var(--shadow-sm)] transition-all ${
        isExpanded ? 'ring-2 ring-sky' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={CATEGORY_COLORS[pattern.category]}>
              {CATEGORY_LABELS[pattern.category]}
            </Badge>
            <span className="text-xs text-ink-muted">{pattern.occurrences}x</span>
          </div>
          <p className="text-sm text-ink font-medium line-clamp-2">{pattern.pattern}</p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <TrendIcon size={16} className={trendColor} />
          <span className={`text-xs font-semibold ${trendColor}`}>
            {avgScore}
          </span>
        </div>
      </div>

      {isExpanded && pattern.examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-card-warm space-y-2">
          <p className="text-xs font-semibold text-ink-secondary">Recent Examples</p>
          {pattern.examples.slice(0, 3).map((example, idx) => (
            <div key={idx} className="bg-card-warm rounded-lg p-3 text-xs space-y-1">
              <p className="text-ink-muted">Prompt: {example.prompt}</p>
              <p className="text-danger">You: {example.userTranscription}</p>
              <p className="text-leaf">Better: {example.correctedVersion}</p>
              <p className="text-ink-muted">Score: {example.score}/10</p>
            </div>
          ))}
        </div>
      )}

      {pattern.examples.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-sky font-medium hover:text-sky-hover"
        >
          {isExpanded ? 'Show less' : 'Show examples'}
        </button>
      )}
    </div>
  );
}
