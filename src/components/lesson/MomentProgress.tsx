import { cn } from '../../utils/cn';

interface MomentProgressProps {
  currentIndex: 1 | 2 | 3 | 4 | 5;
}

/**
 * 5-moment progress indicator. Intentionally shows moments (1/5, 2/5, …)
 * and NEVER minutes — the lesson narrative relies on an unexplained arc,
 * and a timer would break pacing.
 */
export function MomentProgress({ currentIndex }: MomentProgressProps) {
  return (
    <div className="flex items-center gap-1" aria-label={`Momento ${currentIndex} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i < currentIndex && 'bg-primary',
            i === currentIndex && 'bg-primary/70',
            i > currentIndex && 'bg-gray-200 dark:bg-gray-700',
          )}
        />
      ))}
    </div>
  );
}
