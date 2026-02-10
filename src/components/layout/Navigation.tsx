import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, BookOpen, Settings, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Compass, label: 'Discovery' },
  { to: '/review', icon: RotateCcw, label: 'Review' },
  { to: '/live', icon: Mic, label: 'Live' },
  { to: '/library', icon: BookOpen, label: 'Library' },
  { to: '/errors', icon: AlertTriangle, label: 'Errors' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )
            }
          >
            <item.icon size={20} />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
