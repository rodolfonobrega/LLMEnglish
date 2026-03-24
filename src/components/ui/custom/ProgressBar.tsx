import { cn } from '../../../utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  level?: number;
  streak?: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ current, max, level, streak, showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Level and Streak Badges */}
      {(level !== undefined || streak !== undefined) && (
        <div className="flex items-center gap-2">
          {level !== undefined && (
            <span className="text-sm font-semibold text-primary">Level {level}</span>
          )}
          {streak !== undefined && streak > 0 && (
            <span className="text-sm font-semibold text-danger">🔥 {streak} dias</span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percentage === 100 ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <span className="text-xs text-muted-foreground mt-1.5 block">
            {current} / {max} XP
          </span>
        )}
      </div>
    </div>
  );
}
