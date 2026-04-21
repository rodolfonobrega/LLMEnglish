/**
 * F27 — Error Spotting
 *
 * Focused drill: the student hears a planted English sentence that contains
 * exactly ONE deliberate mistake and must say the corrected version aloud.
 * An LLM judge decides whether the student's transcription is semantically
 * equivalent to the reference correction (meaning-first; synonyms and minor
 * rephrasing are accepted as long as the planted error is fixed).
 *
 * 7 rounds per session (see `ROUNDS_PER_SESSION`). At session end a compact
 * summary is shown and the student can start a new set.
 *
 * Wave 4 ignores `briefing` beyond plumbing it into the prompt helper.
 * Wave 5 will wire the Master so the planted pattern can be targeted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, Play, RotateCcw, Check, X } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import { getErrorSpottingPrompt, errorSpottingResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { addXP } from '../../services/gamification';
import { recordErrorPatterns } from '../../services/errorAnalysis';
import { recordDrillOutcome } from '../../services/master/runPipeline';
import { buildPatternFromCanonicalId } from '../../services/patterns';
import type { Briefing } from '../../types/master';
import type { ErrorPattern } from '../../types/errors';

interface ErrorSpottingProps {
  briefing?: Briefing;
}

interface SpottingRound {
  planted_sentence: string;
  error_description?: string;
  correction: string;
  canonical_pattern: string;
}

interface RoundResult {
  round: SpottingRound;
  heardAttempt: string;
  equivalent: boolean;
  judgeReason: string;
}

const ROUNDS_PER_SESSION = 7;
const XP_PER_CORRECT = 4;

const judgeSchema = {
  type: 'object' as const,
  properties: {
    equivalent: {
      type: 'boolean' as const,
      description: 'True when the attempt fixes the planted error with equivalent meaning.',
    },
    reason: {
      type: 'string' as const,
      description: 'Short Portuguese explanation of the verdict (1 sentence).',
    },
  },
  required: ['equivalent', 'reason'],
};

const judgeSystem = `You are judging whether a student's attempt to correct an English sentence matches the reference correction.
Respond ONLY with a single JSON object matching the schema. Judge by MEANING, not by exact wording — synonyms, contractions, and minor rephrasing should be accepted as long as the planted error is fixed.`;

async function generateRound(briefing?: Briefing): Promise<SpottingRound> {
  const systemPrompt = getErrorSpottingPrompt({ briefing });
  const response = await chatCompletion(
    systemPrompt,
    'Generate one error spotting round now.',
    undefined,
    errorSpottingResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as SpottingRound;
  if (!parsed.planted_sentence || !parsed.correction || !parsed.canonical_pattern) {
    throw new Error('Malformed error spotting round (missing required fields).');
  }
  return parsed;
}

async function judgeAttempt(
  round: SpottingRound,
  transcription: string,
): Promise<{ equivalent: boolean; reason: string }> {
  const userMsg = `Planted sentence: "${round.planted_sentence}"\nReference correction: "${round.correction}"\nStudent said: "${transcription}"\nDoes the student's attempt fix the planted error with equivalent meaning?`;
  const resp = await chatCompletion(judgeSystem, userMsg, undefined, judgeSchema);
  const parsed = JSON.parse(cleanJson(resp)) as { equivalent: boolean; reason: string };
  return {
    equivalent: Boolean(parsed.equivalent),
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

export function ErrorSpotting({ briefing }: ErrorSpottingProps) {
  const [round, setRound] = useState<SpottingRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [stage, setStage] = useState<'playing' | 'feedback' | 'summary'>('playing');

  const tts = useTTS();
  const recorder = useAudioRecorder();
  const { startRecording, stopRecording, discardRecording, audioBlob, isRecording } = recorder;
  const sessionCompleteRef = useRef(false);

  const loadNextRound = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setLastResult(null);
    setStage('playing');
    discardRecording();
    try {
      const next = await generateRound(briefing);
      setRound(next);
    } catch (err) {
      console.error('[ErrorSpotting] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar a rodada.');
    } finally {
      setGenerating(false);
    }
  }, [briefing, discardRecording]);

  useEffect(() => {
    if (!round && roundIndex === 0 && results.length === 0) {
      void loadNextRound();
    }
  }, [round, roundIndex, results.length, loadNextRound]);

  const speakPrompt = useCallback(() => {
    if (!round) return;
    void tts.speak(round.planted_sentence);
  }, [round, tts]);

  const finalizeSession = useCallback(async (finalResults: RoundResult[]) => {
    if (sessionCompleteRef.current) return;
    sessionCompleteRef.current = true;

    const correctCount = finalResults.filter((r) => r.equivalent).length;
    const totalXp = correctCount * XP_PER_CORRECT;
    if (totalXp > 0) {
      try {
        await addXP(totalXp);
      } catch (err) {
        console.warn('[ErrorSpotting] XP award failed', err);
      }
    }

    const now = new Date().toISOString();
    const patterns: ErrorPattern[] = finalResults
      .filter((r) => !r.equivalent && r.round.canonical_pattern)
      .map<ErrorPattern>((r) => {
        const base = buildPatternFromCanonicalId(r.round.canonical_pattern);
        return {
          id: base.id,
          pattern: base.label,
          category: base.category,
          occurrences: 1,
          firstSeen: now,
          lastSeen: now,
          examples: [
            {
              cardId: `error-spotting-${now}`,
              date: now,
              userTranscription: r.heardAttempt,
              correctedVersion: r.round.correction,
              score: 0,
              prompt: r.round.planted_sentence,
            },
          ],
          trend: 'stable',
          recentScores: [0],
        };
      });

    if (patterns.length > 0) {
      try {
        await recordErrorPatterns(patterns);
      } catch (err) {
        console.warn('[ErrorSpotting] error pattern recording failed', err);
      }
    }

    const dominantPattern = finalResults.find((r) => r.round.canonical_pattern)
      ?.round.canonical_pattern;
    void recordDrillOutcome(briefing, {
      canonicalPattern: dominantPattern,
      attempts: finalResults.length,
      correct: correctCount,
      modality: 'spotting',
    });
  }, [briefing]);

  useEffect(() => {
    if (!audioBlob || !round) return;
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const verdict = await judgeAttempt(round, transcription);
        if (cancelled) return;
        const result: RoundResult = {
          round,
          heardAttempt: transcription,
          equivalent: verdict.equivalent,
          judgeReason: verdict.reason,
        };
        setLastResult(result);
        setResults((prev) => {
          const next = [...prev, result];
          if (next.length >= ROUNDS_PER_SESSION) {
            void finalizeSession(next);
          }
          return next;
        });
        setStage('feedback');
      } catch (err) {
        console.error('[ErrorSpotting] check failed', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao avaliar sua resposta.');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);

  const handleNext = useCallback(async () => {
    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUNDS_PER_SESSION) {
      setStage('summary');
      return;
    }
    setRoundIndex(nextIndex);
    await loadNextRound();
  }, [roundIndex, loadNextRound]);

  const handleRestart = useCallback(async () => {
    sessionCompleteRef.current = false;
    setResults([]);
    setRoundIndex(0);
    setRound(null);
    setLastResult(null);
    setStage('playing');
    await loadNextRound();
  }, [loadNextRound]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const correctCount = useMemo(() => results.filter((r) => r.equivalent).length, [results]);

  if (stage === 'summary') {
    return (
      <div className="space-y-6" data-testid="error-spotting-summary">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <Search size={32} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground">Sessão concluída</h3>
          <p className="text-muted-foreground mt-1">
            {correctCount} de {results.length} rodadas corretas
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            +{correctCount * XP_PER_CORRECT} XP
          </p>
        </div>
        <Button onClick={handleRestart} className="w-full" size="lg">
          <RotateCcw size={18} />
          Nova sessão
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="error-spotting-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Search size={14} />
          Rodada {roundIndex + 1} / {ROUNDS_PER_SESSION}
        </span>
        <span>{correctCount} acertos</span>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        {generating ? (
          <SkeletonText lines={2} />
        ) : round ? (
          <>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
              Ouça a frase e diga a versão corrigida
            </p>
            <p className="text-lg font-medium text-foreground">{round.planted_sentence}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={speakPrompt}
              disabled={tts.isLoading}
              className="w-full"
            >
              {tts.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Ouvir
            </Button>
          </>
        ) : null}
      </div>

      {stage === 'playing' && round && !generating && (
        <Button
          onClick={toggleRecording}
          disabled={checking}
          variant={isRecording ? 'coral' : 'primary'}
          size="lg"
          className="w-full"
        >
          {checking ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isRecording ? (
            <>Parar e verificar</>
          ) : (
            <>Gravar correção</>
          )}
        </Button>
      )}

      {stage === 'feedback' && lastResult && (
        <div
          className={`rounded-2xl p-4 border ${
            lastResult.equivalent
              ? 'border-leaf/30 bg-leaf-soft'
              : 'border-destructive/30 bg-destructive/10'
          }`}
          data-testid="error-spotting-feedback"
        >
          <div className="flex items-center gap-2 mb-2">
            {lastResult.equivalent ? (
              <Check size={18} className="text-leaf" />
            ) : (
              <X size={18} className="text-destructive" />
            )}
            <span
              className={`text-sm font-bold ${
                lastResult.equivalent ? 'text-leaf' : 'text-destructive'
              }`}
            >
              {lastResult.equivalent ? 'Certo!' : 'Ainda não'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Você disse: "{lastResult.heardAttempt || '—'}"
          </p>
          <p className="text-xs text-muted-foreground">
            Correção: <strong>{lastResult.round.correction}</strong>
          </p>
          {lastResult.judgeReason && (
            <p className="text-xs text-muted-foreground mt-2 italic">{lastResult.judgeReason}</p>
          )}
          <Button onClick={handleNext} className="w-full mt-4" size="sm">
            Próxima rodada
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorSpotting;
