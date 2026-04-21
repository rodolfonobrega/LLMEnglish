import { useState, useEffect, useCallback, useRef } from 'react';
import { getCardsDueForReview, updateCard, getConversationTone } from '../../services/storage';
import { updateCardSchedule } from '../../services/spacedRepetition';
import { getPrioritizedReviewCards } from '../../services/errorAnalysis';
import { extractErrorPatterns, recordErrorPatterns, recordSessionSnapshot } from '../../services/errorAnalysis';
import { runMasterPipeline } from '../../services/master/runPipeline';
import { varyCard, appendLineage, type VaryCardResult } from '../../services/master/varyCard';
import { buildPatternReviewSession, groupCardsByPattern } from '../../services/master/patternReview';
import { recordNudgeEvent } from '../../services/master/nudgeEngine';
import { loadLearnerModel } from '../../services/learnerModel';
import { generateSessionReflection } from '../../services/master/generateSessionReflection';
import type { SessionRecap } from '../../services/master/summarizeSession';
import type { StoredSessionReflection } from '../../services/sessionReflections';
import { ReflectionCard } from '../master/ReflectionCard';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { FeedbackDrill } from '../shared/FeedbackDrill';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { chatCompletion, speechToText } from '../../services/openai';
import { getEvaluationPrompt, evaluationResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { explainCorrection } from '../../services/tutorExplain';
import { addXP } from '../../services/gamification';
import { XP_PER_REVIEW } from '../../types/gamification';
import type { Card, EvaluationResult } from '../../types/card';
import { normalizeEvaluationResult } from '../../types/card';
import type { ConversationTone } from '../../types/settings';
import { Loader2, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2, Compass, Trophy, Brain, Lightbulb, BookOpen, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

type ReviewMode = 'standard' | 'intelligent' | 'pattern';

export function ReviewPage() {
  const navigate = useNavigate();
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('standard');
  const [showTutor, setShowTutor] = useState(false);
  const [tutorExplanation, setTutorExplanation] = useState<string | null>(null);
  const [isGeneratingTutor, setIsGeneratingTutor] = useState(false);
  const [showDrill, setShowDrill] = useState(false);
  const [tone, setTone] = useState<ConversationTone>('balanced');
  const [variant, setVariant] = useState<VaryCardResult | null>(null);
  const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);
  const variantRequestRef = useRef<string | null>(null);
  // Phase 3 — accumulate recap signal as the session progresses so we
  // can ask the Master for a reflection when the student finishes.
  const sessionRecapRef = useRef<{
    themes: Set<string>;
    patternsCorrect: Set<string>;
    patternsIncorrect: Set<string>;
    sessionStartKey: string;
  }>({
    themes: new Set(),
    patternsCorrect: new Set(),
    patternsIncorrect: new Set(),
    sessionStartKey: new Date().toISOString(),
  });
  const [reflection, setReflection] = useState<StoredSessionReflection | null>(null);

  useEffect(() => {
    setTone(getConversationTone());
  }, []);

  const loadDueCards = useCallback(async (mode: ReviewMode = reviewMode) => {
    setIsLoadingCards(true)
    let cards: Card[];
    if (mode === 'intelligent') {
      cards = await getPrioritizedReviewCards(20);
    } else if (mode === 'pattern') {
      // Phase 9 (F-P9-05) — collapse the queue into a pattern-review
      // session around the largest eligible group. If no group has
      // enough cards, silently fall back to the standard queue.
      const all = await getCardsDueForReview();
      const groups = groupCardsByPattern(all);
      if (groups.length > 0 && groups[0]) {
        cards = buildPatternReviewSession(groups[0], Math.min(5, groups[0].cards.length));
      } else {
        cards = all;
      }
    } else {
      cards = await getCardsDueForReview();
    }

    setDueCards(cards);
    setCurrentIndex(0);
    setEvaluation(null);
    setShowResults(false);
    setSessionComplete(false);
    setSessionScores([]);
    setReviewMode(mode);
    setIsLoadingCards(false)
  }, [reviewMode]);

  useEffect(() => {
    void loadDueCards()
  }, [loadDueCards]);

  const currentCard = dueCards[currentIndex];

  // Phase 9 (F-P9-03) — generate a fresh variant whenever the active
  // card changes. On soft-fails (no canonical_pattern, Master off,
  // pinned) `varyCard` returns the original prompt, so we never block
  // Review on this. We also track the request id to avoid a late
  // response from a previous card overwriting the current one.
  useEffect(() => {
    if (!currentCard) {
      setVariant(null);
      return;
    }
    const requestId = `${currentCard.id}@${currentIndex}`;
    variantRequestRef.current = requestId;
    setIsGeneratingVariant(true);
    (async () => {
      try {
        const learnerModel = await loadLearnerModel();
        const result = await varyCard({ card: currentCard, learnerModel });
        if (variantRequestRef.current === requestId) {
          setVariant(result);
        }
      } catch (err) {
        console.warn('[ReviewPage] varyCard failed, falling back to original:', err);
        if (variantRequestRef.current === requestId) {
          setVariant({
            prompt: currentCard.prompt,
            context: currentCard.context,
            theme: currentCard.theme ?? 'general',
            verbs: [],
            source: 'fallback',
            lineageEntry: {
              prompt: currentCard.prompt,
              context: currentCard.context,
              theme: currentCard.theme ?? 'general',
              shown_at: new Date().toISOString(),
              reason: 'varyCard threw — fallback to original.',
            },
          });
        }
      } finally {
        if (variantRequestRef.current === requestId) {
          setIsGeneratingVariant(false);
        }
      }
    })();
  }, [currentCard, currentIndex]);

  const displayPrompt = variant?.prompt ?? currentCard?.prompt ?? '';
  const displayContext = variant?.context ?? currentCard?.context;

  const handleAudioReady = async (blob: Blob) => {
    if (!currentCard) return;
    setIsEvaluating(true);
    setError(null);
    setShowTutor(false);
    setTutorExplanation(null);
    try {
      const transcription = await speechToText(blob);
      // Phase 9 — evaluate AGAINST the variant the student actually saw,
      // never the original prompt. Falls back to the card prompt if the
      // variant pipeline is still running (edge case on very slow LLMs).
      const promptShown = variant?.prompt ?? currentCard.prompt;
      const evalPrompt = getEvaluationPrompt(promptShown, transcription, `${currentCard.type} review`, tone);
      const evalResponse = await chatCompletion('You are an expert English language evaluator. Respond only with valid JSON.', evalPrompt, undefined, evaluationResponseSchema);
      let parsed: EvaluationResult;
      try {
        parsed = JSON.parse(cleanJson(evalResponse));
      } catch {
        throw new Error('AI returned invalid JSON for evaluation. Please try again.');
      }
      if (typeof parsed.score !== 'number' || !Array.isArray(parsed.corrections)) {
        throw new Error('AI returned an incomplete evaluation. Please try again.');
      }
      parsed.userTranscription = transcription;
      const evalResult = normalizeEvaluationResult(parsed);
      setEvaluation(evalResult);
      setShowResults(true);
      setShowDrill(false);

      let updatedCard = updateCardSchedule(currentCard, evalResult.score);
      updatedCard.reviews.push({
        date: new Date().toISOString(),
        score: evalResult.score,
        userTranscription: transcription,
      });
      updatedCard.latestEvaluation = evalResult;
      // Phase 9 (F-P9-03) — persist the variant history on the card so
      // the next visit sees this turn in `variation_lineage`. Also
      // backfills `original_prompt` for pre-Phase-9 cards.
      if (variant) {
        updatedCard = appendLineage(updatedCard, {
          ...variant.lineageEntry,
          evaluation_id: `${updatedCard.id}_${updatedCard.reviews.length}`,
        });
      }
      await updateCard(updatedCard)

      const patterns = await extractErrorPatterns(evalResult, promptShown, currentCard.id);
      await recordErrorPatterns(patterns)

      setSessionScores(prev => [...prev, evalResult.score]);

      // Phase 3 — feed the running recap used by the end-of-session
      // reflection. We prefer the canonical_pattern + theme the student
      // actually saw (variant beats the card's birth theme).
      {
        const theme = variant?.theme ?? currentCard.theme;
        if (theme) sessionRecapRef.current.themes.add(theme);
        const cp = currentCard.canonical_pattern;
        if (cp) {
          if (evalResult.score >= 7) {
            sessionRecapRef.current.patternsCorrect.add(cp);
          } else {
            sessionRecapRef.current.patternsIncorrect.add(cp);
          }
        }
      }

      // Phase 4 (F-P4-03) — emit a nudge engine event whenever a card
      // with a canonical_pattern is scored. Low scores on patterns that
      // the LearnerModel already flagged as chronic feed the "3 in a
      // row" rule; everything else resets the streak.
      {
        const cp = currentCard.canonical_pattern;
        if (cp) {
          try {
            const lm = await loadLearnerModel();
            const isChronic = lm.chronic_errors.some((e) => e.id === cp);
            if (isChronic && evalResult.score < 7) {
              recordNudgeEvent({ type: 'review_miss_chronic', pattern_id: cp });
            } else {
              recordNudgeEvent({ type: 'review_hit_other', pattern_id: cp });
            }
          } catch (err) {
            console.warn('[ReviewPage] nudge event record failed', err);
          }
        }
      }

      await addXP(XP_PER_REVIEW)

      void runMasterPipeline({
        evaluationResult: evalResult,
        briefing: null,
        fallbackModality: currentCard.type === 'image'
          ? 'visual'
          : currentCard.type === 'text'
            ? 'text'
            : currentCard.type === 'roleplay'
              ? 'roleplay'
              : 'phrase',
        // Phase 9 — carry the variant's theme forward so evidence
        // accumulation in `runMasterPipeline` records the theme the
        // student actually practiced, not the card's birth theme.
        fallbackTheme: variant?.theme ?? currentCard.theme,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na avaliação');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleShowTutor = async () => {
    if (!evaluation || !currentCard) return;
    setIsGeneratingTutor(true);
    try {
      const explanation = await explainCorrection({
        prompt: variant?.prompt ?? currentCard.prompt,
        userTranscription: evaluation.userTranscription,
        correctedVersion: evaluation.correctedVersion,
        corrections: evaluation.corrections,
        tone,
      });
      setTutorExplanation(explanation);
      setShowTutor(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar explicação');
    } finally {
      setIsGeneratingTutor(false);
    }
  };

  const handleNext = async () => {
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setEvaluation(null);
      setShowResults(false);
      setShowDrill(false);
      setTutorExplanation(null);
      setShowTutor(false);
      setError(null);
    } else {
      setSessionComplete(true);
      await recordSessionSnapshot()

      // Phase 3 — fire an end-of-session reflection. Non-blocking: the
      // summary screen renders immediately; the card fades in when the
      // Master responds.
      const ref = sessionRecapRef.current;
      const recap: SessionRecap = {
        surface: 'review',
        themes: Array.from(ref.themes),
        patterns_correct: Array.from(ref.patternsCorrect) as SessionRecap['patterns_correct'],
        patterns_incorrect: Array.from(ref.patternsIncorrect) as SessionRecap['patterns_incorrect'],
        attempts: sessionScores.length + 1,
        avg_score:
          sessionScores.length > 0
            ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
            : undefined,
        had_live: false,
      };
      const sessionKey = `review-${ref.sessionStartKey}`;
      void generateSessionReflection({ recap, sessionKey }).then((result) => {
        if (result.reflection) setReflection(result.reflection);
      });
    }
  };

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 size={18} className="animate-spin mr-2" />
        Carregando cards para revisao...
      </div>
    )
  }

  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
        <div className="size-24 bg-leaf-soft rounded-full flex items-center justify-center">
          <CheckCircle2 size={48} className="text-leaf" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-foreground text-balance">Tudo em dia!</h2>
          <p className="text-muted-foreground max-w-sm text-pretty">
            Nenhum card pendente. Continue praticando nos Exercícios ou volte mais tarde.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/">
            <Button variant="primary" className="cursor-pointer">
              <Compass size={16} />
              Ir para Exercícios
            </Button>
          </a>
          <Button variant="secondary" onClick={() => { void loadDueCards(reviewMode) }} className="cursor-pointer">
            <RotateCcw size={16} />
            Atualizar
          </Button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const avgScore = sessionScores.length > 0
      ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
      : 0;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-8">
        <div className="size-20 bg-[var(--amber-soft)] rounded-full flex items-center justify-center">
          <Trophy size={40} className="text-[var(--amber)]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-foreground text-balance">Sessão Concluída!</h2>
          <p className="text-muted-foreground">Bom trabalho na sua revisão.</p>
        </div>
        <ScoreDisplay score={Math.round(avgScore * 10) / 10} size="lg" />
        <div className="bg-card rounded-2xl p-5 border border-border w-full max-w-xs">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-extrabold text-foreground tabular-nums">{sessionScores.length}</p>
              <p className="text-xs text-muted-foreground">Revisados</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-leaf tabular-nums">{sessionScores.filter(s => s >= 7).length}</p>
              <p className="text-xs text-muted-foreground">Corretos (7+)</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="coral" size="lg" onClick={() => { void loadDueCards(reviewMode) }} className="rounded-2xl px-8 cursor-pointer">
            <RotateCcw size={18} />
            Revisar Mais
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/errors')} className="rounded-2xl px-8 cursor-pointer">
            <AlertTriangle size={18} />
            Ver Pontos Fracos
          </Button>
        </div>

        {reflection && (
          <div className="w-full max-w-xl">
            <ReflectionCard reflection={reflection} onClose={() => setReflection(null)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft size={18} />
        Voltar
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground text-balance">Revisão</h2>
          <p className="text-muted-foreground tabular-nums text-sm">Card {currentIndex + 1} de {dueCards.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground tabular-nums">
            {dueCards.length - currentIndex} restantes
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            void loadDueCards('standard');
          }}
          className={cn(
            'flex-1 py-3 px-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer',
            reviewMode === 'standard'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <CheckCircle2 size={16} className="inline mr-1" />
          Padrão
        </button>
        <button
          onClick={() => {
            void loadDueCards('intelligent');
          }}
          className={cn(
            'flex-1 py-3 px-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer',
            reviewMode === 'intelligent'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Brain size={16} className="inline mr-1" />
          Inteligente
        </button>
        <button
          onClick={() => {
            void loadDueCards('pattern');
          }}
          className={cn(
            'flex-1 py-3 px-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer',
            reviewMode === 'pattern'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
          data-testid="review-mode-pattern"
        >
          <Compass size={16} className="inline mr-1" />
          Por padrão
        </button>
      </div>

      {reviewMode === 'intelligent' && (
        <div className="bg-primary-soft rounded-xl p-3 text-sm flex items-start gap-2">
          <Lightbulb size={16} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-primary font-medium">
            A Revisão Inteligente prioriza cards com base nos seus pontos fracos e desempenho anterior.
          </p>
        </div>
      )}

      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + (showResults ? 1 : 0)) / dueCards.length) * 100}%` }}
        />
      </div>

      {currentCard && (
        <div className="bg-card rounded-2xl p-6 border border-border space-y-6">
          <div className="bg-muted rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="capitalize">{currentCard.type}</Badge>
            </div>
            {isGeneratingVariant ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Preparando card...</span>
              </div>
            ) : (
              <p className="text-lg text-foreground leading-relaxed text-pretty">{displayPrompt}</p>
            )}
            {displayContext && !isGeneratingVariant && (
              <p className="mt-2 text-sm text-muted-foreground italic">{displayContext}</p>
            )}
            {currentCard.imageUrl && (
              <img src={currentCard.imageUrl} alt="Card" className="mt-4 w-full max-h-48 object-cover rounded-xl" />
            )}
          </div>

          {!showResults && (
            <>
              <AudioRecorder onAudioReady={handleAudioReady} disabled={isEvaluating} />
              {isEvaluating && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="font-medium">Avaliando...</span>
                </div>
              )}
            </>
          )}

          {showResults && evaluation && (
            <div className="space-y-4">
              <EvaluationResults
                result={evaluation}
                showSaveButton={false}
                drillSlot={
                  showDrill && evaluation.correctedVersion ? (
                    <FeedbackDrill
                      target={evaluation.correctedVersion}
                      original={evaluation.userTranscription}
                    />
                  ) : undefined
                }
              />

              {!showDrill && evaluation.score < 9 && evaluation.correctedVersion && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowDrill(true)}
                  className="w-full rounded-2xl cursor-pointer"
                >
                  <RotateCcw size={18} />
                  Praticar a correção
                </Button>
              )}

              {evaluation.score < 8 && (
                <div className="bg-gradient-to-r from-[var(--amber-soft)] to-[var(--leaf-soft)] rounded-2xl p-4">
                  <button
                    onClick={handleShowTutor}
                    disabled={isGeneratingTutor}
                    className="w-full flex items-center justify-center gap-2 text-foreground font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Lightbulb size={20} className="text-[var(--amber)]" />
                    {isGeneratingTutor ? 'Gerando explicação...' : showTutor ? 'Gerar novamente' : 'Pedir explicação do tutor'}
                  </button>
                  {showTutor && tutorExplanation && (
                    <div className="mt-3 p-3 bg-card rounded-xl text-sm text-foreground leading-relaxed border border-border">
                      <div className="flex items-center gap-1.5 font-semibold mb-2 text-[var(--amber)]">
                        <BookOpen size={14} />
                        <span>Explicação do Tutor:</span>
                      </div>
                      <p className="text-muted-foreground">{tutorExplanation}</p>
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="coral"
                size="lg"
                onClick={() => { void handleNext() }}
                className="w-full rounded-2xl text-lg font-bold"
              >
                <ChevronRight size={20} />
                {currentIndex < dueCards.length - 1 ? 'Próximo Card' : 'Encerrar Sessão'}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">{error}</div>
      )}
    </div>
  );
}
