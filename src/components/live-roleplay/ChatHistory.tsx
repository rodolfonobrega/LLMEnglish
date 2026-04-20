import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ConversationTurn } from '../../types/scenario';
import { cn } from '../../utils/cn';

interface ChatHistoryProps {
  turns: ConversationTurn[];
  aiRole: string;
  currentAiText: string;
}

export function ChatHistory({ turns, aiRole, currentAiText }: ChatHistoryProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText]);

  if (turns.length === 0) return null;

  return (
    <div className="mx-4 sm:mx-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
        <MessageCircle size={14} />
        <span>Conversa ({turns.length} mensagens)</span>
      </div>
      <div className="bg-slate-50 dark:bg-card/50 rounded-2xl p-4 max-h-56 overflow-y-auto space-y-3 shadow-inner border border-slate-100 dark:border-border/50">
        {turns.map((turn, i) => (
          <div
            key={`${turn.role}-${turn.timestamp}-${i}`}
            className={cn('flex animate-message-in', turn.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                turn.role === 'user'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-card text-foreground shadow-sm border border-slate-100 dark:border-border/50',
              )}
            >
              <p className={cn("text-[10px] mb-0.5 font-semibold capitalize opacity-80", turn.role === 'user' ? 'text-blue-100' : 'text-muted-foreground')}>
                {turn.role === 'user' ? 'Você' : aiRole}
              </p>
              <p className="leading-relaxed text-pretty">{turn.text}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
