import { useState, useEffect, useCallback } from 'react';
import { getCardsDueForReview, updateCard, getConversationTone } from '../../services/storage';
import { updateCardSchedule } from '../../services/spacedRepetition';
import { getPrioritizedReviewCards } from '../../services/errorAnalysis';
import { extractErrorPatterns, recordErrorPatterns, recordSessionSnapshot } from '../../services/errorAnalysis';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { chatCompletion, speechToText } from '../../services/openai';
import { getEvaluationPrompt, getTutorExplanationPrompt } from '../../utils/prompts';
import { addXP } from '../../services/gamification';
import { XP_PER_REVIEW } from '../../types/gamification';
import type { Card, EvaluationResult } from '../../types/card';
import type { ConversationTone } from '../../types/settings';
import { Loader2, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2, Compass, Trophy, Brain, Lightbulb, BookOpen, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

type ReviewMode = 'standard' | 'intelligent';

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
  const [tone, setTone] = useState<ConversationTone>('balanced');

  useEffect(() => {
    setTone(getConversationTone());
  }, []);

  const loadDueCards = useCallback(async (mode: ReviewMode = reviewMode) => {
    setIsLoadingCards(true)
    const cards = mode === 'intelligent'
      ? await getPrioritizedReviewCards(20)
      : await getCardsDueForReview()

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

  const handleAudioReady = async (blob: Blob) => {
    if (!currentCard) return;
    setIsEvaluating(true);
    setError(null);
    setShowTutor(false);
    setTutorExplanation(null);
    try {
      const transcription = await speechToText(blob);
      const evalPrompt = getEvaluationPrompt(currentCard.prompt, transcription, `${currentCard.type} review`, tone);
      const evalResponse = await chatCompletion('You are an expert English language evaluator. Respond only with valid JSON.', evalPrompt);
      const evalResult: EvaluationResult = JSON.parse(evalResponse);
      evalResult.userTranscription = transcription;
      setEvaluation(evalResult);
      setShowResults(true);

      const updatedCard = updateCardSchedule(currentCard, evalResult.score);
      updatedCard.reviews.push({
        date: new Date().toISOString(),
        score: evalResult.score,
        userTranscription: transcription,
      });
      updatedCard.latestEvaluation = evalResult;
      await updateCard(updatedCard)

      const patterns = await extractErrorPatterns(evalResult, currentCard.prompt, currentCard.id);
      await recordErrorPatterns(patterns)

      setSessionScores(prev => [...prev, evalResult.score]);

      await addXP(XP_PER_REVIEW)
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
      const tutorPrompt = getTutorExplanationPrompt(
        currentCard.prompt,
        evaluation.userTranscription,
        evaluation.correctedVersion,
        evaluation.corrections,
        tone
      );
      const explanation = await chatCompletion(
        'You are a patient, encouraging English tutor. Explain mistakes clearly and provide helpful examples.',
        tutorPrompt
      );
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
      setError(null);
    } else {
      setSessionComplete(true);
      await recordSessionSnapshot()
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
    const avgScore = sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length;
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
            'flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer',
            reviewMode === 'standard'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <CheckCircle2 size={16} className="inline mr-1" />
          Revisão Padrão
        </button>
        <button
          onClick={() => {
            void loadDueCards('intelligent');
          }}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer',
            reviewMode === 'intelligent'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Brain size={16} className="inline mr-1" />
          Revisão Inteligente
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
            <p className="text-lg text-foreground leading-relaxed text-pretty">{currentCard.prompt}</p>
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
              <EvaluationResults result={evaluation} showSaveButton={false} />

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
