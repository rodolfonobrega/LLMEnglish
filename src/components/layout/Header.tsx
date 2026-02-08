import { getGamification } from '../../services/storage';
import { useState, useEffect } from 'react';
import type { GamificationState } from '../../types/gamification';
import { Flame, Star, Zap, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { cn } from '../../utils/cn';

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function Header() {
  const [stats, setStats] = useState<GamificationState | null>(null);
  const { theme, cycle } = useTheme();

  useEffect(() => {
    setStats(getGamification());

    const handler = () => setStats(getGamification());
    window.addEventListener('gamification-update', handler);
    return () => window.removeEventListener('gamification-update', handler);
  }, []);

  const ThemeIcon = themeIcons[theme];

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-edge sticky top-0 z-(--z-header) pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-sky text-balance">
          SpeakLab
        </h1>

        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-amber" title="XP">
                <Star size={16} />
                <span className="font-medium tabular-nums">{stats.xp} XP</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky" title={`Level ${stats.level}`}>
                <Zap size={16} />
                <span className="font-medium tabular-nums">Lv.{stats.level}</span>
              </div>
              <div
                className={cn('flex items-center gap-1.5', stats.streak > 0 ? 'text-coral' : 'text-ink-muted')}
                title={`${stats.streak}-day streak`}
              >
                <Flame size={16} />
                <span className="font-medium tabular-nums">{stats.streak}</span>
              </div>
            </div>
          )}

          <button
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-card-warm transition-colors"
          >
            <ThemeIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
