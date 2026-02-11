import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, GraduationCap, BookOpen, Settings, AlertTriangle, Flame, Zap } from 'lucide-react';
import { cn } from '../../utils/cn';
import { getGamification } from '../../services/storage';
import { useState, useEffect } from 'react';
import type { GamificationState } from '../../types/gamification';

const navItems = [
    { to: '/', icon: Compass, label: 'Discovery' },
    { to: '/review', icon: RotateCcw, label: 'Review' },
    { to: '/live', icon: Mic, label: 'Live Roleplay' },
    { to: '/lessons', icon: GraduationCap, label: 'Lessons' },
    { to: '/library', icon: BookOpen, label: 'Library' },
    { to: '/errors', icon: AlertTriangle, label: 'Errors' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
    const [stats, setStats] = useState<GamificationState | null>(null);

    useEffect(() => {
        setStats(getGamification());
        const handler = () => setStats(getGamification());
        window.addEventListener('gamification-update', handler);
        return () => window.removeEventListener('gamification-update', handler);
    }, []);

    return (
        <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border h-screen sticky top-0">
            {/* Header / Logo */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-[var(--sky)] to-[var(--sky-hover)] p-2 rounded-xl">
                        <Zap className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-foreground text-lg">SpeakLab</h1>
                        <span className="text-xs font-semibold text-[var(--sky)]">
                            LEVEL {stats?.level || 1}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer",
                                            isActive
                                                ? "bg-[var(--sky-soft)] text-[var(--sky)] font-semibold"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        )
                                    }
                                    children={({ isActive }) => (
                                        <>
                                            <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                                            <span>{item.label}</span>
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 bg-[var(--sky)] rounded-full" />
                                            )}
                                        </>
                                    )}
                                />
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer / Streak Card */}
            {stats && stats.streak > 0 && (
                <div className="p-4 border-t border-border">
                    <div className="bg-gradient-to-br from-[var(--coral)] to-[var(--coral-hover)] rounded-2xl p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-5 h-5 fill-white" />
                            <span className="font-bold">{stats.streak} Day Streak!</span>
                        </div>
                        <p className="text-sm text-white/80">Keep it up! You're doing great!</p>
                    </div>
                </div>
            )}
        </aside>
    );
}
