import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  RefreshCw,
  X,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { FeedbackDrill } from '../shared/FeedbackDrill';
import { ThemeSelector } from '../shared/ThemeSelector';
import { getConversationTone } from '../../services/storage';
import type { ConversationTone } from '../../types/settings';
import type { ExerciseType } from '../discovery/ExerciseMode';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SkeletonText } from '../ui/Skeleton';
import { cn } from '../../utils/cn';
import { useExerciseEvaluation } from './useExerciseEvaluation';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">
      {children}
    </p>
  );
}

export interface ExerciseShellConfig {
  type: ExerciseType;
  label: string;
  icon: LucideIcon;
  promptLabel: string;
  evalType: string;
  skeletonLines: number;
  hasVocab: boolean;
  contextPlaceholder: string;
  userMessage: string;
  /**
   * Build the system prompt for generation. Receives current setup inputs.
   */
  buildSystemPrompt: (inputs: {
    vocabArr: string[] | undefined;
    context: string | undefined;
    theme: string | null;
    tone: ConversationTone;
  }) => string;
}

interface ExerciseShellProps {
  config: ExerciseShellConfig;
}

export function ExerciseShell({ config }: ExerciseShellProps) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<string | null>('random');
  const [targetVocab, setTargetVocab] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<ConversationTone>('balanced');

  useEffect(() => {
    setTone(getConversationTone());
  }, []);

  const {
    state,
    dispatch,
    generate,
    handleAudioReady,
    handleSaveToLibrary,
    reset,
    retrySame,
  } = useExerciseEvaluation({
    evalType: config.evalType,
    tone,
    userMessage: config.userMessage,
    buildSystemPrompt: () => {
      const vocabArr = targetVocab
        ? targetVocab.split(',').map((v) => v.trim()).filter(Boolean)
        : undefined;
      return config.buildSystemPrompt({
        vocabArr,
        context: context || undefined,
        theme: theme !== 'random' ? theme : null,
        tone,
      });
    },
    validateSetup: () => {
      if (!theme && !context?.trim()) {
        return 'Selecione um tema ou escreva um tópico específico.';
      }
      return null;
    },
    getSaveContext: () => ({
      type: config.type,
      targetVocab,
      hasVocab: config.hasVocab,
      context,
      theme,
    }),
  });

  const hasActiveSession = !!state.prompt;
  const isGenerating = state.status === 'generating';
  const isEvaluating = state.status === 'evaluating';
  const { evaluation, saved, error, setupStep, prompt } = state;

  const handleReset = () => {
    reset();
  };

  if (!hasActiveSession && !isGenerating) {
    const stepIndex = setupStep === 'generate' ? 1 : 0;
    const stepLabels = ['Tema', 'Gerar'];

    return (
      <div className="bg-card rounded-2xl p-5 border border-border space-y-5">
        <div className="flex items-center gap-1.5">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors duration-300',
                i <= stepIndex ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {setupStep === 'theme' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Contexto e tema</h3>
              <p className="text-sm text-muted-foreground mt-1">Sobre o que você quer falar?</p>
            </div>
            <ThemeSelector selected={theme || ''} onSelect={(t) => setTheme(t)} />

            {config.hasVocab && (
              <div className="pt-2">
                <SectionLabel>Vocabulário Alvo</SectionLabel>
                <Input
                  value={targetVocab}
                  onChange={(e) => setTargetVocab(e.target.value)}
                  placeholder="ex: gonna, would, might"
                  hint="Separe com vírgulas"
                />
              </div>
            )}

            {theme === 'custom' && (
              <div className="pt-2">
                <SectionLabel>Tópico / Contexto Específico</SectionLabel>
                <Input
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={config.contextPlaceholder}
                />
              </div>
            )}

            <Button
              variant="coral"
              size="lg"
              onClick={() => dispatch({ type: 'SETUP_STEP', step: 'generate' })}
              className="w-full rounded-2xl cursor-pointer"
            >
              Continuar
              <ChevronRight size={18} />
            </Button>
          </div>
        )}

        {setupStep === 'generate' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Tudo pronto!</h3>
              <p className="text-sm text-muted-foreground mt-1">Revise e gere seu exercício.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                {(() => {
                  const Icon = config.icon;
                  return <Icon size={14} />;
                })()}
                {config.label}
              </span>
              {theme && theme !== 'random' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                  Tema: {theme}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => dispatch({ type: 'SETUP_STEP', step: 'theme' })}
                className="flex-1 rounded-2xl cursor-pointer"
              >
                <ChevronLeft size={18} />
                Voltar
              </Button>
              <Button
                variant="coral"
                size="lg"
                onClick={() => {
                  void generate();
                }}
                className="flex-1 text-lg font-bold py-4 rounded-2xl cursor-pointer"
              >
                <Sparkles size={20} />
                Gerar Exercício
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (isGenerating && !hasActiveSession) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground font-semibold">
              Gerando {config.label.toLowerCase()}...
            </p>
          </div>
          <SkeletonText lines={config.skeletonLines} />
        </div>
      </div>
    );
  }

  if (hasActiveSession && !evaluation) {
    const ActiveIcon = config.icon;
    return (
      <div className="space-y-6">
        <div className="flex items-center -ml-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground pl-0 gap-1 cursor-pointer"
          >
            <ChevronLeft size={16} />
            Voltar
          </Button>
        </div>

        <div className="relative">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <ActiveIcon size={18} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">
                {config.promptLabel}
              </p>
            </div>
            <p className="text-lg text-foreground leading-relaxed whitespace-pre-line text-pretty">
              {prompt}
            </p>
          </div>
          <button
            onClick={handleReset}
            aria-label="Dismiss prompt"
            className="absolute top-4 right-4 size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <AudioRecorder
          onAudioReady={(blob, base64) => {
            void handleAudioReady(blob, base64);
          }}
          disabled={isEvaluating}
        />

        {isEvaluating && (
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-medium">Avaliando sua fala...</span>
          </div>
        )}

        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (evaluation) {
    const ResultIcon = config.icon;
    return (
      <div className="space-y-5">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ResultIcon size={16} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">
              Exercício Original
            </p>
          </div>
          <p className="text-foreground whitespace-pre-line text-pretty">{prompt}</p>
        </div>

        <EvaluationResults
          result={evaluation}
          onSaveToLibrary={() => {
            void handleSaveToLibrary();
          }}
          showSaveButton={!saved}
          drillSlot={
            evaluation.score < 9 && evaluation.correctedVersion ? (
              <FeedbackDrill
                target={evaluation.correctedVersion}
                original={evaluation.userTranscription}
              />
            ) : undefined
          }
        />

        {saved && (
          <div className="bg-leaf-soft rounded-2xl p-4 text-center">
            <p className="text-leaf font-bold">Salvo na Biblioteca!</p>
          </div>
        )}

        <div className="space-y-2">
          <Button
            variant="primary"
            size="lg"
            onClick={retrySame}
            className="w-full rounded-2xl cursor-pointer"
          >
            <RotateCcw size={18} />
            Tentar Novamente
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={handleReset}
            className="w-full rounded-2xl cursor-pointer"
          >
            <RefreshCw size={18} />
            Novo Exercicio
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate('/practice')}
            className="w-full rounded-2xl cursor-pointer"
          >
            <ChevronLeft size={18} />
            Voltar ao Hub
          </Button>
        </div>

        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
