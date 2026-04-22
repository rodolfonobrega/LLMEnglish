import { cn } from '../../utils/cn';

interface ScoreDisplayProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * @deprecated Use `ScorecardDisplay` which visualises the 5D scorecard.
 * This single-scalar widget remains for backward-compatible rendering of
 * legacy evaluations that do not carry `scores5d`.
 */
export function ScoreDisplay({ score, size = 'md' }: ScoreDisplayProps) {
  const getColor = () => {
    if (score >= 8) return 'text-leaf';
    if (score >= 6) return 'text-[var(--amber)]';
    if (score >= 4) return 'text-primary';
    return 'text-[var(--danger)]';
  };

  const getBarColor = () => {
    if (score >= 8) return 'bg-leaf';
    if (score >= 6) return 'bg-[var(--amber)]';
    if (score >= 4) return 'bg-primary';
    return 'bg-[var(--danger)]';
  };

  const getBarSoft = () => {
    if (score >= 8) return 'bg-leaf-soft';
    if (score >= 6) return 'bg-[var(--amber-soft)]';
    if (score >= 4) return 'bg-primary-soft';
    return 'bg-[var(--danger-soft)]';
  };

  const getLabel = () => {
    if (score >= 9) return 'Excellent!';
    if (score >= 8) return 'Great!';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Needs Work';
    return 'Keep Practicing';
  };

  const sizeConfig = {
    sm: { container: 'size-12', text: 'text-lg', barH: 'h-1.5', barW: 'w-20' },
    md: { container: 'size-20', text: 'text-2xl', barH: 'h-2', barW: 'w-28' },
    lg: { container: 'size-28', text: 'text-4xl', barH: 'h-2.5', barW: 'w-36' },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex items-center gap-4">
      <div className={cn('relative', config.container)}>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
            config.text,
            getColor(),
          )}
        >
          {score}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className={cn('rounded-full overflow-hidden', config.barH, config.barW, getBarSoft())}>
          <div
            className={cn('h-full rounded-full transition-all duration-700', getBarColor())}
            style={{ width: `${Math.max(0, Math.min(100, score * 10))}%` }}
          />
        </div>
        {size !== 'sm' && (
          <span className={cn('text-sm font-medium', getColor())}>{getLabel()}</span>
        )}
      </div>
    </div>
  );
}
