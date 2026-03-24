import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, Map, Sparkles, FileText, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Compass, label: 'Início' },
  { to: '/exercises', icon: Sparkles, label: 'Exercícios' },
  { to: '/paths', icon: Map, label: 'Trilhas' },
  { to: '/live', icon: Mic, label: 'Simulação' },
  { to: '/review', icon: RotateCcw, label: 'Revisão' },
  { to: '/scripts', icon: FileText, label: 'Scripts' },
  { to: '/settings', icon: Settings, label: 'Config' },
];

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer min-w-[3rem]',
                isActive
                  ? 'text-primary bg-primary-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <item.icon size={20} strokeWidth={2} />
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
