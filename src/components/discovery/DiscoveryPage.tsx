import { useState, useEffect } from 'react';
import { ExerciseMode } from './ExerciseMode';
import { ProgressBar } from '../ui/custom';
import { getGamification } from '../../services/storage';
import type { GamificationState } from '../../types/gamification';
import { Sparkles, Mic, RotateCcw, BookOpen, AlertTriangle, Hand } from 'lucide-react';
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
          <h1 className="text-2xl font-bold text-foreground">
            Welcome!
          </h1>
          <p className="text-muted-foreground">Ready for a new challenge?</p>
        </div>
        <div className="w-12 h-12 bg-[var(--amber-soft)] rounded-full flex items-center justify-center">
          <Hand className="w-6 h-6 text-[var(--amber)]" />
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

      {/* Exercise Mode Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Practice Exercises</h2>
          <Sparkles className="w-5 h-5 text-[var(--amber)]" />
        </div>

        <ExerciseMode />
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-4">Quick Start</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/live')}
            className="p-4 bg-card rounded-2xl border border-border hover:bg-accent hover:border-[var(--sky)]/30 transition-colors duration-200 text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-[var(--sky)] rounded-xl flex items-center justify-center mb-3 group-hover:shadow-md transition-shadow duration-200">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-foreground">Live Roleplay</h4>
            <p className="text-sm text-muted-foreground">Real-time practice</p>
          </button>

          <button
            onClick={() => navigate('/review')}
            className="p-4 bg-card rounded-2xl border border-border hover:bg-accent hover:border-purple-500/30 transition-colors duration-200 text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center mb-3 group-hover:shadow-md transition-shadow duration-200">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-foreground">Review</h4>
            <p className="text-sm text-muted-foreground">Spaced repetition</p>
          </button>

          <button
            onClick={() => navigate('/library')}
            className="p-4 bg-card rounded-2xl border border-border hover:bg-accent hover:border-[var(--leaf)]/30 transition-colors duration-200 text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-[var(--leaf)] rounded-xl flex items-center justify-center mb-3 group-hover:shadow-md transition-shadow duration-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-foreground">Library</h4>
            <p className="text-sm text-muted-foreground">Your collection</p>
          </button>

          <button
            onClick={() => navigate('/errors')}
            className="p-4 bg-card rounded-2xl border border-border hover:bg-accent hover:border-[var(--danger)]/30 transition-colors duration-200 text-left cursor-pointer group"
          >
            <div className="w-10 h-10 bg-[var(--danger)] rounded-xl flex items-center justify-center mb-3 group-hover:shadow-md transition-shadow duration-200">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-bold text-foreground">Error Analysis</h4>
            <p className="text-sm text-muted-foreground">Track mistakes</p>
          </button>
        </div>
      </section>
    </div>
  );
}
