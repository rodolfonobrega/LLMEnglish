import { ChevronRight, Star } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface PathCardProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  gradient?: string;
  xpRange?: string;
  progress?: number;
  stepsDone?: number;
  stepsTotal?: number;
  onClick?: () => void;
  className?: string;
}

const defaultGradients = [
  'from-sky-400 to-blue-500',
  'from-violet-400 to-purple-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
];

export function PathCard({
  title,
  subtitle,
  emoji,
  gradient,
  xpRange,
  progress,
  stepsDone,
  stepsTotal,
  onClick,
  className,
}: PathCardProps) {
  const bg = gradient || defaultGradients[Math.abs(title.length) % defaultGradients.length];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl transition-all duration-300 card-hover',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', bg)} />

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm text-2xl">
            {emoji || '📘'}
          </div>

          {xpRange && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20 text-white backdrop-blur-sm">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-xs font-bold">{xpRange} XP</span>
            </div>
          )}
        </div>

        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        {subtitle && <p className="text-white/80 text-sm mb-3">{subtitle}</p>}

        {/* Progress */}
        {progress != null && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {stepsDone != null && stepsTotal != null ? (
              <span className="text-white text-xs font-medium">{stepsDone}/{stepsTotal}</span>
            ) : (
              <span className="text-white text-xs font-medium">{progress}%</span>
            )}
          </div>
        )}

        {/* Arrow on hover */}
        {onClick && (
          <div className="absolute bottom-5 right-5 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
