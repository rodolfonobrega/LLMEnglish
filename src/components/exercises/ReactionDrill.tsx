/**
 * F29 — Reaction Drill
 *
 * Velocity-focused drill: the student hears a short provocation and must
 * react out loud under a tight time window (5s for the first 3 rounds, then
 * 3s). We score each round on an "automaticity" axis that blends latency
 * (how fast they finished speaking) with naturalness markers the tutor
 * expected to hear in a good reaction.
 *
 * This is explicitly framed to the student as "drill de velocidade, não
 * teste de gramática" — the goal is to unblock spontaneous speech, not to
 * catch grammar errors. That's why we do NOT record canonical error
 * patterns here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Play, RotateCcw, SkipForward, Timer, Zap } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import { getReactionDrillPrompt, reactionDrillResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { addXP } from '../../services/gamification';
import type { Briefing } from '../../types/master';

interface ReactionDrillProps {
  briefing?: Briefing;
}

interface ReactionLine {
  provocation: string;
  expected_naturalness_markers: string[];
}

interface RoundOutcome {
  line: ReactionLine;
  transcription: string;
  latencyMs: number;
  windowMs: number;
  latencyScore: number;
  markerScore: number;
  markersHit: string[];
  markersMissed: string[];
  automaticity: number;
  skipped: boolean;
}

const INITIAL_WINDOW_MS = 5000;
const TIGHTENED_WINDOW_MS = 3000;
const TIGHTEN_AFTER_ROUND = 3;
const COUNTDOWN_SECONDS = 3;

function windowForRound(roundIndex: number): number {
  return roundIndex < TIGHTEN_AFTER_ROUND ? INITIAL_WINDOW_MS : TIGHTENED_WINDOW_MS;
}

function computeLatencyScore(latencyMs: number, windowMs: number): number {
  if (windowMs <= 0) return 0;
  if (latencyMs >= windowMs) return 0;
  if (latencyMs <= 0) return 100;
  return Math.round((1 - latencyMs / windowMs) * 100);
}

function computeMarkerHits(transcription: string, markers: string[]): {
  hits: string[];
  missed: string[];
} {
  const text = transcription.toLowerCase();
  const hits: string[] = [];
  const missed: string[] = [];
  for (const marker of markers) {
    const needle = marker.trim().toLowerCase();
    if (!needle) continue;
    if (text.includes(needle)) {
      hits.push(marker);
    } else {
      missed.push(marker);
    }
  }
  return { hits, missed };
}

function computeMarkerScore(hits: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((hits / total) * 100);
}

function automaticityColor(score: number): string {
  if (score >= 80) return 'var(--leaf)';
  if (score >= 60) return 'var(--amber)';
  if (score >= 40) return 'var(--primary)';
  return 'var(--danger)';
}

async function generateLines(briefing?: Briefing): Promise<ReactionLine[]> {
  const systemPrompt = getReactionDrillPrompt(briefing);
  const response = await chatCompletion(
    systemPrompt,
    'Generate the reaction drill session now.',
    undefined,
    reactionDrillResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as { lines?: ReactionLine[] };
  if (!parsed.lines || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
    throw new Error('Malformed reaction drill payload (no lines).');
  }
  return parsed.lines.filter(
    (l) =>
      typeof l?.provocation === 'string' &&
      l.provocation.trim().length > 0 &&
      Array.isArray(l?.expected_naturalness_markers),
  );
}

export function ReactionDrill({ briefing }: ReactionDrillProps) {
  const [lines, setLines] = useState<ReactionLine[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [stage, setStage] = useState<'intro' | 'countdown' | 'playing' | 'feedback' | 'summary'>('intro');
  const [countdownValue, setCountdownValue] = useState<number>(COUNTDOWN_SECONDS);
  const [remainingMs, setRemainingMs] = useState<number>(INITIAL_WINDOW_MS);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<RoundOutcome | null>(null);

  const tts = useTTS();
  const recorder = useAudioRecorder();
  const { startRecording, stopRecording, discardRecording, audioBlob, isRecording } = recorder;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef<number>(0);
  const autoStoppedRef = useRef<boolean>(false);
  const skippedRef = useRef<boolean>(false);
  const sessionCompleteRef = useRef<boolean>(false);
  const awaitingSttRef = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const currentLine = lines[roundIndex];
  const windowMs = useMemo(() => windowForRound(roundIndex), [roundIndex]);

  const loadLines = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const next = await generateLines(briefing);
      setLines(next);
    } catch (err) {
      console.error('[ReactionDrill] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar o drill.');
    } finally {
      setGenerating(false);
    }
  }, [briefing]);

  useEffect(() => {
    if (stage === 'intro' && lines.length === 0 && !generating) {
      void loadLines();
    }
  }, [stage, lines.length, generating, loadLines]);

  const finalizeRound = useCallback(
    (outcome: RoundOutcome) => {
      clearTimers();
      setLastOutcome(outcome);
      setOutcomes((prev) => [...prev, outcome]);
      setStage('feedback');
    },
    [clearTimers],
  );

  const stopAndScore = useCallback(() => {
    if (awaitingSttRef.current) return;
    awaitingSttRef.current = true;
    autoStoppedRef.current = true;
    clearTimers();
    try {
      stopRecording();
    } catch (err) {
      console.warn('[ReactionDrill] stopRecording failed', err);
    }
  }, [clearTimers, stopRecording]);

  const startRound = useCallback(
    (index?: number) => {
      const targetIndex = typeof index === 'number' ? index : roundIndex;
      const line = lines[targetIndex];
      if (!line) return;
      clearTimers();
      autoStoppedRef.current = false;
      skippedRef.current = false;
      awaitingSttRef.current = false;
      setLastOutcome(null);
      setError(null);
      discardRecording();
      setStage('playing');

      const roundWindow = windowForRound(targetIndex);
      setRemainingMs(roundWindow);
      roundStartRef.current = Date.now();

      try {
        void tts.speak(line.provocation);
      } catch (err) {
        console.warn('[ReactionDrill] TTS failed', err);
      }

      void startRecording();

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - roundStartRef.current;
        const left = Math.max(0, roundWindow - elapsed);
        setRemainingMs(left);
        if (left <= 0) {
          stopAndScore();
        }
      }, 100);
    },
    [lines, roundIndex, tts, startRecording, discardRecording, clearTimers, stopAndScore],
  );

  const beginCountdown = useCallback(() => {
    if (lines.length === 0) return;
    setStage('countdown');
    setCountdownValue(COUNTDOWN_SECONDS);
    clearTimers();
    let remaining = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdownValue(0);
        startRound();
      } else {
        setCountdownValue(remaining);
      }
    }, 1000);
  }, [lines.length, clearTimers, startRound]);

  const finalizeSession = useCallback(async (final: RoundOutcome[]) => {
    if (sessionCompleteRef.current) return;
    sessionCompleteRef.current = true;
    const avg = final.length > 0
      ? final.reduce((sum, o) => sum + o.automaticity, 0) / final.length
      : 0;
    const xp = Math.round(avg / 5);
    if (xp > 0) {
      try {
        await addXP(xp);
      } catch (err) {
        console.warn('[ReactionDrill] XP award failed', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!audioBlob || !currentLine) return;
    if (!awaitingSttRef.current) return;
    let cancelled = false;

    const check = async () => {
      setChecking(true);
      setError(null);
      const latencyMs = Math.min(
        windowMs,
        Math.max(0, Date.now() - roundStartRef.current),
      );
      try {
        let transcription = '';
        try {
          transcription = await speechToText(audioBlob);
        } catch (err) {
          console.warn('[ReactionDrill] STT failed, scoring as empty', err);
          transcription = '';
        }
        if (cancelled) return;

        const markers = currentLine.expected_naturalness_markers ?? [];
        const { hits, missed } = computeMarkerHits(transcription, markers);
        const latencyScore = computeLatencyScore(latencyMs, windowMs);
        const markerScore = computeMarkerScore(hits.length, markers.length);
        const automaticity = Math.round(0.6 * latencyScore + 0.4 * markerScore);

        const outcome: RoundOutcome = {
          line: currentLine,
          transcription,
          latencyMs,
          windowMs,
          latencyScore,
          markerScore,
          markersHit: hits,
          markersMissed: missed,
          automaticity,
          skipped: false,
        };
        awaitingSttRef.current = false;
        finalizeRound(outcome);
      } catch (err) {
        console.error('[ReactionDrill] scoring failed', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao pontuar a rodada.');
          awaitingSttRef.current = false;
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

  const handleManualStop = useCallback(() => {
    if (!isRecording || awaitingSttRef.current) return;
    awaitingSttRef.current = true;
    clearTimers();
    try {
      stopRecording();
    } catch (err) {
      console.warn('[ReactionDrill] manual stop failed', err);
    }
  }, [isRecording, clearTimers, stopRecording]);

  const handleSkip = useCallback(() => {
    if (!currentLine) return;
    skippedRef.current = true;
    awaitingSttRef.current = false;
    clearTimers();
    try {
      if (isRecording) stopRecording();
    } catch (err) {
      console.warn('[ReactionDrill] skip stop failed', err);
    }
    discardRecording();

    const outcome: RoundOutcome = {
      line: currentLine,
      transcription: '',
      latencyMs: windowMs,
      windowMs,
      latencyScore: 0,
      markerScore: 0,
      markersHit: [],
      markersMissed: currentLine.expected_naturalness_markers ?? [],
      automaticity: 0,
      skipped: true,
    };
    finalizeRound(outcome);
  }, [
    currentLine,
    windowMs,
    isRecording,
    stopRecording,
    discardRecording,
    clearTimers,
    finalizeRound,
  ]);

  const handleAdvance = useCallback(() => {
    const nextIndex = roundIndex + 1;
    if (nextIndex >= lines.length) {
      setStage('summary');
      void finalizeSession(outcomes);
      return;
    }
    setRoundIndex(nextIndex);
    setLastOutcome(null);
    startRound(nextIndex);
  }, [roundIndex, lines.length, outcomes, finalizeSession, startRound]);

  const handleRestart = useCallback(async () => {
    clearTimers();
    sessionCompleteRef.current = false;
    autoStoppedRef.current = false;
    skippedRef.current = false;
    awaitingSttRef.current = false;
    setOutcomes([]);
    setRoundIndex(0);
    setLastOutcome(null);
    setLines([]);
    setStage('intro');
    await loadLines();
  }, [clearTimers, loadLines]);

  const averageAutomaticity = useMemo(() => {
    if (outcomes.length === 0) return 0;
    return Math.round(
      outcomes.reduce((sum, o) => sum + o.automaticity, 0) / outcomes.length,
    );
  }, [outcomes]);

  if (stage === 'intro') {
    return (
      <div className="space-y-6" data-testid="reaction-drill-intro">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={22} className="text-primary" />
            <h3 className="text-xl font-bold text-foreground">Reaction Drill</h3>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            Este é um <strong>drill de velocidade, não teste de gramática</strong>.
            O objetivo é soltar a fala — reagir rápido, do jeito que sair.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>Você vai ouvir uma provocação curta.</li>
            <li>Tem {INITIAL_WINDOW_MS / 1000}s nas 3 primeiras rodadas, depois {TIGHTENED_WINDOW_MS / 1000}s.</li>
            <li>Sem pensar muito — só reaja. Se travar, pula.</li>
          </ul>
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}
          {generating ? (
            <SkeletonText lines={2} />
          ) : (
            <Button
              onClick={beginCountdown}
              disabled={lines.length === 0}
              className="w-full"
              size="lg"
            >
              <Play size={18} />
              Começar drill
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'countdown') {
    const label = countdownValue > 0 ? String(countdownValue) : 'go';
    return (
      <div
        className="rounded-2xl bg-card border border-border p-10 text-center space-y-2"
        data-testid="reaction-drill-round"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Prepara…
        </p>
        <div className="text-7xl font-black text-primary tabular-nums">{label}</div>
        <p className="text-xs text-muted-foreground">3... 2... 1... go</p>
      </div>
    );
  }

  if (stage === 'summary') {
    const avgColor = automaticityColor(averageAutomaticity);
    const xp = Math.round(averageAutomaticity / 5);
    return (
      <div className="space-y-6" data-testid="reaction-drill-summary">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={22} className="text-primary" />
            <h3 className="text-xl font-bold text-foreground">Drill concluído</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">Automaticity</span>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: avgColor }}
              >
                {averageAutomaticity}
              </span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100, averageAutomaticity))}%`,
                  backgroundColor: avgColor,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Média de velocidade + naturalidade nas {outcomes.length} rodadas.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">+{xp} XP</p>
        </div>
        <Button onClick={handleRestart} className="w-full" size="lg">
          <RotateCcw size={18} />
          Novo drill
        </Button>
      </div>
    );
  }

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progressPct = Math.max(0, Math.min(100, (remainingMs / windowMs) * 100));

  return (
    <div className="space-y-5" data-testid="reaction-drill-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Zap size={14} />
          Rodada {roundIndex + 1} / {lines.length}
        </span>
        <span className="flex items-center gap-1.5">
          <Timer size={14} />
          {windowMs / 1000}s
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
          Reaja em voz alta
        </p>
        {currentLine ? (
          <p className="text-lg font-medium text-foreground leading-snug">
            {currentLine.provocation}
          </p>
        ) : (
          <SkeletonText lines={2} />
        )}

        {stage === 'playing' && (
          <>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: secondsLeft <= 1 ? 'var(--danger)' : 'var(--primary)',
                  transition: 'width 100ms linear',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {secondsLeft}s restantes
            </p>
          </>
        )}
      </div>

      {stage === 'playing' && (
        <div className="flex gap-2">
          <Button
            onClick={handleManualStop}
            disabled={checking || !isRecording}
            variant="primary"
            size="lg"
            className="flex-1"
          >
            {checking ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>Terminei</>
            )}
          </Button>
          <Button
            onClick={handleSkip}
            disabled={checking}
            variant="secondary"
            size="lg"
          >
            <SkipForward size={16} />
            Pular rodada
          </Button>
        </div>
      )}

      {stage === 'feedback' && lastOutcome && (
        <div
          className="rounded-2xl p-4 border border-border bg-card space-y-3"
          data-testid="reaction-drill-feedback"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-foreground">Automaticity</span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: automaticityColor(lastOutcome.automaticity) }}
            >
              {lastOutcome.automaticity}
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--muted)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, lastOutcome.automaticity))}%`,
                backgroundColor: automaticityColor(lastOutcome.automaticity),
              }}
            />
          </div>
          {lastOutcome.skipped ? (
            <p className="text-xs text-muted-foreground italic">Rodada pulada — 0.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Você disse: "{lastOutcome.transcription || '—'}"
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="font-bold uppercase tracking-wider text-leaf mb-1">Acertou</p>
                  {lastOutcome.markersHit.length > 0 ? (
                    <ul className="space-y-0.5 text-muted-foreground">
                      {lastOutcome.markersHit.map((m) => (
                        <li key={`hit-${m}`}>• {m}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">—</p>
                  )}
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wider text-destructive mb-1">Faltou</p>
                  {lastOutcome.markersMissed.length > 0 ? (
                    <ul className="space-y-0.5 text-muted-foreground">
                      {lastOutcome.markersMissed.map((m) => (
                        <li key={`miss-${m}`}>• {m}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">—</p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Velocidade {lastOutcome.latencyScore} · Naturalidade {lastOutcome.markerScore}
              </p>
            </>
          )}
          <Button onClick={handleAdvance} className="w-full mt-2" size="sm">
            {roundIndex + 1 >= lines.length ? 'Ver resultado' : 'Próxima rodada'}
          </Button>
        </div>
      )}

    </div>
  );
}
