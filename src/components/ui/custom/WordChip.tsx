import { cn } from '../../../utils/cn';

interface WordChipProps {
  word: string;
  isHighlighted?: boolean;
  onClick?: (word: string) => void;
  className?: string;
}

export function WordChip({ word, isHighlighted = false, onClick, className }: WordChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(word)}
      className={cn(
        'inline-flex px-4 py-2 rounded-full font-medium border-2 text-sm transition-all duration-200',
        isHighlighted
          ? 'bg-[var(--sky-soft)] border-[var(--sky)] text-[var(--sky)]'
          : 'bg-card border-border text-muted-foreground hover:border-[var(--sky)]/40',
        onClick && 'cursor-pointer hover:scale-105 active:scale-95',
        !onClick && 'cursor-default',
        className,
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
  className?: string;
}

export function WordChipGroup({ words, highlightedWords = [], onWordClick, className }: WordChipGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-2 justify-center', className)}>
      {words.map((word) => (
        <WordChip
          key={word}
          word={word}
          isHighlighted={highlightedWords.includes(word)}
          onClick={onWordClick}
        />
      ))}
    </div>
  );
}
