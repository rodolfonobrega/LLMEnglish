import { useNavigate } from 'react-router-dom';
import { exerciseModes, conversationModes, trailsMode } from '../../config/modes';
import { ModeCard } from '../shared/ModeCard';
import { ModeTooltip } from '../shared/ModeTooltip';

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

      {/* Exercícios Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'hsl(var(--mode-phrases))' }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Exercícios
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {exerciseModes.map((mode) => (
            <ModeTooltip key={mode.id} mode={mode}>
              <div>
                <ModeCard
                  mode={mode}
                  onClick={() => navigate(mode.to)}
                />
              </div>
            </ModeTooltip>
          ))}
        </div>
      </section>

      {/* Conversação Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'hsl(var(--mode-simulation))' }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversação
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {conversationModes.map((mode) => (
            <ModeTooltip key={mode.id} mode={mode}>
              <div>
                <ModeCard
                  mode={mode}
                  onClick={() => navigate(mode.to)}
                />
              </div>
            </ModeTooltip>
          ))}
        </div>
      </section>

      {/* Trilhas Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'hsl(var(--mode-trails))' }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trilhas
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <ModeTooltip mode={trailsMode}>
            <div>
              <ModeCard
                mode={trailsMode}
                onClick={() => navigate(trailsMode.to)}
              />
            </div>
          </ModeTooltip>
        </div>
      </section>
    </div>
  );
}
