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
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 rounded-lg">
            <Zap className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-base leading-tight">SpeakLab</h1>
            {stats && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">LEVEL {stats.level}</span>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
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
        <div className="flex items-center gap-3">
          {stats && (
            <>
              {/* XP */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span className="text-sm font-bold text-orange-600">{stats.xp}</span>
              </div>

              {/* Level */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                <Zap className="w-4 h-4 text-blue-500 fill-blue-500" />
                <span className="text-sm font-bold text-blue-600">Lv.{stats.level}</span>
              </div>

              {/* Streak */}
              {stats.streak > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <span className="text-sm font-bold text-orange-600">{stats.streak}</span>
                </div>
              )}
            </>
          )}

          {/* Theme Toggle */}
          <button
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ThemeIcon size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
