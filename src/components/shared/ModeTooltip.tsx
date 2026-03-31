import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../ui/Tooltip';
import type { PracticeMode } from '../../config/modes';

interface ModeTooltipProps {
  mode: PracticeMode;
  children: React.ReactNode;
}

export function ModeTooltip({ mode, children }: ModeTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          style={{
            borderLeftColor: `hsl(var(--mode-${mode.colorVar}))`,
            borderLeftWidth: '3px',
          }}
        >
          <p className="font-semibold text-foreground text-sm">{mode.label}</p>
          <p className="text-muted-foreground text-xs mt-1">{mode.description}</p>
          <p className="text-xs mt-1.5 italic" style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}>
            Ex: {mode.example}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
