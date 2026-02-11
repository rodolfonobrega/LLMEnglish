import { useState, useEffect } from 'react';
import {
  getErrorStats,
  getErrorCurrency,
  getProgressTimeline,
  getProgressSummary,
  identifyWeakAreas,
  clearErrorPatterns,
} from '../../services/errorAnalysis';
import type { ErrorPattern, ErrorCategory, ErrorStats, ErrorCurrency } from '../../types/errors';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  grammar: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  pronunciation: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  vocabulary: 'bg-[var(--sky-soft)] text-[var(--sky)]',
  fluency: 'bg-[var(--leaf-soft)] text-[var(--leaf)]',
  syntax: 'bg-[var(--amber-soft)] text-[var(--amber)]',
  preposition: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  'verb-tense': 'bg-[var(--coral-soft)] text-[var(--coral)]',
  article: 'bg-[var(--sky-soft)] text-[var(--sky)]',
  'word-order': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  other: 'bg-muted text-muted-foreground',
};

export function ErrorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<ErrorCurrency | null>(null);
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
  const progressTimeline = getProgressTimeline();
  const progressSummary = getProgressSummary();
  const filteredPatterns = (selectedCategory
    ? stats.mostFrequent.filter(p => p.category === selectedCategory)
    : stats.mostFrequent
  ).filter(p => !currencyFilter || getErrorCurrency(p) === currencyFilter);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft size={18} />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground text-balance">Error Analysis</h2>
          <p className="text-muted-foreground text-sm">Track your progress and identify areas for improvement</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowClearConfirm(true)}
          className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
        >
          <Trash2 size={16} />
          Clear Data
        </Button>
      </div>

      {stats.totalErrors === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-20 bg-[var(--leaf-soft)] rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-[var(--leaf)]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">No Errors Recorded Yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Complete more exercises to see your error patterns and get personalized recommendations.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border">
              <p className="text-3xl font-extrabold text-foreground tabular-nums">{stats.totalErrors}</p>
              <p className="text-xs text-muted-foreground">Total Errors Recorded</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <p className="text-3xl font-extrabold text-[var(--coral)] tabular-nums">{stats.criticalErrors.length}</p>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="bg-gradient-to-r from-[var(--sky-soft)] to-[var(--coral-soft)] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-card rounded-full flex items-center justify-center border border-border flex-shrink-0">
                {progressTimeline.overallTrend === 'improving' && (
                  <TrendingUp className="text-[var(--leaf)]" size={20} />
                )}
                {progressTimeline.overallTrend === 'worsening' && (
                  <TrendingDown className="text-[var(--danger)]" size={20} />
                )}
                {progressTimeline.overallTrend === 'stable' && (
                  <Minus className="text-muted-foreground" size={20} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-muted-foreground mb-1">Progress Summary</p>
                <p className="text-lg font-bold text-foreground">{progressSummary.text}</p>
              </div>
            </div>
          </div>

          {/* Progress Over Time */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Progress Over Time</h3>
            {progressTimeline.snapshots.length < 2 ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground border border-border">
                Complete more sessions to see your progress timeline
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-5 border border-border">
                <div className="flex gap-2">
                  {progressTimeline.snapshots
                    .slice(-10)
                    .map((snapshot, idx) => {
                      const score = snapshot.averageScore;
                      const heightPct = Math.min(100, (score / 10) * 100);
                      const barColor =
                        score >= 7
                          ? 'bg-[var(--leaf)]'
                          : score >= 4
                            ? 'bg-[var(--amber)]'
                            : 'bg-[var(--danger)]';
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <div className="w-full h-20 flex items-end">
                            <div
                              className={`w-full min-h-[4px] rounded-t transition-all ${barColor}`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {new Date(snapshot.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Recommended Focus */}
          <div className="bg-gradient-to-r from-[var(--sky-soft)] to-[var(--coral-soft)] rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 bg-card rounded-full flex items-center justify-center border border-border flex-shrink-0">
                <Target className="text-[var(--sky)]" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-muted-foreground mb-1">Recommended Focus</p>
                <p className="text-lg font-bold text-foreground">{weakAreas.recommendedFocus}</p>
              </div>
            </div>
          </div>

          {/* Error Categories */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Errors by Category</h3>
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
                    className={`p-3 rounded-xl text-left transition-colors duration-200 cursor-pointer ${
                      selectedCategory === category
                        ? 'ring-2 ring-[var(--sky)] bg-card border border-border'
                        : 'bg-card border border-border hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        selectedCategory === category
                          ? CATEGORY_COLORS[category as ErrorCategory]
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {CATEGORY_LABELS[category as ErrorCategory]}
                      </span>
                      <span className="text-lg font-bold text-foreground tabular-nums">{count}</span>
                    </div>
                    {selectedCategory === category && (
                      <p className="text-xs text-muted-foreground mt-2">
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
              <h3 className="text-sm font-bold text-[var(--danger)] uppercase tracking-wide mb-3 flex items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                {selectedCategory ? `${CATEGORY_LABELS[selectedCategory]} Errors` : 'Most Frequent Errors'}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrencyFilter(currencyFilter === 'active' ? null : 'active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currencyFilter === 'active'
                      ? 'ring-2 ring-[var(--coral)] bg-[var(--coral-soft)] text-[var(--coral)]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setCurrencyFilter(currencyFilter === 'dormant' ? null : 'dormant')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currencyFilter === 'dormant'
                      ? 'ring-2 ring-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Dormant
                </button>
                <button
                  onClick={() => setCurrencyFilter(currencyFilter === 'resolved' ? null : 'resolved')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currencyFilter === 'resolved'
                      ? 'ring-2 ring-[var(--leaf)] bg-[var(--leaf-soft)] text-[var(--leaf)]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Resolved
                </button>
              </div>
            </div>
            {filteredPatterns.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground border border-border">
                {selectedCategory || currencyFilter
                  ? 'No errors found for this filter'
                  : 'No errors found'}
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
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full border border-border">
            <h3 className="text-lg font-bold text-foreground mb-2">Clear Error Data?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              This will delete all recorded error patterns. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClear}
                className="flex-1 cursor-pointer"
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

const CURRENCY_STYLES: Record<ErrorCurrency, string> = {
  active: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  dormant: 'bg-[var(--amber-soft)] text-[var(--amber)]',
  resolved: 'bg-[var(--leaf-soft)] text-[var(--leaf)]',
};

const CURRENCY_LABELS: Record<ErrorCurrency, string> = {
  active: 'Active',
  dormant: 'Dormant',
  resolved: 'Resolved',
};

function ErrorPatternCard({ pattern, expanded = false }: ErrorPatternCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const currency = getErrorCurrency(pattern);
  const avgScore = pattern.recentScores.length > 0
    ? (pattern.recentScores.reduce((a, b) => a + b, 0) / pattern.recentScores.length).toFixed(1)
    : 'N/A';

  const TrendIcon = pattern.trend === 'improving' ? TrendingUp
    : pattern.trend === 'worsening' ? TrendingDown
    : Minus;

  const trendColor = pattern.trend === 'improving' ? 'text-[var(--leaf)]'
    : pattern.trend === 'worsening' ? 'text-[var(--danger)]'
    : 'text-muted-foreground';

  return (
    <div
      className={`bg-card rounded-2xl p-4 border border-border transition-colors duration-200 ${
        isExpanded ? 'ring-2 ring-[var(--sky)]' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={CATEGORY_COLORS[pattern.category]}>
              {CATEGORY_LABELS[pattern.category]}
            </Badge>
            <Badge className={CURRENCY_STYLES[currency]}>
              {CURRENCY_LABELS[currency]}
            </Badge>
            <span className="text-xs text-muted-foreground">{pattern.occurrences}x</span>
          </div>
          <p className="text-sm text-foreground font-medium line-clamp-2">{pattern.pattern}</p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <TrendIcon size={16} className={trendColor} />
          <span className={`text-xs font-semibold ${trendColor}`}>
            {avgScore}
          </span>
        </div>
      </div>

      {isExpanded && pattern.examples.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Recent Examples</p>
          {pattern.examples.slice(0, 3).map((example, idx) => (
            <div key={idx} className="bg-muted rounded-lg p-3 text-xs space-y-1">
              <p className="text-muted-foreground">Prompt: {example.prompt}</p>
              <p className="text-[var(--danger)]">You: {example.userTranscription}</p>
              <p className="text-[var(--leaf)]">Better: {example.correctedVersion}</p>
              <p className="text-muted-foreground">Score: {example.score}/10</p>
            </div>
          ))}
        </div>
      )}

      {pattern.examples.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-[var(--sky)] font-medium hover:text-[var(--sky-hover)] cursor-pointer"
        >
          {isExpanded ? 'Show less' : 'Show examples'}
        </button>
      )}
    </div>
  );
}
