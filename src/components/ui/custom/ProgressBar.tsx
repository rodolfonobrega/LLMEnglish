import { Flame, Star, Zap } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  level: number;
  streak?: number;
  className?: string;
}

export function ProgressBar({ current, max, level, streak = 0, className }: ProgressBarProps) {
  const percentage = Math.min((current / max) * 100, 100);

  return (
    <div className={cn('bg-card rounded-2xl p-4 shadow-sm border border-border', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Zap className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Keep Learning!</h3>
            <p className="text-sm text-muted-foreground">You're making great progress</p>
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-sm font-bold text-orange-600">{streak} day streak</span>
          </div>
        )}
      </div>

      <div className="relative">
        {/* Progress Track */}
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 rounded-full transition-all duration-500 relative"
            style={{ width: `${percentage}%` }}
          >
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>

        {/* Level Markers */}
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="text-sm font-bold text-foreground">Level {level}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold text-primary">{current}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{max} XP</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-sm font-medium text-muted-foreground">Level {level + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
