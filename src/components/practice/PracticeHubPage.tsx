import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Sparkles, Target } from 'lucide-react';
import {
  exerciseModes,
  conversationModes,
  trailsMode,
  focusedDrillModes,
} from '../../config/modes';
import type { PracticeMode } from '../../config/modes';
import { PracticeModeCard } from '../shared/PracticeModeCard';
import { cn } from '../../utils/cn';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { loadLearnerModel } from '../../services/learnerModel';
import { getCurrentUser } from '../../services/supabase/auth';
import { prescribe } from '../../services/master/prescribe';
import { routeModality } from '../../services/master/modalityRouter';
import { LessonOfferCard } from '../lesson/LessonOfferCard';

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
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const showSuggestedCta = masterEnabled();

  const handleSuggested = async () => {
    setSuggestError(null);
    setSuggesting(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('Não autenticado.');
      const learnerModel = await loadLearnerModel(user.id);
      const briefing = await prescribe(user.id, { learnerModel });
      if (!briefing) {
        setSuggestError('Não consegui montar uma sugestão agora. Tenta de novo em instantes.');
        return;
      }
      const target = routeModality(briefing);
      navigate(target.path, { state: target.state });
    } catch (err) {
      console.warn('[PracticeHub] prescribe failed:', err);
      setSuggestError('Falha ao gerar a sugestão.');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Praticar</h1>
        <p className="text-muted-foreground mt-1">
          Escolha como quer praticar hoje
        </p>
      </div>

      {showSuggestedCta && <LessonOfferCard />}

      {showSuggestedCta && (
        <section>
          <button
            type="button"
            onClick={handleSuggested}
            disabled={suggesting}
            className={cn(
              'w-full flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4 text-left transition-colors cursor-pointer hover:bg-primary/20 disabled:opacity-60 disabled:cursor-wait',
            )}
            data-testid="practice-suggested-cta"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                {suggesting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-primary">Prática sugerida</div>
                <div className="text-xs text-muted-foreground">
                  Deixa eu escolher o próximo exercício pra você.
                </div>
              </div>
            </div>
            <ChevronDown size={16} className="rotate-[-90deg] text-primary/70" />
          </button>
          {suggestError && (
            <p className="mt-2 text-xs text-[var(--danger)]">{suggestError}</p>
          )}
        </section>
      )}

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
