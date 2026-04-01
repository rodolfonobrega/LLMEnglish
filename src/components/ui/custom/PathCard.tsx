import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface PathCardProps {
  title: string;
  subtitle?: string;
  image?: string;
  emoji?: string;
  gradient?: string;
  progress?: number;
  stepsDone?: number;
  stepsTotal?: number;
  onClick?: () => void;
  className?: string;
}

export function PathCard({
  title,
  subtitle,
  image,
  emoji,
  gradient,
  progress,
  stepsDone,
  stepsTotal,
  onClick,
  className,
}: PathCardProps) {
  const [imgError, setImgError] = useState(false);

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
      <div className="h-32 w-full overflow-hidden bg-muted rounded-t-xl">
        {image && !imgError ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={cn(
            'w-full h-full flex items-center justify-center text-4xl',
            gradient ? `bg-gradient-to-br ${gradient}` : 'bg-muted',
          )}>
            {emoji || '📘'}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-foreground font-semibold text-base mb-1">{title}</h3>
        {subtitle && <p className="text-muted-foreground text-sm mb-3">{subtitle}</p>}

        {progress != null && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress === 100 ? 'bg-leaf' : 'bg-primary',
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

        {onClick && (
          <div className="absolute bottom-4 right-4 size-8 bg-muted rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
