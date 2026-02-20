import { useState } from 'react';
import { Loader2, RefreshCw, X, Sparkles, ImageIcon, Mic, ChevronLeft, MessageCircle, FileText, Theater } from 'lucide-react';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ThemeSelector } from '../shared/ThemeSelector';
import {
  chatCompletion,
  chatCompletionWithImage,
  generateImage,
  speechToText,
} from '../../services/openai';
import { getImageConfigAuto, BASE_IMAGE_STYLE_PROMPT } from '../../config/images';
import {
  getPhraseGenerationPrompt,
  getTextGenerationPrompt,
  getRoleplayGenerationPrompt,
  getEvaluationPrompt,
  getImageQuestionPrompt,
} from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { createDefaultCard } from '../../services/spacedRepetition';
import { addCard } from '../../services/storage';
import { extractErrorPatterns, recordErrorPatterns } from '../../services/errorAnalysis';
import { addXP } from '../../services/gamification';
import { XP_PER_EXERCISE, XP_PER_PERFECT_SCORE } from '../../types/gamification';
import type { EvaluationResult } from '../../types/card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SkeletonText, Skeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';
import type { LucideIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
type ExerciseType = 'phrase' | 'text' | 'roleplay';
type OutputFormat = 'audio' | 'image';

// ─── Section label ───────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">
      {children}
    </p>
  );
}

// ─── Config ──────────────────────────────────────────────────────────
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
    label: 'Phrase',
    icon: MessageCircle,
    promptLabel: 'Translate this to English',
    evalType: 'phrase translation',
    skeletonLines: 2,
    hasVocab: true,
  },
  text: {
    label: 'Text',
    icon: FileText,
    promptLabel: 'Translate this to English (spoken)',
    evalType: 'text translation',
    skeletonLines: 4,
    hasVocab: true,
  },
  roleplay: {
    label: 'Role-Play',
    icon: Theater,
    promptLabel: "Situation (speak in English how you'd handle this)",
    evalType: 'role-play situation',
    skeletonLines: 3,
    hasVocab: true,
  },
};

const exerciseTypes: ExerciseType[] = ['phrase', 'text', 'roleplay'];

const IMAGE_SCENES = [
  'a busy street market',
  'a cozy coffee shop',
  'a park on a sunny day',
  'an airport terminal',
  'a kitchen with food being prepared',
  'a beach scene',
  'a city skyline at sunset',
];

// ─── Helpers ─────────────────────────────────────────────────────────
function getSystemPrompt(
  type: ExerciseType,
  vocabArr: string[] | undefined,
  context: string | undefined,
  theme: string | null,
) {
  switch (type) {
    case 'phrase':
      return getPhraseGenerationPrompt(vocabArr, context, theme || undefined);
    case 'text':
      return getTextGenerationPrompt(vocabArr, context, theme || undefined);
    case 'roleplay':
      return getRoleplayGenerationPrompt(context, theme || undefined, vocabArr);
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

// ─── Component ───────────────────────────────────────────────────────
export function ExerciseMode() {
  // Form state
  const [exerciseType, setExerciseType] = useState<ExerciseType>('phrase');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('audio');
  const [theme, setTheme] = useState<string | null>('random');
  const [targetVocab, setTargetVocab] = useState('');
  const [context, setContext] = useState('');

  // Session state
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userAudioBase64, setUserAudioBase64] = useState<string | null>(null);

  const isAudio = outputFormat === 'audio';
  const config = exerciseConfig[exerciseType];
  const hasActiveSession = !!prompt || !!imageUrl;

  // ── Generate ─────────────────────────────────────────────────────
  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    setEvaluation(null);
    setSaved(false);
    setUserAudioBase64(null);
    setPrompt('');
    setImageUrl('');

    // VALIDATION: Require either a theme or a specific context
    if (!theme && !context?.trim()) {
      setError('Please select a theme or provide a specific topic.');
      setIsGenerating(false);
      return;
    }

    try {
      if (isAudio) {
        // Audio + Text mode
        const vocabArr = targetVocab
          ? targetVocab.split(',').map(v => v.trim()).filter(Boolean)
          : undefined;
        const systemPrompt = getSystemPrompt(
          exerciseType,
          vocabArr,
          context || undefined,
          theme !== 'random' ? theme : null,
        );
        const result = await chatCompletion(systemPrompt, getUserMessage(exerciseType));
        setPrompt(result.trim());
      } else {
        // Visual Prompt mode
        let scene = context?.trim();
        if (!scene) {
          if (theme === 'random') {
            scene = IMAGE_SCENES[Math.floor(Math.random() * IMAGE_SCENES.length)];
          } else if (theme) {
            scene = `a scene related to ${theme}`;
          }
        }

        const imgUrl = await generateImage(
          `${BASE_IMAGE_STYLE_PROMPT} A highly detailed, immersive everyday scene that would be interesting to describe: ${scene}`,
          getImageConfigAuto('exerciseMode')
        );
        setImageUrl(imgUrl);

        const questionPrompt = getImageQuestionPrompt();
        const q = await chatCompletionWithImage(questionPrompt, imgUrl);
        setPrompt(q.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Evaluate recording ───────────────────────────────────────────
  const handleAudioReady = async (blob: Blob, base64: string) => {
    setIsEvaluating(true);
    setError(null);
    setUserAudioBase64(base64);
    try {
      const transcription = await speechToText(blob);
      const evalType = isAudio ? config.evalType : 'image description';
      const evalPrompt = getEvaluationPrompt(prompt, transcription, evalType);
      const evalResponse = await chatCompletion(
        'You are an expert English language evaluator. Respond only with valid JSON.',
        evalPrompt,
      );
      const cleanResponse = cleanJson(evalResponse);
      const evalResult: EvaluationResult = JSON.parse(cleanResponse);
      evalResult.userTranscription = transcription;
      setEvaluation(evalResult);

      // Record error patterns for intelligent review
      const tempCardId = `temp_${Date.now()}`;
      const patterns = await extractErrorPatterns(evalResult, prompt, tempCardId);
      recordErrorPatterns(patterns);

      let xp = XP_PER_EXERCISE;
      if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
      addXP(xp);
      window.dispatchEvent(new Event('gamification-update'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Save to library ──────────────────────────────────────────────
  const handleSaveToLibrary = () => {
    if (!evaluation) return;

    const card = isAudio
      ? createDefaultCard({
        type: exerciseType,
        prompt,
        targetVocabulary:
          config.hasVocab && targetVocab
            ? targetVocab.split(',').map(v => v.trim())
            : undefined,
        context: context || undefined,
        theme: theme || undefined,
        latestEvaluation: evaluation,
        userAudioBlob: userAudioBase64 || undefined,
      })
      : createDefaultCard({
        type: 'image',
        prompt,
        imageUrl,
        latestEvaluation: evaluation,
        userAudioBlob: userAudioBase64 || undefined,
      });

    addCard(card);
    setSaved(true);
    window.dispatchEvent(new Event('gamification-update'));
  };

  // ── Reset ────────────────────────────────────────────────────────
  const reset = () => {
    setPrompt('');
    setImageUrl('');
    setEvaluation(null);
    setError(null);
    setSaved(false);
    setUserAudioBase64(null);
  };

  // ── Render: Setup form ───────────────────────────────────────────
  if (!hasActiveSession && !isGenerating) {
    return (
      <div className="bg-card rounded-2xl p-5 border border-border space-y-6">
        {/* OUTPUT FORMAT */}
        <div>
          <SectionLabel>Output Format</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOutputFormat('audio')}
              className={cn(
                'flex flex-col items-center gap-2 py-5 rounded-2xl transition-colors duration-200 cursor-pointer',
                isAudio
                  ? 'bg-[var(--sky)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Mic size={24} />
              <span className="font-semibold text-sm">Audio + Text</span>
            </button>
            <button
              onClick={() => setOutputFormat('image')}
              className={cn(
                'flex flex-col items-center gap-2 py-5 rounded-2xl transition-colors duration-200 cursor-pointer',
                !isAudio
                  ? 'bg-[var(--coral)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <ImageIcon size={24} />
              <span className="font-semibold text-sm">Visual Prompt</span>
            </button>
          </div>
        </div>

        {/* PRACTICE TYPE — only for audio mode */}
        {isAudio && (
          <div>
            <SectionLabel>Practice Type</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {exerciseTypes.map(type => {
                const TypeIcon = exerciseConfig[type].icon;
                return (
                  <button
                    key={type}
                    onClick={() => setExerciseType(type)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-sm font-semibold transition-colors duration-200 cursor-pointer',
                      exerciseType === type
                        ? 'bg-[var(--sky)] text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    <TypeIcon size={20} />
                    <span>{exerciseConfig[type].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTEXT / THEME */}
        <div>
          <SectionLabel>Context / Theme</SectionLabel>
          <ThemeSelector
            selected={theme || ''}
            onSelect={(t) => setTheme(t)}
          />
        </div>

        {/* TARGET VOCABULARY — only for phrase/text in audio mode */}
        {isAudio && config.hasVocab && (
          <div>
            <SectionLabel>Target Vocabulary</SectionLabel>
            <Input
              value={targetVocab}
              onChange={e => setTargetVocab(e.target.value)}
              placeholder="e.g., gonna, would, might"
              hint="Separate with commas"
            />
          </div>
        )}

        {/* SPECIFIC TOPIC / CONTEXT - Only shown when "Custom Topic" is selected */}
        {theme === 'custom' && (
          <div>
            <SectionLabel>Specific Topic / Context</SectionLabel>
            <Input
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder={
                !isAudio
                  ? 'e.g., a busy street market, cozy coffee shop'
                  : exerciseType === 'roleplay'
                    ? 'e.g., returning a product, doctor appointment'
                    : 'e.g., ordering coffee, job interview'
              }
            />
          </div>
        )}

        {/* GENERATE BUTTON */}
        <Button
          variant="coral"
          size="lg"
          onClick={generate}
          className="w-full text-lg font-bold py-4 rounded-2xl cursor-pointer"
        >
          <Sparkles size={20} />
          {isAudio ? 'Generate Speech Task' : 'Generate Image Challenge'}
        </Button>

        {error && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Generating skeleton ──────────────────────────────────
  if (isGenerating && !hasActiveSession) {
    return (
      <div className="space-y-4">
        {!isAudio && <Skeleton className="aspect-video w-full rounded-2xl" />}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles
              size={16}
              className="text-[var(--coral)] animate-pulse"
            />
            <p className="text-sm text-muted-foreground font-semibold">
              {isAudio
                ? `Generating ${config.label.toLowerCase()}...`
                : 'Generating image challenge...'}
            </p>
          </div>
          <SkeletonText lines={isAudio ? config.skeletonLines : 2} />
        </div>
      </div>
    );
  }

  // ── Render: Active session (prompt shown, before evaluation) ─────
  if (hasActiveSession && !evaluation) {
    const ActiveIcon = isAudio ? config.icon : ImageIcon;
    return (
      <div className="space-y-6">
        {/* Back button - positioned above, aligned with page title */}
        <div className="flex items-center -ml-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground pl-0 gap-1 cursor-pointer"
          >
            <ChevronLeft size={16} />
            Back to Menu
          </Button>
        </div>

        {/* Image (visual prompt only) */}
        {imageUrl && (
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-border">
              <img
                src={imageUrl}
                alt="Challenge image to describe"
                className="w-full aspect-video object-cover"
              />
            </div>
            <button
              onClick={reset}
              aria-label="Dismiss prompt"
              className="absolute top-3 right-3 size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Prompt card */}
        <div className="relative">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <ActiveIcon size={18} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">
                {isAudio ? config.promptLabel : 'Your Task'}
              </p>
            </div>
            <p className="text-lg text-foreground leading-relaxed whitespace-pre-line text-pretty">
              {prompt}
            </p>
          </div>
          {/* Dismiss (audio mode only — image mode has dismiss on image) */}
          {!imageUrl && (
            <button
              onClick={reset}
              aria-label="Dismiss prompt"
              className="absolute top-4 right-4 size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <AudioRecorder onAudioReady={handleAudioReady} disabled={isEvaluating} />

        {isEvaluating && (
          <div className="flex items-center justify-center gap-2 text-[var(--sky)]">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-medium">Evaluating your speech...</span>
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

  // ── Render: Evaluation results ───────────────────────────────────
  if (evaluation) {
    const ResultIcon = isAudio ? config.icon : ImageIcon;
    return (
      <div className="space-y-5">
        {/* Image thumbnail (visual prompt only) */}
        {imageUrl && (
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={imageUrl}
              alt="Challenge image"
              className="w-full max-h-48 object-cover"
            />
          </div>
        )}

        {/* Original prompt */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <ResultIcon size={16} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">
              Original Prompt
            </p>
          </div>
          <p className="text-foreground whitespace-pre-line text-pretty">{prompt}</p>
        </div>

        <EvaluationResults
          result={evaluation}
          onSaveToLibrary={handleSaveToLibrary}
          showSaveButton={!saved}
        />

        {saved && (
          <div className="bg-[var(--leaf-soft)] rounded-2xl p-4 text-center">
            <p className="text-[var(--leaf)] font-bold">Saved to Library!</p>
          </div>
        )}

        <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
          <RefreshCw size={18} />
          Try Another
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
