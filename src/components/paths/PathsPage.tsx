import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, Check, Play, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getImageConfigAuto } from '../../config/images';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { getTrailsForTheme, THEMES_WITH_TRAILS } from '../../utils/roleplayTrails';
import type { ThemeMeta } from '../../utils/roleplayTrails';
import type { LiveScenario, ConversationTurn, PathProgress, RoleplayTrail, RoleplayTrailStep } from '../../types/scenario';
import { getPathProgress, markStepComplete } from '../../services/supabase/storage';
import { LiveSession } from '../live-roleplay/LiveSession';
import { ConversationAnalysis } from '../live-roleplay/ConversationAnalysis';
import { PathCard } from '../ui/custom/PathCard';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

type Phase = 'browse' | 'generating' | 'conversation' | 'analysis';

interface ActiveStep {
  theme: ThemeMeta;
  trail: RoleplayTrail;
  step: RoleplayTrailStep;
}

function getSceneImagePrompt(brandName: string, location: string, aiRole: string): string {
  return `A cozy, warm, inviting interior illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work. Anime/cartoon style, soft lighting, vibrant colors, wide shot, no text overlays, suitable as a background for an app.`;
}

export function PathsPage() {
  const [progress, setProgress] = useState<PathProgress>({ completedSteps: {} })
  const [selectedTheme, setSelectedTheme] = useState<ThemeMeta | null>(null);
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('browse');
  const [activeStep, setActiveStep] = useState<ActiveStep | null>(null);
  const [scenario, setScenario] = useState<LiveScenario | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refreshProgress = useCallback(async () => {
    setProgress(await getPathProgress())
  }, [])

  useEffect(() => {
    void refreshProgress()
  }, [refreshProgress])

  const getTrailCompletedCount = useCallback((trailId: string) => {
    return progress.completedSteps[trailId]?.length ?? 0
  }, [progress])

  const isStepComplete = useCallback((trailId: string, stepId: string) => {
    return progress.completedSteps[trailId]?.includes(stepId) ?? false
  }, [progress])

  const getThemeProgress = useCallback((themeId: string) => {
    const trails = getTrailsForTheme(themeId);
    let done = 0;
    let total = 0;
    for (const trail of trails) {
      total += trail.steps.length;
      done += getTrailCompletedCount(trail.id);
    }
    return { done, total };
  }, [getTrailCompletedCount]);

  const handleStartStep = async (theme: ThemeMeta, trail: RoleplayTrail, step: RoleplayTrailStep) => {
    setActiveStep({ theme, trail, step });
    setPhase('generating');
    setError(null);

    try {
      const prompt = getScenarioGenerationPrompt(theme.id, 'adventurous', step.scenarioContext);

      const response = await chatCompletion(
        'You are a world-class creative director who designs immersive role-play scenarios. You create vivid, specific characters with distinct voices and personalities. Respond only with valid JSON.',
        prompt,
      );

      const parsed = JSON.parse(cleanJson(response));

      const systemPrompt = getLiveRoleplaySystemPrompt(
        theme.id,
        parsed.userRole,
        parsed.aiRole,
        parsed.brandName,
        parsed.location,
        parsed.systemDetails,
        parsed.characterPersonality,
        parsed.characterSpeechStyle,
        parsed.openingLine,
      );

      const imagePromise = generateImage(
        getSceneImagePrompt(parsed.brandName, parsed.location, parsed.aiRole),
        getImageConfigAuto('scenarioThumbnail'),
      ).catch(() => undefined);

      const newScenario: LiveScenario = {
        id: crypto.randomUUID(),
        theme: theme.id,
        intensity: 'adventurous',
        descriptionPt: parsed.descriptionPt,
        systemPrompt,
        brandName: parsed.brandName,
        location: parsed.location,
        userRole: parsed.userRole,
        aiRole: parsed.aiRole,
        characterPersonality: parsed.characterPersonality,
        characterSpeechStyle: parsed.characterSpeechStyle,
        suggestedVoice: parsed.suggestedVoice,
      };

      const sceneImageUrl = await imagePromise;
      if (sceneImageUrl) newScenario.sceneImageUrl = sceneImageUrl;

      setScenario(newScenario);
      setPhase('conversation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar cenário');
      setPhase('browse');
    }
  };

  const handleConversationEnd = (conversationTurns: ConversationTurn[]) => {
    setTurns(conversationTurns);
    setPhase('analysis');
  };

  const handleExit = () => {
    setPhase('browse');
    setScenario(null);
    setTurns([]);
    setActiveStep(null);
  };

  const handleAnalysisDone = async () => {
    if (activeStep) {
      await markStepComplete(activeStep.trail.id, activeStep.step.id)
      await refreshProgress()
    }
    handleExit()
  };

  // --- Generating state ---
  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-8">
        <div className="relative">
          <div className="size-24 bg-primary-soft rounded-full flex items-center justify-center">
            <Sparkles size={40} className="text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-foreground font-bold text-xl">Montando a Cena...</p>
          <p className="text-muted-foreground text-sm">
            {activeStep?.step.label} &mdash; {activeStep?.trail.label}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 bg-muted rounded-full w-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
          </div>
          <p className="text-center text-muted-foreground text-xs">Gerando ilustração e personagem</p>
        </div>
      </div>
    );
  }

  // --- Conversation phase ---
  if (phase === 'conversation' && scenario) {
    return (
      <div className="space-y-6">
        <LiveSession scenario={scenario} onEnd={handleConversationEnd} onExit={handleExit} />
      </div>
    );
  }

  // --- Analysis phase ---
  if (phase === 'analysis' && scenario) {
    return (
      <div className="space-y-6">
        <ConversationAnalysis scenario={scenario} turns={turns} onReset={() => { void handleAnalysisDone() }} />
      </div>
    );
  }

  // --- Browse: Theme Overview ---
  if (!selectedTheme) {
    return (
      <div className="space-y-6 pb-20">
        <div>
          <a href="/practice">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground -ml-2 mb-2"
            >
              <ChevronLeft size={18} />
              Hub de Prática
            </Button>
          </a>
          <h1 className="text-2xl font-bold text-foreground">Trilhas</h1>
          <p className="text-muted-foreground">Siga trilhas guiadas por situações da vida real.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {THEMES_WITH_TRAILS.map(theme => {
            const { done, total } = getThemeProgress(theme.id);
            const trails = getTrailsForTheme(theme.id);
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <PathCard
                key={theme.id}
                title={theme.label}
                subtitle={`${trails.length} trilha${trails.length !== 1 ? 's' : ''} · ${done}/${total} etapas`}
                emoji={theme.emoji}
                gradient={theme.gradient}
                progress={progress}
                stepsDone={done}
                stepsTotal={total}
                onClick={() => {
                  setSelectedTheme(theme);
                  setExpandedTrail(null);
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // --- Browse: Theme Detail ---
  const trails = getTrailsForTheme(selectedTheme.id);
  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSelectedTheme(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>{selectedTheme.emoji}</span>
            {selectedTheme.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {trails.length} trilha{trails.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Trail list */}
      <div className="space-y-4">
        {trails.map(trail => {
          const completedCount = getTrailCompletedCount(trail.id);
          const totalSteps = trail.steps.length;
          const trailProgress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
          const isExpanded = expandedTrail === trail.id;
          const isComplete = completedCount === totalSteps;

          return (
            <div key={trail.id} className="space-y-0">
              {/* Trail header card */}
              <button
                onClick={() => setExpandedTrail(isExpanded ? null : trail.id)}
                className={cn(
                  'w-full text-left rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden',
                  isExpanded ? 'border-primary shadow-md' : 'border-border hover:border-primary/40',
                )}
              >
                <div className={cn('p-5', isExpanded && 'bg-primary-soft')}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-lg">{trail.label}</h3>
                        {isComplete && (
                          <div className="size-5 rounded-full bg-leaf flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{trail.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {completedCount}/{totalSteps}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={18} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isComplete
                          ? 'bg-leaf'
                          : 'bg-gradient-to-r from-primary to-primary/60',
                      )}
                      style={{ width: `${trailProgress}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded step list */}
              {isExpanded && (
                <div className="border border-t-0 border-border rounded-b-2xl overflow-hidden bg-card">
                  {trail.steps.map((step, idx) => {
                    const done = isStepComplete(trail.id, step.id);
                    const completedStepsForTrail = progress.completedSteps[trail.id] ?? [];
                    const isNext = !done && completedStepsForTrail.length === idx;

                    return (
                      <div
                        key={step.id}
                        className={cn(
                          'flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0',
                          done && 'bg-[var(--leaf-soft)]/50',
                        )}
                      >
                        {/* Step indicator */}
                        <div className={cn(
                          'flex-shrink-0 size-8 rounded-full flex items-center justify-center font-bold text-sm',
                          done
                            ? 'bg-leaf text-white'
                            : isNext
                              ? 'bg-primary text-white'
                              : 'bg-muted text-muted-foreground',
                        )}>
                          {done ? <Check size={16} /> : idx + 1}
                        </div>

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-semibold text-sm',
                            done ? 'text-leaf' : 'text-foreground',
                          )}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{step.descriptionPt}</p>
                        </div>

                        {/* Action */}
                        {done ? (
                          <button
                            onClick={() => handleStartStep(selectedTheme, trail, step)}
                            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-primary-soft"
                          >
                            Refazer
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleStartStep(selectedTheme, trail, step)}
                            className="gap-1.5 rounded-xl"
                          >
                            <Play size={14} className="fill-current" />
                            Iniciar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
