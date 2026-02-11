import { Flame, Zap, Star } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface XPBadgeProps {
  amount: number;
  variant?: 'default' | 'bonus' | 'streak' | 'possible';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function XPBadge({
  amount,
  variant = 'default',
  size = 'md',
  showIcon = true
}: XPBadgeProps) {
  const variants = {
    default: 'bg-[var(--coral-soft)] text-[var(--coral)] border-[var(--coral)]/20',
    bonus: 'bg-[var(--amber-soft)] text-[var(--amber)] border-[var(--amber)]/20',
    streak: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/20',
    possible: 'bg-[var(--sky-soft)] text-[var(--sky)] border-[var(--sky)]/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const icons = {
    default: Flame,
    bonus: Zap,
    streak: Flame,
    possible: Star,
  };

  const Icon = icons[variant];

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-bold',
      variants[variant],
      sizes[size]
    )}>
      {showIcon && <Icon className={cn(
        'fill-current',
        size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'
      )} />}
      <span>+{amount} XP</span>
      {variant === 'possible' && <span className="font-normal opacity-70">possible</span>}
      {variant === 'bonus' && <span className="font-normal opacity-70">Bonus!</span>}
    </div>
  );
}
