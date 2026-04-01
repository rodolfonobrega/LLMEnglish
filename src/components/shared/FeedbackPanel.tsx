import { Check, X, Lightbulb, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../utils/cn';

export interface FeedbackItem {
  id: string;
  type: 'success' | 'tip' | 'warning';
  message: string;
  xpBonus?: number;
}

interface FeedbackPanelProps {
  items: FeedbackItem[];
  title?: string;
  defaultExpanded?: boolean;
}

const typeConfig = {
  success: { bg: 'bg-leaf-soft', icon: Check, iconBg: 'bg-leaf', text: 'text-leaf' },
  tip: { bg: 'bg-primary-soft', icon: Lightbulb, iconBg: 'bg-primary', text: 'text-primary' },
  warning: { bg: 'bg-[var(--amber-soft)]', icon: X, iconBg: 'bg-[var(--amber)]', text: 'text-[var(--amber)]' },
};

export function FeedbackPanel({
  items,
  title = 'Feedback & Tips',
  defaultExpanded = true,
}: FeedbackPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalBonus = items.reduce((sum, item) => sum + (item.xpBonus || 0), 0);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--amber-soft)] rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[var(--amber)]" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground">{title}</h3>
            {totalBonus > 0 && (
              <span className="text-xs text-primary font-medium">
                +{totalBonus} XP Bonus!
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {items.map((item) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  className={cn('flex items-start gap-3 p-3 rounded-xl', config.bg)}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    config.iconBg,
                  )}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', config.text)}>
                      {item.message}
                    </p>
                  </div>
                  {item.xpBonus != null && item.xpBonus > 0 && (
                    <span className="text-xs font-bold text-primary">
                      +{item.xpBonus} XP
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
