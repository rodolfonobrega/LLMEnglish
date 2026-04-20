import { cn } from '../../utils/cn';
import type { Scores5D, ScoreDimension } from '../../types/card';
import { SCORE_DIMENSIONS } from '../../types/card';

interface ScorecardDisplayProps {
  scores: Scores5D;
  primaryDimension?: ScoreDimension;
  /** Optional convenience scalar (0-10) to render in the summary ring. */
  scalar?: number;
  size?: 'sm' | 'md' | 'lg';
}

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  naturalness: 'Naturalidade',
  accuracy: 'Precisão',
  fluency: 'Fluência',
  pragmatics: 'Registro',
  completeness: 'Completude',
};

const DIMENSION_HINTS: Record<ScoreDimension, string> = {
  naturalness: 'Soa como um nativo?',
  accuracy: 'Gramática e vocabulário',
  fluency: 'Ritmo e conexão',
  pragmatics: 'Tom e adequação',
  completeness: 'Respondeu o que foi pedido',
};

function axisColorVar(score: number): string {
  if (score >= 80) return 'var(--leaf)';
  if (score >= 60) return 'var(--amber)';
  if (score >= 40) return 'var(--primary)';
  return 'var(--danger)';
}

function axisColorSoft(score: number): string {
  if (score >= 80) return 'var(--leaf-soft)';
  if (score >= 60) return 'var(--amber-soft)';
  if (score >= 40) return 'var(--primary-soft)';
  return 'var(--danger-soft)';
}

function scalarLabel(score: number): string {
  if (score >= 9) return 'Excellent!';
  if (score >= 8) return 'Great!';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Needs Work';
  return 'Keep Practicing';
}

/**
 * Five-axis scorecard display replacing the legacy single-scalar `ScoreDisplay`.
 *
 * Visualises each dimension as its own horizontal bar with a color ramp
 * (danger → primary → amber → leaf). The `primaryDimension` — the axis the
 * tutor flagged as most blocking — gets a highlight badge.
 *
 * A compact summary ring reuses the old 0-10 scalar when supplied, so users
 * still get the single-number vibe at a glance.
 */
export function ScorecardDisplay({
  scores,
  primaryDimension,
  scalar,
  size = 'md',
}: ScorecardDisplayProps) {
  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';
  const ringSize = size === 'sm' ? 64 : size === 'lg' ? 112 : 88;
  const ringRadius = ringSize / 2 - 6;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = typeof scalar === 'number'
    ? (Math.max(0, Math.min(10, scalar)) / 10) * ringCircumference
    : 0;
  const ringColor = typeof scalar === 'number' ? axisColorVar(scalar * 10) : 'var(--muted)';

  return (
    <div className="flex flex-col items-stretch gap-4 rounded-2xl border border-border bg-card p-5">
      {typeof scalar === 'number' && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg className="-rotate-90" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={5}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke={ringColor}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference - ringProgress}
              />
            </svg>
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
                size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-4xl' : 'text-2xl',
              )}
              style={{ color: ringColor }}
            >
              {scalar.toFixed(1)}
            </span>
          </div>
          <span className="text-xs font-medium" style={{ color: ringColor }}>{scalarLabel(scalar)}</span>
        </div>
      )}

      <div className="space-y-3">
        {SCORE_DIMENSIONS.map((dim) => {
          const value = scores[dim];
          const isPrimary = primaryDimension === dim;
          const color = axisColorVar(value);
          const soft = axisColorSoft(value);
          return (
            <div
              key={dim}
              className={cn(
                'rounded-xl px-3 py-2 transition-colors',
                isPrimary && 'ring-1 ring-[var(--primary)]/40 bg-[var(--primary-soft)]/30',
              )}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{DIMENSION_LABELS[dim]}</span>
                  {isPrimary && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[var(--primary)] text-white">
                      Foco agora
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color }}>
                  {Math.round(value)}
                </span>
              </div>
              <div className={cn('w-full rounded-full overflow-hidden', barHeight)} style={{ backgroundColor: soft }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, value))}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{DIMENSION_HINTS[dim]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
