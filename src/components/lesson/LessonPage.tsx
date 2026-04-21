import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { MomentProgress } from './MomentProgress';
import { MomentShell } from './MomentShell';
import { getLesson, completeLesson, updateLessonSignals, abandonLesson } from '../../services/master/lessonService';
import { renderMoment } from '../../services/master/renderMoment';
import { getCurrentUser } from '../../services/supabase/auth';
import { loadLearnerModel } from '../../services/learnerModel';
import {
  updateLearnerModel,
  computeLessonDeltaScore,
} from '../../services/master/updateModel';
import { generateSessionReflection } from '../../services/master/generateSessionReflection';
import type { SessionRecap } from '../../services/master/summarizeSession';
import type { StoredSessionReflection } from '../../services/sessionReflections';
import { ReflectionCard } from '../master/ReflectionCard';
import type {
  LessonPlan,
  MomentContent,
  MomentSignal,
} from '../../types/learnerModel';

type StepState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'rendering'; moment: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'active'; moment: 1 | 2 | 3 | 4 | 5; content: MomentContent }
  | { kind: 'completing' }
  | { kind: 'done' };

export function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();

  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [signals, setSignals] = useState<MomentSignal[]>([]);
  const [step, setStep] = useState<StepState>({ kind: 'loading' });
  const [reflection, setReflection] = useState<StoredSessionReflection | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!lessonId) {
        setStep({ kind: 'error', message: 'Lição inválida.' });
        return;
      }
      const row = await getLesson(lessonId);
      if (cancelled) return;
      if (!row) {
        setStep({ kind: 'error', message: 'Não consegui carregar esta lição.' });
        return;
      }
      const plan = row.lesson_plan as unknown as LessonPlan;
      if (!plan || !Array.isArray(plan.moments) || plan.moments.length !== 5) {
        setStep({ kind: 'error', message: 'Esta lição está malformada.' });
        return;
      }
      setLessonPlan(plan);
      setStep({ kind: 'rendering', moment: 1 });
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const renderMomentContent = useCallback(
    async (moment: 1 | 2 | 3 | 4 | 5, previousSignal?: MomentSignal) => {
      if (!lessonPlan) return;
      setStep({ kind: 'rendering', moment });
      const content = await renderMoment({
        lessonPlan,
        momentIndex: moment,
        previousSignal,
      });
      if (!content) {
        setStep({
          kind: 'error',
          message: 'Não consegui preparar este momento agora. Tenta de novo em instantes.',
        });
        return;
      }
      setStep({ kind: 'active', moment, content });
    },
    [lessonPlan],
  );

  useEffect(() => {
    if (step.kind === 'rendering' && lessonPlan) {
      const previousSignal = signals[step.moment - 2];
      void renderMomentContent(step.moment, previousSignal);
    }
  }, [step, lessonPlan, signals, renderMomentContent]);

  const handleMomentDone = useCallback(
    async (signal: MomentSignal) => {
      if (step.kind !== 'active' || !lessonId || !lessonPlan) return;
      const nextSignals = [...signals, signal];
      setSignals(nextSignals);
      void updateLessonSignals(lessonId, nextSignals);

      if (step.moment < 5) {
        const nextMoment = (step.moment + 1) as 1 | 2 | 3 | 4 | 5;
        setStep({ kind: 'rendering', moment: nextMoment });
        return;
      }

      setStep({ kind: 'completing' });

      const baseline = nextSignals[0];
      const final = nextSignals[nextSignals.length - 1];
      const deltaScore = computeLessonDeltaScore(baseline, final);

      await completeLesson(lessonId, {
        baseline_utterance: null,
        final_utterance: null,
        delta_score: deltaScore,
      });

      const user = getCurrentUser();
      if (user) {
        try {
          const learnerModel = await loadLearnerModel(user.id);
          void updateLearnerModel({
            learnerModel,
            evaluationResult: {
              score: final.goal_met ? 8 : 5,
              userTranscription: '',
              correctedVersion: '',
              betterAlternatives: [],
              corrections: [],
              overallFeedback: 'Focused lesson completed.',
            },
            metaAssessment: null,
            sessionSummary: {
              userId: user.id,
              modality: 'focused_lesson',
              disguiseTheme: lessonPlan.engagement_context.theme,
              targetSkill: lessonPlan.target_canonical_pattern,
              endedAt: new Date().toISOString(),
            },
            lessonBoost: {
              target_canonical_pattern: lessonPlan.target_canonical_pattern,
              rounds: nextSignals.length,
              baseline_signal: baseline,
              final_signal: final,
              delta_score: deltaScore,
            },
          });
        } catch (err) {
          console.warn('[LessonPage] post-lesson update failed (swallowed):', err);
        }
      }

      setStep({ kind: 'done' });

      // Phase 3 — end-of-lesson reflection. Non-blocking.
      if (lessonPlan) {
        const goalMetCount = nextSignals.filter((s) => s.goal_met).length;
        const recap: SessionRecap = {
          surface: 'lesson',
          themes: [lessonPlan.engagement_context.theme].filter((t): t is string => Boolean(t)),
          patterns_correct:
            goalMetCount >= 3 ? [lessonPlan.target_canonical_pattern] : [],
          patterns_incorrect:
            goalMetCount < 3 ? [lessonPlan.target_canonical_pattern] : [],
          attempts: nextSignals.length,
          had_live: false,
        };
        void generateSessionReflection({
          recap,
          sessionKey: `lesson-${lessonId}`,
        }).then((result) => {
          if (result.reflection) setReflection(result.reflection);
        });
      }
    },
    [step, lessonId, lessonPlan, signals],
  );

  const handleAbandon = useCallback(async () => {
    if (!lessonId) return;
    await abandonLesson(lessonId);
    navigate('/practice');
  }, [lessonId, navigate]);

  if (step.kind === 'loading' || !lessonPlan) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (step.kind === 'error') {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Não foi possível carregar a lição</h1>
        <p className="text-muted-foreground">{step.message}</p>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
          onClick={() => navigate('/practice')}
        >
          Voltar para o hub
        </button>
      </div>
    );
  }

  if (step.kind === 'done') {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Lição concluída</h1>
        <p className="text-muted-foreground">Boa! Seu Mestre vai usar esse sinal pra ajustar os próximos exercícios.</p>
        {reflection && (
          <ReflectionCard reflection={reflection} onClose={() => setReflection(null)} />
        )}
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
          onClick={() => navigate('/practice')}
        >
          Voltar
        </button>
      </div>
    );
  }

  const momentIndex = step.kind === 'rendering' || step.kind === 'active' ? step.moment : 5;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-20">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Lição focada
        </div>
        <h1 className="text-2xl font-semibold">{lessonPlan.title_thematic}</h1>
        <MomentProgress currentIndex={momentIndex} />
      </header>

      {step.kind === 'rendering' && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="animate-spin" />
          <span>Preparando o próximo momento…</span>
        </div>
      )}

      {step.kind === 'completing' && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="animate-spin" />
          <span>Salvando sua lição…</span>
        </div>
      )}

      {step.kind === 'active' && (
        <MomentBody
          content={step.content}
          momentIndex={step.moment}
          onDone={handleMomentDone}
        />
      )}

      <footer className="pt-4 border-t">
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={handleAbandon}
        >
          Sair da lição
        </button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-moment body
// ---------------------------------------------------------------------------

interface MomentBodyProps {
  content: MomentContent;
  momentIndex: 1 | 2 | 3 | 4 | 5;
  onDone: (signal: MomentSignal) => void;
}

function MomentBody({ content, momentIndex, onDone }: MomentBodyProps) {
  switch (content.kind) {
    case 'hook':
      return (
        <MomentShell
          title="Momento 1 — Abertura"
          description="Responda em inglês, do jeito que sair."
          onDone={onDone}
        >
          <p className="text-base leading-relaxed">{content.portuguese_opener}</p>
        </MomentShell>
      );

    case 'noticing':
      return (
        <MomentShell
          title="Momento 2 — Percepção"
          description="Compare as duas frases e escolha a que soa mais natural na situação descrita."
          onDone={onDone}
        >
          <ul className="space-y-4">
            {content.pairs.map((p, i) => (
              <li key={i} className="rounded-xl border p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-mono text-xs mr-2">A</span>
                  {p.a}
                </p>
                <p className="text-sm">
                  <span className="font-mono text-xs mr-2">B</span>
                  {p.b}
                </p>
                <p className="text-xs text-muted-foreground italic">{p.portuguese_question}</p>
              </li>
            ))}
          </ul>
        </MomentShell>
      );

    case 'controlled_practice':
      return (
        <MomentShell
          title="Momento 3 — Drill"
          description="Algumas rodadas rápidas. Foque em dizer em voz alta."
          onDone={onDone}
        >
          <ol className="space-y-3 list-decimal list-inside">
            {content.rounds.map((r, i) => (
              <li key={i} className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  {r.modality.replace('_', ' ')}
                </div>
                <pre className="text-sm whitespace-pre-wrap font-sans">
                  {typeof r.payload === 'object' && r.payload !== null
                    ? JSON.stringify(r.payload, null, 2)
                    : String(r.payload)}
                </pre>
              </li>
            ))}
          </ol>
        </MomentShell>
      );

    case 'free_production':
      return (
        <MomentShell
          title="Momento 4 — Produção livre"
          description={
            content.modality === 'narrative'
              ? 'Conta uma história curta em inglês a partir do seed abaixo.'
              : 'Faça um roleplay curto em inglês a partir da situação abaixo.'
          }
          onDone={onDone}
        >
          <p className="rounded-xl border p-3 text-base leading-relaxed">{content.seed}</p>
        </MomentShell>
      );

    case 'consolidation':
      return (
        <MomentShell
          title="Momento 5 — Consolidação"
          description="Última parada. Aqui o Mestre conta o que você praticou."
          onDone={onDone}
          autoAdvanceSignal={{
            goal_met: true,
            difficulty_actual: 'ok',
            observed_issues: [],
            notable_successes: [],
            engagement_observed: 'medium',
          }}
        >
          <div className="rounded-xl border p-3 space-y-3">
            <p className="text-base">{content.callback_prompt_pt}</p>
            {momentIndex === 5 && (
              <p className="text-sm text-primary/90 italic">{content.reveal_copy_pt}</p>
            )}
          </div>
        </MomentShell>
      );
  }
}
