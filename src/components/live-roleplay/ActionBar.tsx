import { LogOut, BarChart3 } from 'lucide-react';
import { Button } from '../ui/Button';

interface ActionBarProps {
  hasTurns: boolean;
  onExit: () => void;
  onAnalyze: () => void;
}

export function ActionBar({ hasTurns, onExit, onAnalyze }: ActionBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 sm:px-0">
      <Button
        variant="ghost"
        size="lg"
        onClick={onExit}
        aria-label="Exit conversation"
        className="flex-1"
      >
        <LogOut size={18} />
        Sair
      </Button>

      <Button
        variant="default"
        size="lg"
        onClick={onAnalyze}
        disabled={!hasTurns}
        aria-label="Analyze conversation"
        className="flex-1"
      >
        <BarChart3 size={18} />
        Analisar
      </Button>
    </div>
  );
}
