import { SelectionDot } from './SelectionDot';
import { cn } from '../../utils/cn';

const THEMES = [
  { id: 'food', label: 'Comida & Restaurantes', image: '/images/themes/food.png' },
  { id: 'travel', label: 'Viagem & Hotéis', image: '/images/themes/travel.png' },
  { id: 'shopping', label: 'Compras', image: '/images/themes/shopping.png' },
  { id: 'work', label: 'Trabalho & Negócios', image: '/images/themes/work.png' },
  { id: 'health', label: 'Saúde', image: '/images/themes/health.png' },
  { id: 'social', label: 'Social & Amigos', image: '/images/themes/social.png' },
  { id: 'transport', label: 'Transporte', image: '/images/themes/transport.png' },
  { id: 'entertainment', label: 'Entretenimento', image: '/images/themes/entertainment.png' },
  { id: 'education', label: 'Educação', image: '/images/themes/education.png' },
  { id: 'custom', label: 'Tópico Livre', image: '/images/themes/custom.png' },
];

interface ThemeSelectorProps {
  selected: string;
  onSelect: (theme: string) => void;
}

export function ThemeSelector({ selected, onSelect }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {THEMES.map(theme => (
        <button
          key={theme.id}
          onClick={() => onSelect(theme.id)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer border-2 relative',
            selected === theme.id
              ? 'bg-card border-primary shadow-md'
              : 'bg-card border-secondary hover:shadow-md hover:scale-[1.02]',
          )}
        >
          {selected === theme.id && <SelectionDot />}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
            <img
              src={theme.image}
              alt={theme.label}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.textContent = theme.label[0];
              }}
            />
          </div>
          <span className="text-foreground text-center leading-tight">{theme.label}</span>
        </button>
      ))}
    </div>
  );
}

export { THEMES };
