import { cn } from '../../utils/cn';

const THEMES = [
  { id: 'food', label: 'Comida & Restaurantes', icon: '🍽️' },
  { id: 'travel', label: 'Viagem & Hotéis', icon: '✈️' },
  { id: 'shopping', label: 'Compras', icon: '🛍️' },
  { id: 'work', label: 'Trabalho & Negócios', icon: '💼' },
  { id: 'health', label: 'Saúde', icon: '🏥' },
  { id: 'social', label: 'Social & Amigos', icon: '👋' },
  { id: 'transport', label: 'Transporte', icon: '🚕' },
  { id: 'entertainment', label: 'Entretenimento', icon: '🎬' },
  { id: 'education', label: 'Educação', icon: '📖' },
  { id: 'custom', label: 'Tópico Livre', icon: '✨' },
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
