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
  grammar: 'Gramática',
  pronunciation: 'Pronúncia',
  vocabulary: 'Vocabulário',
  fluency: 'Fluência',
  syntax: 'Sintaxe',
  preposition: 'Preposições',
  'verb-tense': 'Tempos Verbais',
  article: 'Artigos',
  'word-order': 'Ordem das Palavras',
  other: 'Outros',
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
  const [weakAreas, setWeakAreas] = useState<Awaited<ReturnType<typeof identifyWeakAreas>> | null>(null)
  const [progressTimeline, setProgressTimeline] = useState<Awaited<ReturnType<typeof getProgressTimeline>> | null>(null)
  const [progressSummary, setProgressSummary] = useState<Awaited<ReturnType<typeof getProgressSummary>> | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | null>(null);
  const [currencyFilter, setCurrencyFilter] = useState<ErrorCurrency | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    void loadStats()
  }, []);

  const loadStats = async () => {
    const [errorStats, weakAreasData, timelineData, summaryData] = await Promise.all([
      getErrorStats(),
      identifyWeakAreas(),
      getProgressTimeline(),
      getProgressSummary(),
    ])
    setStats(errorStats)
    setWeakAreas(weakAreasData)
    setProgressTimeline(timelineData)
    setProgressSummary(summaryData)
  }

  const handleClear = async () => {
    await clearErrorPatterns()
    await loadStats()
    setShowClearConfirm(false);
  };

  if (!stats || !weakAreas || !progressTimeline || !progressSummary) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <RefreshCw className="animate-spin text-ink-muted mx-auto mb-3" size={32} />
          <p className="text-ink-muted">Carregando análise de erros...</p>
        </div>
      </div>
    );
  }
  const filteredPatterns = (selectedCategory
    ? stats.mostFrequent.filter(p => p.category === selectedCategory)
    : stats.mostFrequent
  ).filter(p => !currencyFilter || getErrorCurrency(p) === currencyFilter);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft size={18} />
        Voltar
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground text-balance">Análise de Erros</h2>
          <p className="text-muted-foreground text-sm">Acompanhe seu progresso e identifique pontos fracos</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowClearConfirm(true)}
          className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
        >
          <Trash2 size={16} />
          Limpar
        </Button>
      </div>

      {stats.totalErrors === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="size-20 bg-[var(--leaf-soft)] rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-[var(--leaf)]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Nenhum erro registrado</h3>
            <p className="text-muted-foreground max-w-sm">
              Complete mais exercícios para ver seus padrões de erro e receber recomendações personalizadas.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border">
              <p className="text-3xl font-extrabold text-foreground tabular-nums">{stats.totalErrors}</p>
              <p className="text-xs text-muted-foreground">Total de Erros</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <p className="text-3xl font-extrabold text-[var(--coral)] tabular-nums">{stats.criticalErrors.length}</p>
              <p className="text-xs text-muted-foreground">Problemas Críticos</p>
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
                <p className="text-sm font-bold text-muted-foreground mb-1">Resumo do Progresso</p>
                <p className="text-lg font-bold text-foreground">{progressSummary.text}</p>
              </div>
            </div>
          </div>

          {/* Progress Over Time */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Progresso ao Longo do Tempo</h3>
            {progressTimeline.snapshots.length < 2 ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground border border-border">
                Complete mais sessões para ver sua linha do tempo de progresso
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
                            {new Date(snapshot.date).toLocaleDateString('pt-BR', {
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
                <p className="text-sm font-bold text-muted-foreground mb-1">Foco Recomendado</p>
                <p className="text-lg font-bold text-foreground">{weakAreas.recommendedFocus}</p>
              </div>
            </div>
          </div>

          {/* Error Categories */}
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Erros por Categoria</h3>
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
                        Toque para desselecionar
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
                Precisa de Atenção Imediata
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
                {selectedCategory ? `Erros de ${CATEGORY_LABELS[selectedCategory]}` : 'Erros Mais Frequentes'}
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
                  Ativos
                </button>
                <button
                  onClick={() => setCurrencyFilter(currencyFilter === 'dormant' ? null : 'dormant')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currencyFilter === 'dormant'
                      ? 'ring-2 ring-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Dormentes
                </button>
                <button
                  onClick={() => setCurrencyFilter(currencyFilter === 'resolved' ? null : 'resolved')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    currencyFilter === 'resolved'
                      ? 'ring-2 ring-[var(--leaf)] bg-[var(--leaf-soft)] text-[var(--leaf)]'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  Resolvidos
                </button>
              </div>
            </div>
            {filteredPatterns.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 text-center text-muted-foreground border border-border">
                {selectedCategory || currencyFilter
                  ? 'Nenhum erro encontrado para este filtro'
                  : 'Nenhum erro encontrado'}
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
            <h3 className="text-lg font-bold text-foreground mb-2">Limpar Dados de Erros?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Isso vai excluir todos os padrões de erro registrados. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => { void handleClear() }}
                className="flex-1 cursor-pointer"
              >
                Limpar
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
  active: 'Ativo',
  dormant: 'Dormente',
  resolved: 'Resolvido',
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
          <p className="text-xs font-semibold text-muted-foreground">Exemplos Recentes</p>
          {pattern.examples.slice(0, 3).map((example, idx) => (
            <div key={idx} className="bg-muted rounded-lg p-3 text-xs space-y-1">
              <p className="text-muted-foreground">Prompt: {example.prompt}</p>
              <p className="text-[var(--danger)]">Você: {example.userTranscription}</p>
              <p className="text-[var(--leaf)]">Melhor: {example.correctedVersion}</p>
              <p className="text-muted-foreground">Nota: {example.score}/10</p>
            </div>
          ))}
        </div>
      )}

      {pattern.examples.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-[var(--sky)] font-medium hover:text-[var(--sky-hover)] cursor-pointer"
        >
          {isExpanded ? 'Mostrar menos' : 'Ver exemplos'}
        </button>
      )}
    </div>
  );
}
