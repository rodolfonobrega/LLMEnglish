import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, BookOpen, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Compass, label: 'Discovery' },
  { to: '/review', icon: RotateCcw, label: 'Review' },
  { to: '/live', icon: Mic, label: 'Live' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-edge z-(--z-nav) pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-7xl mx-auto px-2 py-1">
        <div className="flex items-center justify-around">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-sky-soft text-sky'
                    : 'text-ink-muted hover:text-ink-secondary',
                )
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
