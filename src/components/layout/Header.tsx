import { getGamification } from '../../services/storage';
import { useState, useEffect } from 'react';
import type { GamificationState } from '../../types/gamification';
import { Flame, Star, Sun, Moon, Monitor, Zap } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { XP_PER_LEVEL } from '../../types/gamification';

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
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo - Mobile Only */}
        <div className="lg:hidden flex items-center gap-3">
          <div className="bg-gradient-to-br from-[var(--sky)] to-[var(--sky-hover)] p-1.5 rounded-lg">
            <Zap className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-base leading-tight">SpeakLab</h1>
            {stats && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--sky)]">LEVEL {stats.level}</span>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--sky)] to-[var(--sky)]/70 rounded-full transition-all duration-500"
                    style={{ width: `${(stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        {/* User Stats */}
        <div className="flex items-center gap-2">
          {stats && (
            <>
              {/* XP */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--amber-soft)] rounded-full">
                <Star className="w-4 h-4 text-[var(--amber)] fill-[var(--amber)]" />
                <span className="text-sm font-bold text-[var(--amber)]">{stats.xp}</span>
              </div>

              {/* Level */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sky-soft)] rounded-full">
                <Zap className="w-4 h-4 text-[var(--sky)] fill-[var(--sky)]" />
                <span className="text-sm font-bold text-[var(--sky)]">Lv.{stats.level}</span>
              </div>

              {/* Streak */}
              {stats.streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--coral-soft)] rounded-full">
                  <Flame className="w-4 h-4 text-[var(--coral)] fill-[var(--coral)]" />
                  <span className="text-sm font-bold text-[var(--coral)]">{stats.streak}</span>
                </div>
              )}
            </>
          )}

          {/* Theme Toggle */}
          <button
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ThemeIcon size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
