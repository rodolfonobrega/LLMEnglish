import { cn } from '@/lib/utils';

interface WordChipProps {
  word: string;
  isHighlighted?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function WordChip({ word, isHighlighted = false, onClick, size = 'md' }: WordChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-4 py-2 rounded-full font-medium transition-all duration-200',
        'border-2 hover:shadow-md active:scale-95',
        size === 'sm' && 'px-3 py-1 text-sm',
        isHighlighted 
          ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100' 
          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
      )}
    >
      {word}
    </button>
  );
}

interface WordChipGroupProps {
  words: string[];
  highlightedWords?: string[];
  onWordClick?: (word: string) => void;
}

export function WordChipGroup({ words, highlightedWords = [], onWordClick }: WordChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {words.map((word) => (
        <WordChip
          key={word}
          word={word}
          isHighlighted={highlightedWords.includes(word)}
          onClick={() => onWordClick?.(word)}
        />
      ))}
    </div>
  );
}
