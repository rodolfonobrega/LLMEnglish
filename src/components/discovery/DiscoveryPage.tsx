import { useState, useEffect } from 'react';
import { ProgressBar } from '../ui/custom';
import { getGamification } from '../../services/storage';
import type { GamificationState } from '../../types/gamification';
import { Sparkles, Mic, RotateCcw, BookOpen, AlertTriangle, Hand, Target, Compass, Map, FileText, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { XP_PER_LEVEL } from '../../types/gamification';
import { cn } from '../../utils/cn';

interface QuickAction {
  to: string;
  icon: typeof Sparkles;
  label: string;
  description: string;
  color: string;
  hoverBorder: string;
}

const quickActions: QuickAction[] = [
  { to: '/exercises', icon: Sparkles, label: 'Exercícios', description: 'Frases, textos e situações', color: 'bg-warning-soft', hoverBorder: 'hover:border-warning/30' },
  { to: '/paths', icon: Map, label: 'Trilhas', description: 'Cenários guiados passo a passo', color: 'bg-primary-soft', hoverBorder: 'hover:border-primary/30' },
  { to: '/live', icon: Mic, label: 'Simulação', description: 'Conversa em tempo real', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
  { to: '/review', icon: RotateCcw, label: 'Revisão', description: 'Repetição espaçada', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
  { to: '/scripts', icon: FileText, label: 'Scripts', description: 'Atue diálogos como um ator', color: 'bg-danger-soft', hoverBorder: 'hover:border-danger/30' },
  { to: '/library', icon: BookOpen, label: 'Flashcards', description: 'Sua coleção de cards', color: 'bg-success-soft', hoverBorder: 'hover:border-success/30' },
  { to: '/errors', icon: AlertTriangle, label: 'Erros', description: 'Acompanhe seus pontos fracos', color: 'bg-danger-soft', hoverBorder: 'hover:border-danger/30' },
  { to: '/history', icon: Clock, label: 'Histórico', description: 'Reveja conversas anteriores', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
];

export function DiscoveryPage() {
  const [stats, setStats] = useState<GamificationState | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setStats(getGamification());
    const handler = () => setStats(getGamification());
    window.addEventListener('gamification-update', handler);
    return () => window.removeEventListener('gamification-update', handler);
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo!</h1>
          <p className="text-muted-foreground">Pronto pra um novo desafio?</p>
        </div>
        <div className="w-12 h-12 bg-warning-soft rounded-full flex items-center justify-center">
          <Hand className="w-6 h-6 text-warning" />
        </div>
      </div>

      {/* Progress Bar */}
      {stats && (
        <ProgressBar
          current={stats.xp % XP_PER_LEVEL}
          max={XP_PER_LEVEL}
          level={stats.level}
          streak={stats.streak}
        />
      )}

      {/* Live Roleplay Hero Card */}
      <section>
        <div className="bg-special-soft border border-special/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-special to-primary" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎭</span>
              <div className="px-2 py-1 bg-special/20 rounded-md">
                <span className="text-xs font-semibold text-special">60-130 XP</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-foreground mb-1">Simulação ao Vivo</h3>
            <p className="text-muted-foreground text-sm mb-4">Finja que é de verdade. Pratique com IA em tempo real.</p>

            <div className="flex gap-2">
              <button
                onClick={() => navigate('/live')}
                className="flex items-center gap-2 px-4 py-2 bg-special text-special-foreground rounded-lg font-semibold text-sm hover:bg-special/90 transition-colors cursor-pointer"
              >
                <Target className="w-4 h-4" />
                Cenário Aleatório
              </button>
              <button
                onClick={() => navigate('/live')}
                className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg font-semibold text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                Personalizado
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className={cn(
                  'p-4 bg-card rounded-2xl border border-border transition-all duration-200 text-left cursor-pointer group card-hover',
                  action.hoverBorder,
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:shadow-md transition-shadow duration-200',
                  action.color,
                )}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-bold text-foreground">{action.label}</h4>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
