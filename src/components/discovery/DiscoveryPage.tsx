import { useState, useEffect } from 'react';
import { ProgressBar } from '../ui/custom';
import { getGamification } from '../../services/storage';
import type { GamificationState } from '../../types/gamification';
import { Hand, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { XP_PER_LEVEL } from '../../types/gamification';

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

      {/* Praticar Hero Card */}
      <section>
        <button
          onClick={() => navigate('/practice')}
          className="w-full bg-gradient-to-br from-[var(--sky)] to-[var(--sky-hover)] rounded-2xl p-5 text-white relative overflow-hidden text-left cursor-pointer hover:shadow-lg transition-shadow duration-200"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6" />
              <span className="text-sm font-bold opacity-80">Comece aqui</span>
            </div>

            <h3 className="text-xl font-bold mb-1">Praticar</h3>
            <p className="text-white/80 text-sm">Exercicios, simulacao ao vivo, trilhas e mais.</p>
          </div>
        </button>
      </section>
    </div>
  );
}
