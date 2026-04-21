/**
 * F25 — Directed Listening
 *
 * Focused comprehension drill. The student hears a short spoken passage once
 * (with an optional single replay), then answers 2-3 comprehension questions
 * out loud, one at a time. Answers are transcribed but NOT judged inline —
 * the full set is evaluated in a single LLM judge call at the end, using a
 * constrained schema that extends the standard 5D scorecard with a
 * `per_question` coverage array.
 *
 * Session shape: 1 passage = 1 session. No multi-round loop (unlike OralCloze).
 *
 * Wave 4 ignores `briefing` end-to-end for routing; the `accent_hint` from the
 * generator is logged (TTS voice routing is deferred to a later wave).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Loader2, Play, RotateCcw, Check, X } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useTTS } from '../../hooks/useTTS';
import { chatCompletion, speechToText } from '../../services/openai';
import { getListeningPassagePrompt, listeningPassageResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { Button } from '../ui/Button';
import { SkeletonText } from '../ui/Skeleton';
import { ScorecardDisplay } from '../shared/ScorecardDisplay';
import { addXP } from '../../services/gamification';
import { recordErrorPatterns } from '../../services/errorAnalysis';
import { buildPatternFromCanonicalId } from '../../services/patterns';
import { runMasterPipeline } from '../../services/master/runPipeline';
import {
  normalizeCorrectionItem,
  normalizeEvaluationResult,
  type EvaluationResult,
  type CorrectionItem,
} from '../../types/card';
import type { Briefing } from '../../types/master';
import type { ErrorPattern } from '../../types/errors';

interface DirectedListeningProps {
  briefing?: Briefing;
}

interface ListeningSession {
  passage: string;
  questions: string[];
  expected_key_points: string[];
  accent_hint?: 'us' | 'uk' | 'au' | 'neutral';
}

interface QAEntry {
  question: string;
  studentAnswer: string;
  covered: boolean;
  missing_key_points: string[];
}

interface ListeningEvaluation extends EvaluationResult {
  per_question?: QAEntry[];
}

type Stage = 'passage' | 'qa' | 'judging' | 'summary';

const judgeSystem = `You are evaluating a student's answers to comprehension questions about a spoken passage. Judge by MEANING, not wording. For each question, decide whether the student's answer captures the relevant \`expected_key_points\` for that question.

Produce a JSON object with:
- overall 5D scorecard (same format as standard EvaluationResult: scores5d with naturalness/accuracy/fluency/pragmatics/completeness, plus the scalar score and corrections array). Comprehension weighs heavily on "completeness" and "accuracy".
- per_question array: { question, studentAnswer, covered: boolean, missing_key_points: string[] }.`;

const judgeSchema = {
  type: 'object' as const,
  properties: {
    score: { type: 'number' as const },
    scores5d: {
      type: 'object' as const,
      properties: {
        naturalness: { type: 'number' as const },
        accuracy: { type: 'number' as const },
        fluency: { type: 'number' as const },
        pragmatics: { type: 'number' as const },
        completeness: { type: 'number' as const },
      },
      required: ['naturalness', 'accuracy', 'fluency', 'pragmatics', 'completeness'],
    },
    primaryDimension: { type: 'string' as const },
    corrections: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          tip: { type: 'string' as const },
          example: { type: 'string' as const },
          canonical_pattern: { type: 'string' as const },
          severity: { type: 'string' as const },
        },
        required: ['tip'],
      },
    },
    correctedVersion: { type: 'string' as const },
    per_question: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          question: { type: 'string' as const },
          studentAnswer: { type: 'string' as const },
          covered: { type: 'boolean' as const },
          missing_key_points: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['question', 'studentAnswer', 'covered', 'missing_key_points'],
      },
    },
  },
  required: ['score', 'scores5d', 'corrections', 'correctedVersion', 'per_question'],
};

async function generateSession(briefing?: Briefing): Promise<ListeningSession> {
  const systemPrompt = getListeningPassagePrompt(briefing);
  const response = await chatCompletion(
    systemPrompt,
    'Generate one directed listening passage now.',
    undefined,
    listeningPassageResponseSchema,
  );
  const parsed = JSON.parse(cleanJson(response)) as ListeningSession;
  if (
    !parsed.passage ||
    !Array.isArray(parsed.questions) ||
    parsed.questions.length === 0 ||
    !Array.isArray(parsed.expected_key_points)
  ) {
    throw new Error('Malformed listening session (missing required fields).');
  }
  return parsed;
}

function buildJudgeUserMessage(session: ListeningSession, answers: string[]): string {
  const lines: string[] = [];
  lines.push('PASSAGE:');
  lines.push(session.passage);
  lines.push('');
  lines.push('EXPECTED KEY POINTS (shared across questions):');
  session.expected_key_points.forEach((kp, i) => {
    lines.push(`  ${i + 1}. ${kp}`);
  });
  lines.push('');
  lines.push('QUESTIONS AND STUDENT ANSWERS:');
  session.questions.forEach((q, i) => {
    lines.push(`Q${i + 1}: ${q}`);
    lines.push(`A${i + 1}: ${answers[i] ?? ''}`);
  });
  lines.push('');
  lines.push(
    'Return strict JSON matching the provided schema. Judge by meaning. For each question, set `covered` to true only if the student\'s answer captures the relevant key points; list any missing key points per question.',
  );
  return lines.join('\n');
}

export function DirectedListening({ briefing }: DirectedListeningProps) {
  const [session, setSession] = useState<ListeningSession | null>(null);
  const [stage, setStage] = useState<Stage>('passage');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<ListeningEvaluation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [hasReplayed, setHasReplayed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tts = useTTS();
  const recorder = useAudioRecorder();
  const { startRecording, stopRecording, discardRecording, audioBlob, isRecording } = recorder;
  const sessionCompleteRef = useRef(false);

  const loadSession = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setEvaluation(null);
    setAnswers([]);
    setQuestionIndex(0);
    setHasPlayedOnce(false);
    setHasReplayed(false);
    setStage('passage');
    discardRecording();
    try {
      const next = await generateSession(briefing);
      setSession(next);
      if (next.accent_hint) {
        console.debug('[DirectedListening] accent hint:', next.accent_hint);
      }
    } catch (err) {
      console.error('[DirectedListening] generation failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao gerar a passagem.');
    } finally {
      setGenerating(false);
    }
  }, [briefing, discardRecording]);

  useEffect(() => {
    if (!session && !generating && !error) {
      void loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playPassage = useCallback(async () => {
    if (!session) return;
    try {
      await tts.speak(session.passage);
      setHasPlayedOnce(true);
    } catch (err) {
      console.error('[DirectedListening] TTS failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao reproduzir o áudio.');
    }
  }, [session, tts]);

  const replayPassage = useCallback(async () => {
    if (!session || hasReplayed) return;
    try {
      await tts.speak(session.passage);
      setHasReplayed(true);
    } catch (err) {
      console.error('[DirectedListening] TTS replay failed', err);
      setError(err instanceof Error ? err.message : 'Falha ao reproduzir o áudio.');
    }
  }, [session, tts, hasReplayed]);

  const startQA = useCallback(() => {
    if (!session) return;
    setStage('qa');
    setQuestionIndex(0);
    setAnswers([]);
  }, [session]);

  const finalizeSession = useCallback(
    async (evaluated: ListeningEvaluation) => {
      if (sessionCompleteRef.current) return;
      sessionCompleteRef.current = true;

      try {
        await addXP(Math.round(evaluated.score ?? 0));
      } catch (err) {
        console.warn('[DirectedListening] XP award failed', err);
      }

      const now = new Date().toISOString();
      const patterns: ErrorPattern[] = (evaluated.corrections ?? [])
        .map((c) => normalizeCorrectionItem(c))
        .filter((c): c is CorrectionItem & { canonical_pattern: string } =>
          Boolean(c.canonical_pattern),
        )
        .map<ErrorPattern>((c) => {
          const base = buildPatternFromCanonicalId(c.canonical_pattern);
          return {
            id: base.id,
            pattern: base.label,
            category: base.category,
            occurrences: 1,
            firstSeen: now,
            lastSeen: now,
            examples: [
              {
                cardId: `directed-listening-${now}`,
                date: now,
                userTranscription: evaluated.userTranscription || '',
                correctedVersion: evaluated.correctedVersion || '',
                score: evaluated.score ?? 0,
                prompt: c.example || '',
              },
            ],
            trend: 'stable',
            recentScores: [evaluated.score ?? 0],
          };
        });

      if (patterns.length > 0) {
        try {
          await recordErrorPatterns(patterns);
        } catch (err) {
          console.warn('[DirectedListening] error pattern recording failed', err);
        }
      }

      void runMasterPipeline({
        evaluationResult: evaluated,
        briefing,
        fallbackModality: 'listening',
      });
    },
    [briefing],
  );

  const runJudge = useCallback(
    async (finalAnswers: string[]) => {
      if (!session) return;
      setStage('judging');
      setError(null);
      try {
        const userMsg = buildJudgeUserMessage(session, finalAnswers);
        const response = await chatCompletion(judgeSystem, userMsg, undefined, judgeSchema);
        const parsed = JSON.parse(cleanJson(response)) as ListeningEvaluation;

        const merged: ListeningEvaluation = normalizeEvaluationResult({
          score: parsed.score ?? 0,
          scores5d: parsed.scores5d,
          primaryDimension: parsed.primaryDimension,
          corrections: parsed.corrections ?? [],
          correctedVersion: parsed.correctedVersion ?? '',
          betterAlternatives: [],
          overallFeedback: '',
          userTranscription: finalAnswers.join(' | '),
        }) as ListeningEvaluation;
        merged.per_question = Array.isArray(parsed.per_question)
          ? parsed.per_question
          : session.questions.map((q, i) => ({
              question: q,
              studentAnswer: finalAnswers[i] ?? '',
              covered: false,
              missing_key_points: [],
            }));

        setEvaluation(merged);
        setStage('summary');
        await finalizeSession(merged);
      } catch (err) {
        console.error('[DirectedListening] judge failed', err);
        setError(err instanceof Error ? err.message : 'Falha ao avaliar as respostas.');
        setStage('qa');
      }
    },
    [session, finalizeSession],
  );

  useEffect(() => {
    if (!audioBlob || stage !== 'qa' || !session) return;
    let cancelled = false;
    const transcribe = async () => {
      setTranscribing(true);
      setError(null);
      try {
        const transcription = await speechToText(audioBlob);
        if (cancelled) return;
        const nextAnswers = [...answers, transcription];
        setAnswers(nextAnswers);
        discardRecording();

        if (nextAnswers.length >= session.questions.length) {
          await runJudge(nextAnswers);
        } else {
          setQuestionIndex((i) => i + 1);
        }
      } catch (err) {
        console.error('[DirectedListening] STT failed', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao reconhecer o áudio.');
        }
      } finally {
        if (!cancelled) setTranscribing(false);
      }
    };
    void transcribe();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleRestart = useCallback(async () => {
    sessionCompleteRef.current = false;
    setSession(null);
    setEvaluation(null);
    setAnswers([]);
    setQuestionIndex(0);
    setHasPlayedOnce(false);
    setHasReplayed(false);
    setError(null);
    await loadSession();
  }, [loadSession]);

  const currentQuestion = useMemo(() => {
    if (!session) return null;
    return session.questions[questionIndex] ?? null;
  }, [session, questionIndex]);

  if (stage === 'summary' && evaluation) {
    const perQuestion = evaluation.per_question ?? [];
    return (
      <div className="space-y-6" data-testid="directed-listening-summary">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Headphones size={14} />
          Directed Listening — resultado
        </div>

        {evaluation.scores5d && (
          <ScorecardDisplay
            scores={evaluation.scores5d}
            primaryDimension={evaluation.primaryDimension}
            scalar={evaluation.score}
            size="lg"
          />
        )}

        <div className="space-y-3">
          {perQuestion.map((entry, idx) => (
            <div
              key={`${idx}-${entry.question}`}
              className={`rounded-2xl border p-4 ${
                entry.covered
                  ? 'border-leaf/30 bg-leaf-soft'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
            >
              <div className="flex items-start gap-2">
                {entry.covered ? (
                  <Check size={16} className="text-leaf mt-0.5" />
                ) : (
                  <X size={16} className="text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{entry.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você: "{entry.studentAnswer || '—'}"
                  </p>
                  {!entry.covered && entry.missing_key_points.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {entry.missing_key_points.map((kp, i) => (
                        <li
                          key={i}
                          className="text-xs text-destructive flex items-start gap-1.5"
                        >
                          <span className="font-bold">•</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleRestart} className="w-full" size="lg">
          <RotateCcw size={18} />
          Nova passagem
        </Button>
      </div>
    );
  }

  if (stage === 'qa') {
    return (
      <div className="space-y-6" data-testid="directed-listening-qa">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Headphones size={14} />
            Pergunta {questionIndex + 1} / {session?.questions.length ?? 0}
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
            Responda em voz alta
          </p>
          <p className="text-lg font-medium text-foreground">{currentQuestion ?? '—'}</p>
        </div>

        <Button
          onClick={toggleRecording}
          disabled={transcribing}
          variant={isRecording ? 'coral' : 'primary'}
          size="lg"
          className="w-full"
        >
          {transcribing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isRecording ? (
            <>Parar resposta</>
          ) : (
            <>Gravar resposta</>
          )}
        </Button>
      </div>
    );
  }

  if (stage === 'judging') {
    return (
      <div className="space-y-6" data-testid="directed-listening-qa">
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <Loader2 size={24} className="animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Avaliando suas respostas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="directed-listening-passage">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Headphones size={14} />
        Directed Listening
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        {generating || !session ? (
          <SkeletonText lines={3} />
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest">
              Ouça a passagem (uma vez, com um replay opcional)
            </p>
            <p className="text-sm text-muted-foreground">
              {session.questions.length} perguntas virão em seguida.
            </p>
            <Button
              onClick={playPassage}
              disabled={tts.isLoading || hasPlayedOnce}
              className="w-full"
              size="lg"
            >
              {tts.isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Play size={18} />
              )}
              {hasPlayedOnce ? 'Já reproduzida' : 'Reproduzir passagem'}
            </Button>
            {hasPlayedOnce && (
              <Button
                variant="outline"
                size="sm"
                onClick={replayPassage}
                disabled={tts.isLoading || hasReplayed}
                className="w-full"
              >
                {tts.isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                {hasReplayed ? 'Replay usado' : 'Ouvir novamente (1x)'}
              </Button>
            )}
            {hasPlayedOnce && (
              <Button onClick={startQA} className="w-full" size="lg" variant="primary">
                Começar perguntas
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
