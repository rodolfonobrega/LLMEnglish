import { getGamification } from '../../services/storage';
import { useState, useEffect } from 'react';
import type { GamificationState } from '../../types/gamification';
import { Sun, Moon, Monitor, Zap } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { XPBadge } from '../ui/custom/XPBadge';
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
    <header className="bg-card/80 backdrop-blur-md border-b border-secondary sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo - Mobile Only */}
        <div className="lg:hidden flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg">
            <Zap className="text-white" size={18} />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-base leading-tight">SpeakLab</h1>
            {stats && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">LEVEL {stats.level}</span>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
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
              {/* XP - Hidden on mobile */}
              <div className="hidden sm:block">
                <XPBadge variant="xp" value={stats.xp} />
              </div>

              {/* Level - Hidden on mobile */}
              <div className="hidden sm:block">
                <XPBadge variant="level" value={stats.level} />
              </div>

              {/* Streak */}
              {stats.streak > 0 && (
                <XPBadge variant="streak" value={stats.streak} />
              )}
            </>
          )}

          {/* Theme Toggle */}
          <button
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <ThemeIcon size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
