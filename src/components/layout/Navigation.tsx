import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { primaryNavItems } from '../../config/navigation';

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {primaryNavItems.map(item => {
          const Icon = item.icon;
          return (
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
              <Icon size={20} strokeWidth={2} />
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
