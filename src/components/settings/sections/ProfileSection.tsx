import { MessagesSquare, Coffee, Scale, Briefcase, Check } from 'lucide-react';
import type { ConversationTone } from '../../../types/settings';
import { cn } from '../../../utils/cn';

export interface ProfileSectionProps {
  tone: ConversationTone;
  onToneChange: (tone: ConversationTone) => void;
}

export function ProfileSection({ tone, onToneChange }: ProfileSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
          <MessagesSquare size={14} className="text-primary" />
        </div>
        <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Tom da Conversa</h3>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        Escolha o tom geral para conversas, exercícios e avaliações da IA no app.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          {
            id: 'casual' as const,
            icon: Coffee,
            label: 'Casual',
            desc: 'Inglês do dia a dia. Contrações, gírias, ritmo relaxado. Como conversar com um amigo.',
          },
          {
            id: 'balanced' as const,
            icon: Scale,
            label: 'Equilibrado',
            desc: 'Natural e claro. Conversacional mas bem estruturado. O padrão.',
          },
          {
            id: 'formal' as const,
            icon: Briefcase,
            label: 'Formal',
            desc: 'Profissional e polido. Business English, reuniões, apresentações.',
          },
        ]).map(option => (
          <button
            key={option.id}
            onClick={() => onToneChange(option.id)}
            className={cn(
              'flex flex-col items-start gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer',
              tone === option.id
                ? 'border-primary bg-primary-soft shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            <div className={cn(
              'size-9 rounded-xl flex items-center justify-center',
              tone === option.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            )}>
              <option.icon size={18} />
            </div>
            <div>
              <p className={cn(
                'font-bold text-sm',
                tone === option.id ? 'text-primary' : 'text-foreground'
              )}>
                {option.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.desc}</p>
            </div>
            {tone === option.id && (
              <div className="self-end size-5 bg-primary rounded-full flex items-center justify-center">
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
