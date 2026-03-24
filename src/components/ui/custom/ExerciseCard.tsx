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

interface ExerciseCardProps {
  title: string;
  description: string;
  emoji: string;
  gradient?: GradientColor;  // Backward compatible
  accentColor?: AccentColor;  // New API
  progress?: number;
  onClick?: () => void;
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

export function ExerciseCard({ title, description, emoji, gradient, accentColor, progress, onClick }: ExerciseCardProps) {
  // Use accentColor if provided, otherwise derive from gradient for backward compatibility
  const effectiveColor = accentColor ?? getAccentFromGradient(gradient);

  const colorMap = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    special: 'bg-special-soft text-special',
  };

  const accentGradient = {
    primary: 'bg-gradient-to-r from-primary to-special',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    special: 'bg-special',
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-xl border border-border bg-card
        transition-all duration-200 card-hover card-hover-border
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Top Accent Line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5",
        accentGradient[effectiveColor]
      )} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={cn(
            "size-12 rounded-lg flex items-center justify-center text-2xl",
            colorMap[effectiveColor]
          )}>
            {emoji}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-semibold text-base mb-1">{title}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2">{description}</p>
          </div>
        </div>

        {/* Progress */}
        {progress !== undefined && (
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
            <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
