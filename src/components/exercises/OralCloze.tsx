/**
 * F24 — Oral Cloze
 *
 * Short, signal-dense drill: the student hears a sentence with one content
 * word blanked out (replaced by a TTS beep / spoken "beep" token) and must
 * speak ONLY the missing word. STT is compared against `blank_token` with
 * tolerant normalisation.
 *
 * 10 rounds per session (see `ROUNDS_PER_SESSION`). At session end a compact
 * summary is shown and the student can start a new set.
 *
 * Wave 4 ignores `briefing` (plumbing only). Wave 5 will wire the Master.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brackets, Loader2, Play, RotateCcw, Check, X } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import { getOralClozePrompt, oralClozeResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { addXP } from '../../services/gamification';
import { recordErrorPatterns } from '../../services/errorAnalysis';
import { buildPatternFromCanonicalId } from '../../services/patterns';
import { recordDrillOutcome } from '../../services/master/runPipeline';
import type { Briefing } from '../../types/master';
import type { ErrorPattern } from '../../types/errors';

interface OralClozeProps {
  briefing?: Briefing;
}

interface ClozeRound {
  sentence: string;
  blank_token: string;
  canonical_pattern?: string;
  tts_sentence_with_beep: string;
}

interface RoundResult {
  round: ClozeRound;
  heardAnswer: string;
  correct: boolean;
}

const ROUNDS_PER_SESSION = 10;
const XP_PER_CORRECT = 3;

function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"*()]/g, '')
    .replace(/\s+/g, ' ');
}

function matches(answer: string, target: string): boolean {
  const a = normalizeWord(answer);
  const t = normalizeWord(target);
  if (!a) return false;
  if (a === t) return true;
  const tokens = a.split(' ').filter(Boolean);
  return tokens.includes(t);
}

async function generateRound(briefing?: Briefing, previousRounds?: ClozeRound[]): Promise<ClozeRound> {
  const systemPrompt = getOralClozePrompt(briefing);
  const prevBlock = previousRounds && previousRounds.length > 0
    ? `\n\nSENTENCES ALREADY USED (do NOT repeat or closely paraphrase these):\n${previousRounds.map((r, i) => `${i + 1}. "${r.sentence}" (blank: ${r.blank_token})`).join('\n')}\nGenerate something DIFFERENT from all of the above.`
    : '';
  const response = await chatCompletion(
    systemPrompt,
    `Generate one oral cloze round now.${prevBlock}`,
    undefined,
    oralClozeResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as ClozeRound;
  if (!parsed.sentence || !parsed.blank_token || !parsed.tts_sentence_with_beep) {
    throw new Error('Malformed cloze round (missing required fields).');
  }
  return parsed;
}

export function OralCloze({ briefing }: OralClozeProps) {
  const [round, setRound] = useState<ClozeRound | null>(null);
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
      const prevRounds = results.map((r) => r.round);
      const next = await generateRound(briefing, prevRounds);
      setRound(next);
    } catch (err) {
      console.error('[OralCloze] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar a rodada.');
    } finally {
      setGenerating(false);
    }
  }, [briefing, discardRecording, results]);

  useEffect(() => {
    if (!round && roundIndex === 0 && results.length === 0) {
      void loadNextRound();
    }
  }, [round, roundIndex, results.length, loadNextRound]);

  const speakPrompt = useCallback(() => {
    if (!round) return;
    const spoken = round.tts_sentence_with_beep.replace(/\*BEEP\*/gi, 'beep');
    void tts.speak(spoken);
  }, [round, tts]);

  const finalizeSession = useCallback(
    async (finalResults: RoundResult[]) => {
      if (sessionCompleteRef.current) return;
      sessionCompleteRef.current = true;

      const correctCount = finalResults.filter((r) => r.correct).length;
      const totalXp = correctCount * XP_PER_CORRECT;
      if (totalXp > 0) {
        try {
          await addXP(totalXp);
        } catch (err) {
          console.warn('[OralCloze] XP award failed', err);
        }
      }

      const now = new Date().toISOString();
      const patterns: ErrorPattern[] = finalResults
        .filter((r) => !r.correct && r.round.canonical_pattern)
        .map<ErrorPattern>((r) => {
          const base = buildPatternFromCanonicalId(r.round.canonical_pattern!);
          return {
            id: base.id,
            pattern: base.label,
            category: base.category,
            occurrences: 1,
            firstSeen: now,
            lastSeen: now,
            examples: [
              {
                cardId: `cloze-${now}`,
                date: now,
                userTranscription: r.heardAnswer,
                correctedVersion: r.round.blank_token,
                score: 0,
                prompt: r.round.sentence,
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
          console.warn('[OralCloze] error pattern recording failed', err);
        }
      }

      const dominantPattern = finalResults.find((r) => r.round.canonical_pattern)
        ?.round.canonical_pattern;
      void recordDrillOutcome(briefing, {
        canonicalPattern: dominantPattern,
        attempts: finalResults.length,
        correct: correctCount,
        modality: 'cloze',
      });
    },
    [briefing],
  );

  useEffect(() => {
    if (!audioBlob || !round) return;
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const correct = matches(transcription, round.blank_token);
        const result: RoundResult = { round, heardAnswer: transcription, correct };
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
        console.error('[OralCloze] STT failed', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao reconhecer o áudio.');
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

  const correctCount = useMemo(() => results.filter((r) => r.correct).length, [results]);

  if (stage === 'summary') {
    return (
      <div className="space-y-6" data-testid="oral-cloze-summary">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <Brackets size={32} className="text-primary mx-auto mb-3" />
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
    <div className="space-y-6" data-testid="oral-cloze-round">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Brackets size={14} />
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
              Ouça e fale a palavra faltando
            </p>
            <p className="text-lg font-medium text-foreground">
              {round.tts_sentence_with_beep.replace(/\*BEEP\*/gi, '____')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={speakPrompt}
              disabled={tts.isLoading}
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
            <>Gravar resposta</>
          )}
        </Button>
      )}

      {stage === 'feedback' && lastResult && (
        <div
          className={`rounded-2xl p-4 border ${
            lastResult.correct
              ? 'border-leaf/30 bg-leaf-soft'
              : 'border-destructive/30 bg-destructive/10'
          }`}
          data-testid="oral-cloze-feedback"
        >
          <div className="flex items-center gap-2 mb-2">
            {lastResult.correct ? (
              <Check size={18} className="text-leaf" />
            ) : (
              <X size={18} className="text-destructive" />
            )}
            <span
              className={`text-sm font-bold ${
                lastResult.correct ? 'text-leaf' : 'text-destructive'
              }`}
            >
              {lastResult.correct ? 'Certo!' : 'Faltou'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Esperado: <strong>{lastResult.round.blank_token}</strong>
          </p>
          <p className="text-xs text-muted-foreground">Você disse: "{lastResult.heardAnswer || '—'}"</p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            Frase completa: {lastResult.round.sentence}
          </p>
          <Button onClick={handleNext} className="w-full mt-4" size="sm">
            Próxima rodada
          </Button>
        </div>
      )}
    </div>
  );
}
