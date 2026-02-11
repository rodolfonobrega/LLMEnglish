import { cn } from '../../utils/cn';

interface ScoreDisplayProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreDisplay({ score, size = 'md' }: ScoreDisplayProps) {
  const getColor = () => {
    if (score >= 8) return 'text-[var(--leaf)]';
    if (score >= 6) return 'text-[var(--amber)]';
    if (score >= 4) return 'text-[var(--coral)]';
    return 'text-[var(--danger)]';
  };

  const getStrokeColor = () => {
    if (score >= 8) return 'stroke-[var(--leaf)]';
    if (score >= 6) return 'stroke-[var(--amber)]';
    if (score >= 4) return 'stroke-[var(--coral)]';
    return 'stroke-[var(--danger)]';
  };

  const getLabel = () => {
    if (score >= 9) return 'Excellent!';
    if (score >= 8) return 'Great!';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Needs Work';
    return 'Keep Practicing';
  };

  const sizeConfig = {
    sm: { container: 'size-12', text: 'text-lg', svgSize: 48, strokeWidth: 3, radius: 20 },
    md: { container: 'size-20', text: 'text-2xl', svgSize: 80, strokeWidth: 4, radius: 34 },
    lg: { container: 'size-28', text: 'text-4xl', svgSize: 112, strokeWidth: 5, radius: 48 },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const progress = (score / 10) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative', config.container)}>
        <svg
          className="-rotate-90"
          width={config.svgSize}
          height={config.svgSize}
          viewBox={`0 0 ${config.svgSize} ${config.svgSize}`}
        >
          <circle
            cx={config.svgSize / 2}
            cy={config.svgSize / 2}
            r={config.radius}
            fill="none"
            className="stroke-muted"
            strokeWidth={config.strokeWidth}
          />
          <circle
            cx={config.svgSize / 2}
            cy={config.svgSize / 2}
            r={config.radius}
            fill="none"
            className={getStrokeColor()}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
          />
        </svg>
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
      {size !== 'sm' && (
        <span className={cn('text-sm font-medium', getColor())}>{getLabel()}</span>
      )}
    </div>
  );
}
