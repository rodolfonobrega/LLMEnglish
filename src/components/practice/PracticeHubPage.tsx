import { useNavigate } from 'react-router-dom';
import { exerciseModes, conversationModes, trailsMode } from '../../config/modes';
import type { PracticeMode } from '../../config/modes';
import { PracticeModeCard } from '../shared/PracticeModeCard';

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
    </div>
  );
}
