import { Check, X, Lightbulb, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { FeedbackItem } from '@/types';
import { cn } from '@/lib/utils';

interface FeedbackPanelProps {
  items: FeedbackItem[];
  title?: string;
  defaultExpanded?: boolean;
}

export function FeedbackPanel({ 
  items, 
  title = 'Feedback & Tips',
  defaultExpanded = true 
}: FeedbackPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalBonus = items.reduce((sum, item) => sum + (item.xpBonus || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800">{title}</h3>
            {totalBonus > 0 && (
              <span className="text-xs text-orange-500 font-medium">
                +{totalBonus} XP Bonus!
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl',
                  item.type === 'success' && 'bg-green-50',
                  item.type === 'tip' && 'bg-blue-50',
                  item.type === 'warning' && 'bg-amber-50'
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  item.type === 'success' && 'bg-green-500',
                  item.type === 'tip' && 'bg-blue-500',
                  item.type === 'warning' && 'bg-amber-500'
                )}>
                  {item.type === 'success' ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : item.type === 'tip' ? (
                    <Lightbulb className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'text-sm font-medium',
                    item.type === 'success' && 'text-green-800',
                    item.type === 'tip' && 'text-blue-800',
                    item.type === 'warning' && 'text-amber-800'
                  )}>
                    {item.message}
                  </p>
                </div>
                {item.xpBonus && item.xpBonus > 0 && (
                  <span className="text-xs font-bold text-orange-500">
                    +{item.xpBonus} XP
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
