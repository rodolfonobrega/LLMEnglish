import { cn } from '../../utils/cn';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-sky-soft text-sky',
  success: 'bg-leaf-soft text-leaf',
  warning: 'bg-amber-soft text-amber',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
