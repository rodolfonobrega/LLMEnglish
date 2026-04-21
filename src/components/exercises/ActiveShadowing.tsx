/**
 * F23 — Active Shadowing
 *
 * Rhythm drill: the student hears a short natural line via TTS and must repeat
 * it out loud, matching pace as closely as possible. We score three things:
 *
 *   - wordAccuracy  — token-level Levenshtein match (STT vs. the reference line).
 *   - durationScore — how close the student's speaking duration is to the
 *                     expected TTS duration (estimated from word count because
 *                     we don't have reliable Web Speech timing client-side).
 *   - rhythmScore   — blended final score: 0.6 * wordAccuracy + 0.4 * durationScore.
 *
 * Prosody / pitch analysis is deferred (D1); we intentionally do not try to
 * measure it here.
 *
 * 5 rounds per session. XP is awarded at session end based on the average
 * rhythm score. Active Shadowing does NOT use canonical pattern recording —
 * we skip `recordErrorPatterns` entirely.
 *
 * Wave 4 ignores `briefing` (plumbing only). Wave 5 will wire the Master.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Loader2, Play, RotateCcw } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import { getShadowingLinePrompt, shadowingLineResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { addXP } from '../../services/gamification';
import { recordDrillOutcome } from '../../services/master/runPipeline';
import type { Briefing } from '../../types/master';

interface ActiveShadowingProps {
  briefing?: Briefing;
}

interface ShadowingRound {
  line: string;
  context_hint_pt?: string;
}

interface RoundMetrics {
  round: ShadowingRound;
  transcription: string;
  expectedDurationMs: number;
  studentDurationMs: number;
  wordAccuracy: number;
  durationScore: number;
  durationRatio: number;
  rhythmScore: number;
}

const ROUNDS_PER_SESSION = 5;
const WORDS_PER_SECOND_ESTIMATE = 3.33;
const PRE_RECORD_GAP_MS = 700;
const AUTO_STOP_MS = 12_000;

// ---------------------------------------------------------------------------
// Scoring helpers (inline — see module docstring for semantics)
// ---------------------------------------------------------------------------

function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[.,!?;:'"()]/g, '').split(/\s+/).filter(Boolean);
}

function durationScoreFor(ratio: number): number {
  if (ratio >= 0.8 && ratio <= 1.2) return 100;
  if (ratio < 0.3 || ratio > 2.0) return 0;
  if (ratio < 0.8) return Math.round(((ratio - 0.3) / 0.5) * 100);
  return Math.round(((2.0 - ratio) / 0.8) * 100);
}

function expectedDurationMs(line: string): number {
  const wordCount = tokenize(line).length;
  if (wordCount === 0) return 1000;
  return Math.round((wordCount / WORDS_PER_SECOND_ESTIMATE) * 1000);
}

function computeWordAccuracy(reference: string, transcription: string): number {
  const refTokens = tokenize(reference);
  const hypTokens = tokenize(transcription);
  const distance = levenshtein(refTokens, hypTokens);
  const denom = Math.max(refTokens.length, 1);
  return Math.round(100 * (1 - distance / denom));
}

// ---------------------------------------------------------------------------
// Round generation
// ---------------------------------------------------------------------------

async function generateRound(briefing?: Briefing): Promise<ShadowingRound> {
  const systemPrompt = getShadowingLinePrompt(briefing);
  const response = await chatCompletion(
    systemPrompt,
    'Generate one shadowing line now.',
    undefined,
    shadowingLineResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as ShadowingRound;
  if (!parsed.line || typeof parsed.line !== 'string') {
    throw new Error('Malformed shadowing round (missing line).');
  }
  return parsed;
}

export function ActiveShadowing({ briefing }: ActiveShadowingProps) {
  const [round, setRound] = useState<ShadowingRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundMetrics[]>([]);
  const [generating, setGenerating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RoundMetrics | null>(null);
  const [stage, setStage] = useState<'playing' | 'feedback' | 'summary'>('playing');

  const tts = useTTS();
  const recorder = useAudioRecorder();
  const { startRecording, stopRecording, discardRecording, audioBlob, isRecording } = recorder;

  const sessionCompleteRef = useRef(false);
  const recordStartRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);
  const preRecordGapTimerRef = useRef<number | null>(null);

  const clearAutoTimers = useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (preRecordGapTimerRef.current !== null) {
      window.clearTimeout(preRecordGapTimerRef.current);
      preRecordGapTimerRef.current = null;
    }
  }, []);

  const beginRecording = useCallback(async () => {
    try {
      await startRecording();
      recordStartRef.current = Date.now();
      autoStopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, AUTO_STOP_MS);
    } catch (err) {
      console.warn('[ActiveShadowing] could not start recording', err);
    }
  }, [startRecording, stopRecording]);

  const playLineAndArmRecording = useCallback(async (line: string) => {
    try {
      await tts.speak(line);
    } catch (err) {
      console.warn('[ActiveShadowing] TTS failed', err);
    }
    preRecordGapTimerRef.current = window.setTimeout(() => {
      void beginRecording();
    }, PRE_RECORD_GAP_MS);
  }, [tts, beginRecording]);

  const loadNextRound = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setLastResult(null);
    setStage('playing');
    discardRecording();
    clearAutoTimers();
    recordStartRef.current = null;
    try {
      const next = await generateRound(briefing);
      setRound(next);
      void playLineAndArmRecording(next.line);
    } catch (err) {
      console.error('[ActiveShadowing] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar a rodada.');
    } finally {
      setGenerating(false);
    }
  }, [briefing, discardRecording, clearAutoTimers, playLineAndArmRecording]);

  useEffect(() => {
    if (!round && roundIndex === 0 && results.length === 0) {
      void loadNextRound();
    }
  }, [round, roundIndex, results.length, loadNextRound]);

  useEffect(() => {
    return () => {
      clearAutoTimers();
    };
  }, [clearAutoTimers]);

  const finalizeSession = useCallback(async (finalResults: RoundMetrics[]) => {
    if (sessionCompleteRef.current) return;
    sessionCompleteRef.current = true;

    const avgRhythm = finalResults.length
      ? finalResults.reduce((sum, r) => sum + r.rhythmScore, 0) / finalResults.length
      : 0;
    const xp = Math.round(avgRhythm / 10);
    if (xp > 0) {
      try {
        await addXP(xp);
      } catch (err) {
        console.warn('[ActiveShadowing] XP award failed', err);
      }
    }

    const correctCount = finalResults.filter((r) => r.rhythmScore >= 60).length;
    void recordDrillOutcome(briefing, {
      attempts: finalResults.length,
      correct: correctCount,
      modality: 'shadowing',
    });
  }, [briefing]);

  useEffect(() => {
    if (!audioBlob || !round) return;
    const startedAt = recordStartRef.current;
    if (startedAt === null) return;

    const studentDurationMs = Math.max(0, Date.now() - startedAt);
    recordStartRef.current = null;

    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    let cancelled = false;
    const score = async () => {
      setScoring(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const expected = expectedDurationMs(round.line);
        const wordAccuracy = computeWordAccuracy(round.line, transcription);
        const durationRatio = expected > 0 ? studentDurationMs / expected : 0;
        const durationScore = durationScoreFor(durationRatio);
        const rhythmScore = Math.round(0.6 * wordAccuracy + 0.4 * durationScore);
        const metrics: RoundMetrics = {
          round,
          transcription,
          expectedDurationMs: expected,
          studentDurationMs,
          wordAccuracy,
          durationScore,
          durationRatio,
          rhythmScore,
        };
        setLastResult(metrics);
        setResults((prev) => {
          const next = [...prev, metrics];
          if (next.length >= ROUNDS_PER_SESSION) {
            void finalizeSession(next);
          }
          return next;
        });
        setStage('feedback');
      } catch (err) {
        console.error('[ActiveShadowing] STT failed', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao reconhecer o áudio.');
      } finally {
        if (!cancelled) setScoring(false);
      }
    };
    void score();
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

  const handleFinishRecording = useCallback(() => {
    if (!isRecording) return;
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    stopRecording();
  }, [isRecording, stopRecording]);

  const handleReplayLine = useCallback(() => {
    if (!round) return;
    void tts.speak(round.line);
  }, [round, tts]);

  const avgRhythm = useMemo(() => {
    if (results.length === 0) return 0;
    return Math.round(results.reduce((sum, r) => sum + r.rhythmScore, 0) / results.length);
  }, [results]);

  if (stage === 'summary') {
    return (
      <div className="space-y-6" data-testid="active-shadowing-summary">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <Clock size={32} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground">Sessão concluída</h3>
          <p className="text-muted-foreground mt-1">
            Ritmo médio: {avgRhythm} / 100
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            +{Math.round(avgRhythm / 10)} XP
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
    <div className="space-y-6" data-testid="active-shadowing-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          Rodada {roundIndex + 1} / {ROUNDS_PER_SESSION}
        </span>
        <span>Ritmo médio: {avgRhythm}</span>
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
              Ouça e repita imitando o ritmo
            </p>
            {round.context_hint_pt && (
              <p className="text-xs text-muted-foreground italic">
                {round.context_hint_pt}
              </p>
            )}
            <p className="text-lg font-medium text-foreground">
              {round.line}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplayLine}
              disabled={tts.isLoading || isRecording}
              className="w-full"
            >
              {tts.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Ouvir novamente
            </Button>
          </>
        ) : null}
      </div>

      {stage === 'playing' && round && !generating && (
        <Button
          onClick={handleFinishRecording}
          disabled={scoring || !isRecording}
          variant={isRecording ? 'coral' : 'primary'}
          size="lg"
          className="w-full"
        >
          {scoring ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isRecording ? (
            <>Terminei</>
          ) : (
            <>Aguardando gravação…</>
          )}
        </Button>
      )}

      {stage === 'feedback' && lastResult && (
        <div
          className="rounded-2xl p-4 border border-border bg-card"
          data-testid="active-shadowing-feedback"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock size={18} className="text-primary" />
            <span className="text-sm font-bold text-foreground">
              Ritmo: {lastResult.rhythmScore} / 100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="uppercase tracking-wider text-[10px] font-bold">Precisão</p>
              <p className="text-base font-semibold text-foreground mt-1">
                {lastResult.wordAccuracy}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="uppercase tracking-wider text-[10px] font-bold">Duração</p>
              <p className="text-base font-semibold text-foreground mt-1">
                {lastResult.durationScore}
              </p>
              <p className="text-[10px] mt-0.5">
                proporção {lastResult.durationRatio.toFixed(2)}x
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Referência: <strong>{lastResult.round.line}</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Você disse: "{lastResult.transcription || '—'}"
          </p>
          <Button onClick={handleNext} className="w-full mt-4" size="sm">
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
