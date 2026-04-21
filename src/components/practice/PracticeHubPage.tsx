import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Sparkles, Target, Settings2, X, Zap } from 'lucide-react';
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
import { NudgeCard } from '../master/NudgeCard';
import { SessionIntentSheet } from './SessionIntentSheet';
import { useSessionIntent } from '../../hooks/useSessionIntent';

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
  const [intentSheetOpen, setIntentSheetOpen] = useState(false);
  const { intent, setIntent } = useSessionIntent();

  const showSuggestedCta = masterEnabled();
  const hasActiveIntent = !!(
    intent &&
    (intent.requested_theme ||
      (intent.requested_vocabulary && intent.requested_vocabulary.length > 0) ||
      intent.requested_pattern ||
      intent.requested_modality ||
      intent.requested_difficulty ||
      intent.quick_practice ||
      (intent.review_focus && intent.review_focus.length > 0))
  );

  const handleSuggested = async () => {
    setSuggestError(null);
    setSuggesting(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('Não autenticado.');
      const learnerModel = await loadLearnerModel(user.id);
      const briefing = await prescribe(user.id, {
        learnerModel,
        sessionIntent: intent ?? undefined,
      });
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Praticar</h1>
          <p className="text-muted-foreground mt-1">
            Escolha como quer praticar hoje
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIntentSheetOpen(true)}
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
            hasActiveIntent
              ? 'border-primary bg-primary-soft text-primary hover:bg-primary/20'
              : 'border-border bg-card text-muted-foreground hover:bg-accent',
          )}
          data-testid="practice-intent-button"
        >
          {intent?.quick_practice ? <Zap size={14} /> : <Settings2 size={14} />}
          {hasActiveIntent ? 'Intenção ativa' : 'O que quer praticar?'}
        </button>
      </div>

      {hasActiveIntent && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-3 py-2 text-xs">
          <span className="font-semibold text-primary">
            {intent?.quick_practice ? 'Modo rápido' : 'Sessão guiada'}:
          </span>
          <span className="text-muted-foreground truncate">
            {[
              intent?.requested_theme && `tema: ${intent.requested_theme}`,
              intent?.requested_pattern && `padrão: ${intent.requested_pattern}`,
              intent?.requested_modality && `modalidade: ${intent.requested_modality}`,
              intent?.requested_difficulty && `dificuldade: ${intent.requested_difficulty}`,
              intent?.requested_vocabulary?.length &&
                `${intent.requested_vocabulary.length} palavra(s)`,
              intent?.review_focus?.length && `${intent.review_focus.length} card(s) fixado(s)`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <button
            type="button"
            onClick={() => setIntent(null)}
            aria-label="Limpar intenção da sessão"
            className="ml-auto text-primary hover:opacity-70 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <SessionIntentSheet open={intentSheetOpen} onOpenChange={setIntentSheetOpen} />

      {showSuggestedCta && !intent?.quick_practice && <LessonOfferCard />}

      {/* Phase 4 (F-P4-03) — cross-surface nudges from the engine.
          Silenced by Master off / quick_practice / reflections opt-out /
          24h throttle; the NudgeCard also gates internally so a stale
          pending row can't outlive a flag flip. */}
      {showSuggestedCta && !intent?.quick_practice && <NudgeCard />}

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
