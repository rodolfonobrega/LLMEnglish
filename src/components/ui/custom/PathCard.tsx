import { ChevronRight, Star } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Type for gradient colors (backward compatibility)
type GradientColor =
  | 'from-sky-400 to-blue-500'
  | 'from-violet-400 to-purple-500'
  | 'from-emerald-400 to-teal-500'
  | 'from-amber-400 to-orange-500'
  | 'from-rose-400 to-pink-500';

// New accent color type
type AccentColor = 'primary' | 'success' | 'warning' | 'danger' | 'special';

interface PathCardProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  gradient?: GradientColor;  // Backward compatible
  accentColor?: AccentColor;  // New API
  xpRange?: string;
  progress?: number;
  stepsDone?: number;
  stepsTotal?: number;
  onClick?: () => void;
  className?: string;
}

// Map old gradient names to new accent colors
function getAccentFromGradient(grad?: GradientColor): AccentColor {
  if (!grad) return 'primary';
  if (grad.includes('sky') || grad.includes('blue')) return 'primary';
  if (grad.includes('emerald') || grad.includes('teal') || grad.includes('green')) return 'success';
  if (grad.includes('amber') || grad.includes('orange')) return 'warning';
  if (grad.includes('rose') || grad.includes('pink') || grad.includes('red')) return 'danger';
  if (grad.includes('violet') || grad.includes('purple')) return 'special';
  return 'primary';
}

export function PathCard({
  title,
  subtitle,
  emoji,
  gradient,
  accentColor,
  xpRange,
  progress,
  stepsDone,
  stepsTotal,
  onClick,
  className,
}: PathCardProps) {
  // Use accentColor if provided, otherwise derive from gradient for backward compatibility
  const effectiveColor = accentColor ?? getAccentFromGradient(gradient);

  const colorMap = {
    primary: {
      icon: 'bg-primary-soft text-primary',
      badge: 'bg-primary-soft text-primary border-primary/20',
    },
    success: {
      icon: 'bg-success-soft text-success',
      badge: 'bg-success-soft text-success border-success/20',
    },
    warning: {
      icon: 'bg-warning-soft text-warning',
      badge: 'bg-warning-soft text-warning border-warning/20',
    },
    danger: {
      icon: 'bg-danger-soft text-danger',
      badge: 'bg-danger-soft text-danger border-danger/20',
    },
    special: {
      icon: 'bg-special-soft text-special',
      badge: 'bg-special-soft text-special border-special/20',
    },
  };

  const colors = colorMap[effectiveColor];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card',
        'transition-all duration-200 card-hover card-hover-border',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* Top Accent Line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5",
        effectiveColor === 'primary' && 'bg-gradient-to-r from-primary to-special',
        effectiveColor === 'success' && 'bg-success',
        effectiveColor === 'warning' && 'bg-warning',
        effectiveColor === 'danger' && 'bg-danger',
        effectiveColor === 'special' && 'bg-special',
      )} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            "size-12 rounded-lg flex items-center justify-center text-2xl",
            colors.icon
          )}>
            {emoji || '📘'}
          </div>

          {xpRange && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold",
              colors.badge
            )}>
              <Star className="w-3 h-3 fill-current" />
              <span>{xpRange} XP</span>
            </div>
          )}
        </div>

        <h3 className="text-foreground font-semibold text-base mb-1">{title}</h3>
        {subtitle && <p className="text-muted-foreground text-sm mb-4">{subtitle}</p>}

        {/* Progress */}
        {progress != null && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress === 100 ? 'bg-success' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            {stepsDone != null && stepsTotal != null ? (
              <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{stepsDone}/{stepsTotal}</span>
            ) : (
              <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{progress}%</span>
            )}
          </div>
        )}

        {/* Arrow on hover */}
        {onClick && (
          <div className="absolute bottom-4 right-4 size-8 bg-muted rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
