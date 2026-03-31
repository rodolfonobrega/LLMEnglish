import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { PracticeMode } from '../../config/modes';

interface ModeCardProps {
  mode: PracticeMode;
  onClick?: () => void;
  className?: string;
}

export function ModeCard({ mode, onClick, className }: ModeCardProps) {
  const Icon = mode.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 rounded-xl p-4 text-left cursor-pointer transition-all duration-200',
        'border-l-4 bg-card hover:scale-[1.01] hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      style={{
        borderLeftColor: `hsl(var(--mode-${mode.colorVar}))`,
        background: `linear-gradient(90deg, hsl(var(--mode-${mode.colorVar}-soft)) 0%, transparent 100%)`,
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `hsl(var(--mode-${mode.colorVar}-soft))`,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-semibold text-sm"
            style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
          >
            {mode.label}
          </span>
          {mode.highlighted && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `hsl(var(--mode-${mode.colorVar}))`,
                color: 'white',
              }}
            >
              ★ POPULAR
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {mode.description}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-muted-foreground flex-shrink-0"
      />
    </button>
  );
}