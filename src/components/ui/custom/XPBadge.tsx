import { Star, Zap, Flame } from 'lucide-react';
import { cn } from '../../../utils/cn';

// New variants
type XPBadgeVariant = 'xp' | 'level' | 'streak';

interface XPBadgeProps {
  // New API
  variant?: XPBadgeVariant;
  value?: number | string;

  // Backward compatible
  amount?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;

  className?: string;
}

const variantConfig = {
  xp: {
    icon: Star,
    bgColor: 'bg-amber-soft',
    textColor: 'text-amber',
  },
  level: {
    icon: Zap,
    bgColor: 'bg-primary-soft',
    textColor: 'text-primary',
  },
  streak: {
    icon: Flame,
    bgColor: 'bg-amber-soft',
    textColor: 'text-amber',
  },
} as const;

export function XPBadge({
  variant = 'xp',
  value,
  amount,
  size = 'md',
  showIcon = true,
  className,
}: XPBadgeProps) {
  // Backward compatibility: if amount is provided, treat as xp variant
  const effectiveVariant = amount !== undefined ? 'xp' : variant;
  const effectiveValue = amount !== undefined ? `+${amount} XP` : value;

  const config = variantConfig[effectiveVariant];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-lg",
      config.bgColor,
      config.textColor,
      sizeClasses[size],
      "font-semibold",
      className
    )}>
      {showIcon && <Icon className="w-4 h-4 fill-current" />}
      <span>
        {effectiveVariant === 'level' && 'Lv.'}{effectiveValue}
      </span>
    </div>
  );
}
