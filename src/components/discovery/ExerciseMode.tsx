import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, X, Sparkles, ImageIcon, Mic, ChevronLeft, ChevronRight, MessageCircle, FileText, Theater } from 'lucide-react';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ThemeSelector } from '../shared/ThemeSelector';
import {
  chatCompletion,
  speechToText,
} from '../../services/openai';
import {
  getPhraseGenerationPrompt,
  getTextGenerationPrompt,
  getRoleplayGenerationPrompt,
  getEvaluationPrompt,
} from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { createDefaultCard } from '../../services/spacedRepetition';
import { addCard, getConversationTone } from '../../services/storage';
import { extractErrorPatterns, recordErrorPatterns } from '../../services/errorAnalysis';
import { addXP, syncGamificationState } from '../../services/gamification';
import { XP_PER_EXERCISE, XP_PER_PERFECT_SCORE } from '../../types/gamification';
import type { EvaluationResult } from '../../types/card';
import type { ConversationTone } from '../../types/settings';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SkeletonText } from '../ui/Skeleton';
import { cn } from '../../utils/cn';
import type { LucideIcon } from 'lucide-react';

export type ExerciseType = 'phrase' | 'text' | 'roleplay';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">
      {children}
    </p>
  );
}

const exerciseConfig: Record<
  ExerciseType,
  {
    label: string;
    icon: LucideIcon;
    promptLabel: string;
    evalType: string;
    skeletonLines: number;
    hasVocab: boolean;
  }
> = {
  phrase: {
    label: 'Frase',
    icon: MessageCircle,
    promptLabel: 'Fale isso em inglês',
    evalType: 'phrase translation',
    skeletonLines: 2,
    hasVocab: true,
  },
  text: {
    label: 'Texto',
    icon: FileText,
    promptLabel: 'Fale isso em inglês (naturalmente)',
    evalType: 'text translation',
    skeletonLines: 4,
    hasVocab: true,
  },
  roleplay: {
    label: 'Situação',
    icon: Theater,
    promptLabel: 'Situação (fale em inglês como lidaria com isso)',
    evalType: 'role-play situation',
    skeletonLines: 3,
    hasVocab: true,
  },
};

function getSystemPrompt(
  type: ExerciseType,
  vocabArr: string[] | undefined,
  context: string | undefined,
  theme: string | null,
  tone?: ConversationTone,
) {
  switch (type) {
    case 'phrase':
      return getPhraseGenerationPrompt(vocabArr, context, theme || undefined, tone);
    case 'text':
      return getTextGenerationPrompt(vocabArr, context, theme || undefined, tone);
    case 'roleplay':
      return getRoleplayGenerationPrompt(context, theme || undefined, vocabArr, tone);
  }
}

function getUserMessage(type: ExerciseType) {
  switch (type) {
    case 'phrase':
      return 'Generate a phrase.';
    case 'text':
      return 'Generate a text passage.';
    case 'roleplay':
      return 'Generate a role-play situation.';
  }
}

interface ExerciseModeProps {
  initialType?: ExerciseType;
}

export function ExerciseMode({ initialType = 'phrase' }: ExerciseModeProps) {
  const [theme, setTheme] = useState<string | null>('random');
  const [targetVocab, setTargetVocab] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<ConversationTone>('balanced');

  useEffect(() => {
    setTone(getConversationTone());
  }, []);

  const [setupStep, setSetupStep] = useState<'theme' | 'generate'>('theme');

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userAudioBase64, setUserAudioBase64] = useState<string | null>(null);

  const config = exerciseConfig[initialType];
  const hasActiveSession = !!prompt;

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    setEvaluation(null);
    setSaved(false);
    setUserAudioBase64(null);
    setPrompt('');

    if (!theme && !context?.trim()) {
      setError('Selecione um tema ou escreva um tópico específico.');
      setIsGenerating(false);
      return;
    }

    try {
      const vocabArr = targetVocab
        ? targetVocab.split(',').map(v => v.trim()).filter(Boolean)
        : undefined;
      const systemPrompt = getSystemPrompt(
        initialType,
        vocabArr,
        context || undefined,
        theme !== 'random' ? theme : null,
        tone,
      );
      const result = await chatCompletion(systemPrompt, getUserMessage(initialType));
      setPrompt(result.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAudioReady = async (blob: Blob, base64: string) => {
    setIsEvaluating(true);
    setError(null);
    setUserAudioBase64(base64);
    try {
      const transcription = await speechToText(blob);
      const evalPrompt = getEvaluationPrompt(prompt, transcription, config.evalType, tone);
      const evalResponse = await chatCompletion(
        'You are an expert English language evaluator. Respond only with valid JSON.',
        evalPrompt,
      );
      const cleanResponse = cleanJson(evalResponse);
      const evalResult: EvaluationResult = JSON.parse(cleanResponse);
      evalResult.userTranscription = transcription;
      setEvaluation(evalResult);

      const tempCardId = `temp_${Date.now()}`;
      const patterns = await extractErrorPatterns(evalResult, prompt, tempCardId);
      await recordErrorPatterns(patterns)

      let xp = XP_PER_EXERCISE;
      if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
      await addXP(xp)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!evaluation) return;

    const card = createDefaultCard({
      type: initialType,
      prompt,
      targetVocabulary:
        config.hasVocab && targetVocab
          ? targetVocab.split(',').map(v => v.trim())
          : undefined,
      context: context || undefined,
      theme: theme || undefined,
      latestEvaluation: evaluation,
      userAudioBlob: userAudioBase64 || undefined,
    });

    await addCard(card)
    await syncGamificationState()
    setSaved(true);
  };

  const reset = () => {
    setPrompt('');
    setEvaluation(null);
    setError(null);
    setSaved(false);
    setUserAudioBase64(null);
    setSetupStep('theme');
  };

  const getActiveStepIndex = (): number => {
    if (setupStep === 'generate') return 1;
    return 0;
  };

  if (!hasActiveSession && !isGenerating) {
    const stepIndex = getActiveStepIndex();
    const stepLabels = ['Tema', 'Gerar'];

    return (
      <div className="bg-card rounded-2xl p-5 border border-border space-y-5">
        <div className="flex items-center gap-1.5">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors duration-300',
                i <= stepIndex
                  ? 'bg-primary'
                  : 'bg-muted',
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
            <ThemeSelector
              selected={theme || ''}
              onSelect={(t) => setTheme(t)}
            />

            {config.hasVocab && (
              <div className="pt-2">
                <SectionLabel>Vocabulário Alvo</SectionLabel>
                <Input
                  value={targetVocab}
                  onChange={e => setTargetVocab(e.target.value)}
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
                  onChange={e => setContext(e.target.value)}
                  placeholder={
                    initialType === 'roleplay'
                      ? 'ex: devolver um produto, consulta médica'
                      : 'ex: pedir um café, entrevista de emprego'
                  }
                />
              </div>
            )}

            <Button
              variant="coral"
              size="lg"
              onClick={() => setSetupStep('generate')}
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
                {(() => { const Icon = config.icon; return <Icon size={14} />; })()}
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
                onClick={() => setSetupStep('theme')}
                className="flex-1 rounded-2xl cursor-pointer"
              >
                <ChevronLeft size={18} />
                Voltar
              </Button>
              <Button
                variant="coral"
                size="lg"
                onClick={() => { void generate(); }}
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
            <Sparkles
              size={16}
              className="text-primary animate-pulse"
            />
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
            onClick={reset}
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
            onClick={reset}
            aria-label="Dismiss prompt"
            className="absolute top-4 right-4 size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <AudioRecorder onAudioReady={handleAudioReady} disabled={isEvaluating} />

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
          onSaveToLibrary={() => { void handleSaveToLibrary() }}
          showSaveButton={!saved}
        />

        {saved && (
          <div className="bg-leaf-soft rounded-2xl p-4 text-center">
            <p className="text-leaf font-bold">Salvo na Biblioteca!</p>
          </div>
        )}

        <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
          <RefreshCw size={18} />
          Tentar Outro
        </Button>

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
