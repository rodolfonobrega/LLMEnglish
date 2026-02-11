import { cn } from '../../utils/cn';

const THEMES = [
  { id: 'food', label: 'Food & Dining', icon: '🍽️' },
  { id: 'travel', label: 'Travel & Hotels', icon: '✈️' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'work', label: 'Work & Business', icon: '💼' },
  { id: 'health', label: 'Healthcare', icon: '🏥' },
  { id: 'social', label: 'Social & Friends', icon: '👋' },
  { id: 'transport', label: 'Transportation', icon: '🚕' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'education', label: 'Education', icon: '📖' },
  { id: 'custom', label: 'Custom Topic', icon: '✨' },
];

interface ThemeSelectorProps {
  selected: string;
  onSelect: (theme: string) => void;
}

export function ThemeSelector({ selected, onSelect }: ThemeSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {THEMES.map(theme => (
        <button
          key={theme.id}
          onClick={() => onSelect(theme.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer',
            selected === theme.id
              ? 'bg-[var(--sky)] text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <span className="text-base">{theme.icon}</span>
          <span>{theme.label}</span>
        </button>
      ))}
    </div>
  );
}

export { THEMES };
