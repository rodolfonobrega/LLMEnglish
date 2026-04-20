/**
 * F26 — Reformulation
 *
 * Focused drill: the student hears a stiff/awkward English sentence and must
 * rephrase it aloud in a target style (more_casual, more_formal, shorter, or
 * more_natural). The student response is graded by the shared 5D evaluator —
 * which naturally emphasises `pragmatics` (register fit) and `naturalness`
 * (sounding native in the target register) — and the model's reference
 * reformulations are shown as suggested alternatives.
 *
 * 4 rounds per session (see `ROUNDS_PER_SESSION`). At session end a compact
 * summary is shown and the student can start a new set.
 *
 * Wave 4 always generates a fresh source per round. Pulling a stiff candidate
 * from the student's own history is allowed by the plan but is deferred — the
 * Master (Wave 5) is a better place to make that decision.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, Loader2, Play, RotateCcw } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import {
  getReformulationPrompt,
  reformulationResponseSchema,
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
import type { Briefing } from '../../types/master';
import type { EvaluationResult } from '../../types/card';
import { normalizeCorrectionItem, normalizeEvaluationResult } from '../../types/card';
import type { ErrorPattern } from '../../types/errors';

interface ReformulationProps {
  briefing?: Briefing;
}

const ROUNDS_PER_SESSION = 4;
const TARGET_STYLES = ['more_casual', 'more_formal', 'shorter', 'more_natural'] as const;
type TargetStyle = typeof TARGET_STYLES[number];

const STYLE_LABELS_PT: Record<TargetStyle, string> = {
  more_casual: 'Mais casual',
  more_formal: 'Mais formal',
  shorter: 'Mais curto',
  more_natural: 'Mais natural',
};

const STYLE_INSTRUCTIONS_PT: Record<TargetStyle, string> = {
  more_casual: 'Refraseie essa frase de um jeito mais casual.',
  more_formal: 'Refraseie essa frase de um jeito mais formal.',
  shorter: 'Refraseie essa frase de um jeito mais curto.',
  more_natural: 'Refraseie essa frase de um jeito mais natural.',
};

interface ReformulationRound {
  source: string;
  target_style: TargetStyle;
  reference_examples: string[];
}

interface RoundOutcome {
  round: ReformulationRound;
  transcription: string;
  evaluation: EvaluationResult;
}

function pickRandomStyle(): TargetStyle {
  const idx = Math.floor(Math.random() * TARGET_STYLES.length);
  return TARGET_STYLES[idx];
}

function isTargetStyle(value: unknown): value is TargetStyle {
  return typeof value === 'string' && (TARGET_STYLES as readonly string[]).includes(value);
}

async function generateRound(briefing?: Briefing): Promise<ReformulationRound> {
  const target_style = pickRandomStyle();
  const systemPrompt = getReformulationPrompt({ target_style, briefing });
  const response = await chatCompletion(
    systemPrompt,
    'Generate one reformulation round now.',
    undefined,
    reformulationResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as Partial<ReformulationRound>;
  if (
    !parsed.source ||
    !Array.isArray(parsed.reference_examples) ||
    parsed.reference_examples.length === 0
  ) {
    throw new Error('Malformed reformulation round (missing required fields).');
  }
  const resolvedStyle: TargetStyle = isTargetStyle(parsed.target_style)
    ? parsed.target_style
    : target_style;
  return {
    source: parsed.source,
    target_style: resolvedStyle,
    reference_examples: parsed.reference_examples.filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0,
    ),
  };
}

async function evaluateAttempt(
  round: ReformulationRound,
  transcription: string,
): Promise<EvaluationResult> {
  const evalPrompt = getEvaluationPrompt(round.source, transcription, 'reformulation');
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

export function Reformulation({ briefing }: ReformulationProps) {
  const [round, setRound] = useState<ReformulationRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundOutcome[]>([]);
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RoundOutcome | null>(null);
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
      console.error('[Reformulation] generation failed', err);
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
    void tts.speak(round.source);
  }, [round, tts]);

  const finalizeSession = useCallback(async (finalResults: RoundOutcome[]) => {
    if (sessionCompleteRef.current) return;
    sessionCompleteRef.current = true;

    const totalXp = Math.round(
      finalResults.reduce((sum, r) => sum + (r.evaluation.score || 0), 0),
    );
    if (totalXp > 0) {
      try {
        await addXP(totalXp);
      } catch (err) {
        console.warn('[Reformulation] XP award failed', err);
      }
    }

    const now = new Date().toISOString();
    const patterns: ErrorPattern[] = [];
    for (const outcome of finalResults) {
      const corrections = (outcome.evaluation.corrections ?? []).map(normalizeCorrectionItem);
      for (const correction of corrections) {
        if (!correction.canonical_pattern) continue;
        const base = buildPatternFromCanonicalId(correction.canonical_pattern);
        patterns.push({
          id: base.id,
          pattern: base.label,
          category: base.category,
          occurrences: 1,
          firstSeen: now,
          lastSeen: now,
          examples: [
            {
              cardId: `reformulation-${now}`,
              date: now,
              userTranscription: outcome.transcription,
              correctedVersion: outcome.evaluation.correctedVersion,
              score: outcome.evaluation.score,
              prompt: outcome.round.source,
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
        console.warn('[Reformulation] error pattern recording failed', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!audioBlob || !round) return;
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const evaluation = await evaluateAttempt(round, transcription);
        if (cancelled) return;
        const outcome: RoundOutcome = { round, transcription, evaluation };
        setLastResult(outcome);
        setResults((prev) => {
          const next = [...prev, outcome];
          if (next.length >= ROUNDS_PER_SESSION) {
            void finalizeSession(next);
          }
          return next;
        });
        setStage('feedback');
      } catch (err) {
        console.error('[Reformulation] evaluation failed', err);
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

  const totalScore = useMemo(
    () => results.reduce((sum, r) => sum + (r.evaluation.score || 0), 0),
    [results],
  );
  const earnedXp = useMemo(() => Math.round(totalScore), [totalScore]);

  if (stage === 'summary') {
    const averageScore = results.length > 0 ? totalScore / results.length : 0;
    return (
      <div className="space-y-6" data-testid="reformulation-summary">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <Wand2 size={32} className="text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground">Sessão concluída</h3>
          <p className="text-muted-foreground mt-1">
            Média: {averageScore.toFixed(1)} / 10 em {results.length} rodadas
          </p>
          <p className="text-xs text-muted-foreground mt-2">+{earnedXp} XP</p>
        </div>
        <Button onClick={handleRestart} className="w-full" size="lg">
          <RotateCcw size={18} />
          Nova sessão
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reformulation-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Wand2 size={14} />
          Rodada {roundIndex + 1} / {ROUNDS_PER_SESSION}
        </span>
        <span>{earnedXp} XP</span>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
                Reformule a frase
              </p>
              <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                {STYLE_LABELS_PT[round.target_style]}
              </span>
            </div>
            <p className="text-lg font-medium text-foreground">{round.source}</p>
            <p className="text-xs text-muted-foreground italic">
              {STYLE_INSTRUCTIONS_PT[round.target_style]}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={speakPrompt}
              disabled={tts.isLoading}
              className="w-full"
            >
              {tts.isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Ouvir a frase original
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
            <>Parar e avaliar</>
          ) : (
            <>Gravar reformulação</>
          )}
        </Button>
      )}

      {stage === 'feedback' && lastResult && (
        <div className="space-y-4" data-testid="reformulation-feedback">
          <div className="rounded-2xl bg-card border border-border p-5 space-y-2">
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
              Você disse
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {lastResult.transcription || '—'}
            </p>
          </div>

          {lastResult.evaluation.scores5d && (
            <ScorecardDisplay
              scores={lastResult.evaluation.scores5d}
              primaryDimension={lastResult.evaluation.primaryDimension}
              scalar={lastResult.evaluation.score}
              size="md"
            />
          )}

          {lastResult.round.reference_examples.length > 0 && (
            <div className="rounded-2xl bg-card border border-border p-5">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-3">
                Sugestões de reformulação
              </p>
              <ul className="space-y-2">
                {lastResult.round.reference_examples.map((example, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground leading-relaxed"
                  >
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lastResult.evaluation.overallFeedback && (
            <div className="rounded-2xl bg-card border border-border p-5">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2">
                Feedback
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {lastResult.evaluation.overallFeedback}
              </p>
            </div>
          )}

          <Button onClick={handleNext} className="w-full" size="lg">
            Próxima rodada
          </Button>
        </div>
      )}
    </div>
  );
}

export default Reformulation;
