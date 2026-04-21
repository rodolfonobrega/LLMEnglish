/**
 * F28 — Open-Ended Narrative Continuation
 *
 * Long-format spoken drill: the student hears a 2-3 sentence opening and must
 * continue the story out loud for up to 60 seconds. The transcription is sent
 * to the shared 5D evaluator (cardType = 'narrative continuation') which is
 * wired to emphasise fluency and completeness for this card type. We also
 * compute a client-side words-per-minute metric from the actual recording
 * duration and attach it as `evaluation.fluency_stats.wpm`.
 *
 * 2 rounds per session (see `ROUNDS_PER_SESSION`) — narrative is cognitively
 * expensive, so we keep sets short. At session end we award XP based on the
 * average scalar score (full XP; this is a long-format exercise) and persist
 * any canonical error patterns surfaced by the evaluator.
 *
 * Wave 4 ignores `briefing` beyond plumbing it into the seed prompt helper.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2, Play, RotateCcw, Square } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import {
  getNarrativeSeedPrompt,
  narrativeSeedResponseSchema,
  getEvaluationPrompt,
  evaluationResponseSchema,
} from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { ScorecardDisplay } from '../shared/ScorecardDisplay';
import { addXP } from '../../services/gamification';
import { recordErrorPatterns } from '../../services/errorAnalysis';
import { buildPatternFromCanonicalId } from '../../services/patterns';
import { runMasterPipeline } from '../../services/master/runPipeline';
import { normalizeEvaluationResult, normalizeCorrectionItem } from '../../types/card';
import type { EvaluationResult } from '../../types/card';
import type { Briefing } from '../../types/master';
import type { ErrorPattern } from '../../types/errors';

interface NarrativeContinuationProps {
  briefing?: Briefing;
}

interface NarrativeRound {
  opening_sentences: string;
  suggested_topic?: string;
}

interface RoundOutcome {
  round: NarrativeRound;
  transcription: string;
  wpm: number;
  recordingDurationSec: number;
  evaluation: EvaluationResult;
}

const ROUNDS_PER_SESSION = 2;
const MAX_RECORDING_SECONDS = 60;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function computeWpm(transcription: string, recordingDurationSec: number): number {
  const words = countWords(transcription);
  const minutes = Math.max(recordingDurationSec / 60, 0.1);
  return Math.round(words / minutes);
}

async function generateRound(briefing?: Briefing): Promise<NarrativeRound> {
  const systemPrompt = getNarrativeSeedPrompt(briefing);
  const response = await chatCompletion(
    systemPrompt,
    'Generate one narrative opening now.',
    undefined,
    narrativeSeedResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as NarrativeRound;
  if (!parsed.opening_sentences || typeof parsed.opening_sentences !== 'string') {
    throw new Error('Malformed narrative round (missing opening_sentences).');
  }
  return parsed;
}

async function evaluateContinuation(
  opening: string,
  transcription: string,
): Promise<EvaluationResult> {
  const evalPrompt = getEvaluationPrompt(opening, transcription, 'narrative continuation');
  const response = await chatCompletion(
    'You are an expert English language evaluator. Respond only with valid JSON.',
    evalPrompt,
    undefined,
    evaluationResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as EvaluationResult;
  parsed.userTranscription = transcription;
  return normalizeEvaluationResult(parsed);
}

export function NarrativeContinuation({ briefing }: NarrativeContinuationProps) {
  const [round, setRound] = useState<NarrativeRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundOutcome[]>([]);
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<RoundOutcome | null>(null);
  const [stage, setStage] = useState<'listening' | 'recording' | 'feedback' | 'summary'>(
    'listening',
  );
  const [remainingSec, setRemainingSec] = useState(MAX_RECORDING_SECONDS);

  const tts = useTTS();
  const recorder = useAudioRecorder();
  const { startRecording, stopRecording, discardRecording, audioBlob, isRecording } = recorder;

  const sessionCompleteRef = useRef(false);
  const recordingStartRef = useRef<number | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const autoStopRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const clearRecordingTimers = useCallback(() => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingTimers();
    };
  }, [clearRecordingTimers]);

  const loadNextRound = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setLastOutcome(null);
    setStage('listening');
    setRemainingSec(MAX_RECORDING_SECONDS);
    recordingStartRef.current = null;
    recordingDurationRef.current = 0;
    clearRecordingTimers();
    discardRecording();
    try {
      const next = await generateRound(briefing);
      setRound(next);
    } catch (err) {
      console.error('[NarrativeContinuation] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar a rodada.');
    } finally {
      setGenerating(false);
    }
  }, [briefing, discardRecording, clearRecordingTimers]);

  useEffect(() => {
    if (!round && roundIndex === 0 && results.length === 0) {
      void loadNextRound();
    }
  }, [round, roundIndex, results.length, loadNextRound]);

  const speakOpening = useCallback(() => {
    if (!round) return;
    void tts.speak(round.opening_sentences);
  }, [round, tts]);

  const finalizeSession = useCallback(async (finalResults: RoundOutcome[]) => {
    if (sessionCompleteRef.current) return;
    sessionCompleteRef.current = true;

    if (finalResults.length > 0) {
      const avgScore =
        finalResults.reduce((sum, r) => sum + (r.evaluation.score || 0), 0) /
        finalResults.length;
      const xp = Math.round(avgScore);
      if (xp > 0) {
        try {
          await addXP(xp);
        } catch (err) {
          console.warn('[NarrativeContinuation] XP award failed', err);
        }
      }
    }

    const now = new Date().toISOString();
    const patterns: ErrorPattern[] = [];
    for (const outcome of finalResults) {
      const corrections = outcome.evaluation.corrections ?? [];
      for (const raw of corrections) {
        const item = normalizeCorrectionItem(raw);
        if (!item.canonical_pattern) continue;
        const base = buildPatternFromCanonicalId(item.canonical_pattern);
        patterns.push({
          id: base.id,
          pattern: base.label,
          category: base.category,
          occurrences: 1,
          firstSeen: now,
          lastSeen: now,
          examples: [
            {
              cardId: `narrative-${now}`,
              date: now,
              userTranscription: outcome.transcription,
              correctedVersion: outcome.evaluation.correctedVersion || '',
              score: outcome.evaluation.score,
              prompt: outcome.round.opening_sentences,
            },
          ],
          trend: 'stable',
          recentScores: [outcome.evaluation.score],
        });
      }
    }

    if (patterns.length > 0) {
      try {
        await recordErrorPatterns(patterns);
      } catch (err) {
        console.warn('[NarrativeContinuation] error pattern recording failed', err);
      }
    }

    const lastOutcome = finalResults[finalResults.length - 1];
    if (lastOutcome) {
      void runMasterPipeline({
        evaluationResult: lastOutcome.evaluation,
        briefing,
        fallbackModality: 'narrative',
      });
    }
  }, [briefing]);

  const handleStartRecording = useCallback(async () => {
    if (!round) return;
    setError(null);
    setStage('recording');
    setRemainingSec(MAX_RECORDING_SECONDS);
    recordingStartRef.current = Date.now();
    recordingDurationRef.current = 0;
    try {
      await startRecording();
    } catch (err) {
      console.error('[NarrativeContinuation] startRecording failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao iniciar a gravação.');
      setStage('listening');
      return;
    }

    tickRef.current = window.setInterval(() => {
      if (recordingStartRef.current === null) return;
      const elapsed = (Date.now() - recordingStartRef.current) / 1000;
      const remaining = Math.max(0, MAX_RECORDING_SECONDS - Math.floor(elapsed));
      setRemainingSec(remaining);
    }, 250);

    autoStopRef.current = window.setTimeout(() => {
      stopRecording();
    }, MAX_RECORDING_SECONDS * 1000);
  }, [round, startRecording, stopRecording]);

  const handleStopRecording = useCallback(() => {
    if (recordingStartRef.current !== null) {
      recordingDurationRef.current = Math.min(
        MAX_RECORDING_SECONDS,
        (Date.now() - recordingStartRef.current) / 1000,
      );
    }
    clearRecordingTimers();
    stopRecording();
  }, [clearRecordingTimers, stopRecording]);

  useEffect(() => {
    if (!audioBlob || !round) return;
    let cancelled = false;
    const evaluate = async () => {
      setEvaluating(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const duration = recordingDurationRef.current > 0
          ? recordingDurationRef.current
          : MAX_RECORDING_SECONDS;
        const evaluation = await evaluateContinuation(round.opening_sentences, transcription);
        if (cancelled) return;
        const wpm = computeWpm(transcription, duration);
        evaluation.fluency_stats = { wpm };
        const outcome: RoundOutcome = {
          round,
          transcription,
          wpm,
          recordingDurationSec: duration,
          evaluation,
        };
        setLastOutcome(outcome);
        setResults((prev) => {
          const next = [...prev, outcome];
          if (next.length >= ROUNDS_PER_SESSION) {
            void finalizeSession(next);
          }
          return next;
        });
        setStage('feedback');
      } catch (err) {
        console.error('[NarrativeContinuation] evaluation failed', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao avaliar sua narrativa.');
          setStage('listening');
        }
      } finally {
        if (!cancelled) setEvaluating(false);
      }
    };
    void evaluate();
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
    setLastOutcome(null);
    setStage('listening');
    setRemainingSec(MAX_RECORDING_SECONDS);
    await loadNextRound();
  }, [loadNextRound]);

  const sessionAverage = useMemo(() => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + (r.evaluation.score || 0), 0);
    return sum / results.length;
  }, [results]);

  if (stage === 'summary') {
    const avgWpm = results.length
      ? Math.round(results.reduce((s, r) => s + r.wpm, 0) / results.length)
      : 0;
    const xpAwarded = Math.round(sessionAverage);
    return (
      <div className="space-y-6" data-testid="narrative-summary">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <BookOpen size={32} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground">Sessão concluída</h3>
          <p className="text-muted-foreground mt-1">
            Média: <strong>{sessionAverage.toFixed(1)}</strong> / 10 ({results.length} rodadas)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fluência média: {avgWpm} palavras/min
          </p>
          <p className="text-xs text-muted-foreground mt-2">+{xpAwarded} XP</p>
        </div>
        <Button onClick={handleRestart} className="w-full" size="lg">
          <RotateCcw size={18} />
          Nova sessão
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="narrative-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BookOpen size={14} />
          Rodada {roundIndex + 1} / {ROUNDS_PER_SESSION}
        </span>
        {stage === 'recording' && (
          <span className="tabular-nums text-destructive">
            {remainingSec.toString().padStart(2, '0')}s
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        {generating ? (
          <SkeletonText lines={3} />
        ) : round ? (
          <>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
              Ouça o começo e continue a história em inglês
            </p>
            <p className="text-lg font-medium text-foreground leading-relaxed">
              {round.opening_sentences}
            </p>
            {round.suggested_topic && (
              <p className="text-xs text-muted-foreground">
                Tema sugerido: <strong>{round.suggested_topic}</strong>
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={speakOpening}
              disabled={tts.isLoading || stage === 'recording'}
              className="w-full"
            >
              {tts.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Ouvir novamente
            </Button>
          </>
        ) : null}
      </div>

      {stage === 'listening' && round && !generating && !evaluating && (
        <Button
          onClick={handleStartRecording}
          disabled={isRecording}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Começar ({MAX_RECORDING_SECONDS}s)
        </Button>
      )}

      {stage === 'recording' && (
        <Button
          onClick={handleStopRecording}
          variant="coral"
          size="lg"
          className="w-full"
        >
          <Square size={18} />
          Terminei
        </Button>
      )}

      {evaluating && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Avaliando sua narrativa...
        </div>
      )}

      {stage === 'feedback' && lastOutcome && (
        <div className="space-y-4" data-testid="narrative-feedback">
          {lastOutcome.evaluation.scores5d && (
            <ScorecardDisplay
              scores={lastOutcome.evaluation.scores5d}
              primaryDimension={lastOutcome.evaluation.primaryDimension}
              scalar={lastOutcome.evaluation.score}
              size="md"
            />
          )}

          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground tabular-nums">
              {lastOutcome.wpm} palavras/min
            </span>
          </div>

          {lastOutcome.evaluation.overallFeedback && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground leading-relaxed">
              {lastOutcome.evaluation.overallFeedback}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
              Sua continuação
            </p>
            <p className="text-sm text-foreground italic">
              "{lastOutcome.transcription || '—'}"
            </p>
          </div>

          <Button onClick={handleNext} className="w-full" size="lg">
            {roundIndex + 1 >= ROUNDS_PER_SESSION ? 'Ver resumo' : 'Próxima rodada'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default NarrativeContinuation;
