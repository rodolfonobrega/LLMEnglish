import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, GraduationCap, BookOpen, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Compass, label: 'Discovery' },
  { to: '/review', icon: RotateCcw, label: 'Review' },
  { to: '/live', icon: Mic, label: 'Live' },
  { to: '/lessons', icon: GraduationCap, label: 'Lessons' },
  { to: '/practice', icon: BookOpen, label: 'Practice' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/errors', icon: AlertTriangle, label: 'Errors' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors duration-200 cursor-pointer min-w-[3rem]',
                isActive
                  ? 'text-[var(--sky)] bg-[var(--sky-soft)]'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <item.icon size={20} strokeWidth={2} />
            <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
