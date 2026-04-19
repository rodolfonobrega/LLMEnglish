import { useState } from 'react';
import { cn } from '../../utils/cn';
import type { PracticeMode } from '../../config/modes';

interface PracticeModeCardProps {
  mode: PracticeMode;
  onClick?: () => void;
  className?: string;
}

export function PracticeModeCard({ mode, onClick, className }: PracticeModeCardProps) {
  const Icon = mode.icon;
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card overflow-hidden',
        'transition-all duration-200 card-hover card-hover-border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 cursor-pointer group relative',
        className,
      )}
      aria-label={`${mode.label}: ${mode.description}`}
    >
      <div className="h-28 w-full overflow-hidden bg-muted">
        {mode.image && !imgError ? (
          <img
            src={mode.image}
            alt={mode.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(var(--mode-${mode.colorVar}-soft)), hsl(var(--mode-${mode.colorVar})))`,
            }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      <div className="p-4">
        <span
          className="font-semibold text-base"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
        >
          {mode.label}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
        <p
          className="text-xs italic mt-2"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))`, opacity: 0.8 }}
        >
          Ex: {mode.example}
        </p>
      </div>
    </button>
  );
}
