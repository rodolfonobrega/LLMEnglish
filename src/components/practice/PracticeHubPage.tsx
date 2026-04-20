import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Target } from 'lucide-react';
import {
  exerciseModes,
  conversationModes,
  trailsMode,
  focusedDrillModes,
} from '../../config/modes';
import type { PracticeMode } from '../../config/modes';
import { PracticeModeCard } from '../shared/PracticeModeCard';
import { cn } from '../../utils/cn';

const soloModes: readonly PracticeMode[] = [
  ...exerciseModes,
  conversationModes.find(m => m.id === 'visual')!,
];

const liveModes: readonly PracticeMode[] = [
  conversationModes.find(m => m.id === 'simulation')!,
  trailsMode,
];

export function PracticeHubPage() {
  const navigate = useNavigate();
  const [drillsOpen, setDrillsOpen] = useState(false);

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Praticar</h1>
        <p className="text-muted-foreground mt-1">
          Escolha como quer praticar hoje
        </p>
      </div>

      {/* Pratica Solo Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pratica Solo
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {soloModes.map((mode) => (
            <PracticeModeCard
              key={mode.id}
              mode={mode}
              onClick={() => navigate(mode.to)}
            />
          ))}
        </div>
      </section>

      {/* Ao Vivo Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ao Vivo
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {liveModes.map((mode) => (
            <PracticeModeCard
              key={mode.id}
              mode={mode}
              onClick={() => navigate(mode.to)}
            />
          ))}
        </div>
      </section>

      {/* Treinos Dirigidos Section — collapsed by default to protect visual load */}
      <section>
        <button
          type="button"
          onClick={() => setDrillsOpen((v) => !v)}
          aria-expanded={drillsOpen}
          aria-controls="focused-drills-list"
          className="flex items-center gap-2 mb-4 w-full text-left group cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target size={12} />
            Treinos Dirigidos
          </span>
          <span className="text-[10px] font-medium text-muted-foreground/80 ml-1">
            {focusedDrillModes.length} exercícios
          </span>
          <ChevronDown
            size={16}
            className={cn(
              'ml-auto text-muted-foreground transition-transform duration-200',
              drillsOpen && 'rotate-180',
            )}
          />
        </button>
        {drillsOpen && (
          <div id="focused-drills-list" className="flex flex-col gap-3">
            {focusedDrillModes.map((mode) => (
              <PracticeModeCard
                key={mode.id}
                mode={mode}
                onClick={() => navigate(mode.to)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
