import { useState, useEffect } from 'react';
import { getCardsDueForReview, updateCard } from '../../services/storage';
import { updateCardSchedule } from '../../services/spacedRepetition';
import { AudioRecorder } from '../shared/AudioRecorder';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { chatCompletion, speechToText } from '../../services/openai';
import { getEvaluationPrompt } from '../../utils/prompts';
import { addXP } from '../../services/gamification';
import { XP_PER_REVIEW } from '../../types/gamification';
import type { Card, EvaluationResult } from '../../types/card';
import { Loader2, RotateCcw, ChevronRight, CheckCircle2, Compass, Trophy } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function ReviewPage() {
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  useEffect(() => {
    loadDueCards();
  }, []);

  const loadDueCards = () => {
    const cards = getCardsDueForReview();
    setDueCards(cards);
    setCurrentIndex(0);
    setEvaluation(null);
    setShowResults(false);
    setSessionComplete(false);
    setSessionScores([]);
  };

  const currentCard = dueCards[currentIndex];

  const handleAudioReady = async (blob: Blob) => {
    if (!currentCard) return;
    setIsEvaluating(true);
    setError(null);
    try {
      const transcription = await speechToText(blob);
      const evalPrompt = getEvaluationPrompt(currentCard.prompt, transcription, `${currentCard.type} review`);
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
      updateCard(updatedCard);

      setSessionScores(prev => [...prev, evalResult.score]);

      addXP(XP_PER_REVIEW);
      window.dispatchEvent(new Event('gamification-update'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setEvaluation(null);
      setShowResults(false);
      setError(null);
    } else {
      setSessionComplete(true);
    }
  };

  // Empty state
  if (dueCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
        <div className="size-24 bg-leaf-soft rounded-full flex items-center justify-center">
          <CheckCircle2 size={48} className="text-leaf" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-ink text-balance">All Caught Up!</h2>
          <p className="text-ink-muted max-w-sm text-pretty">
            No cards are due for review. Keep practicing in Discovery mode or check back later.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/">
            <Button variant="primary">
              <Compass size={16} />
              Practice in Discovery
            </Button>
          </a>
          <Button variant="secondary" onClick={loadDueCards}>
            <RotateCcw size={16} />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // Session complete
  if (sessionComplete) {
    const avgScore = sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-8">
        <div className="size-20 bg-amber-soft rounded-full flex items-center justify-center">
          <Trophy size={40} className="text-amber" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-ink text-balance">Session Complete!</h2>
          <p className="text-ink-muted">Great work on your reviews.</p>
        </div>
        <ScoreDisplay score={Math.round(avgScore * 10) / 10} size="lg" />
        <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-sm)] w-full max-w-xs">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-extrabold text-ink tabular-nums">{sessionScores.length}</p>
              <p className="text-xs text-ink-muted">Reviewed</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-leaf tabular-nums">{sessionScores.filter(s => s >= 7).length}</p>
              <p className="text-xs text-ink-muted">Correct (7+)</p>
            </div>
          </div>
        </div>
        <Button variant="coral" size="lg" onClick={loadDueCards} className="rounded-2xl px-8">
          <RotateCcw size={18} />
          Review More
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink text-balance">Review</h2>
          <p className="text-ink-muted tabular-nums text-sm">Card {currentIndex + 1} of {dueCards.length}</p>
        </div>
        <div className="bg-card rounded-full px-4 py-1.5 text-sm font-semibold text-ink-secondary tabular-nums shadow-[var(--shadow-sm)]">
          {dueCards.length - currentIndex} remaining
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2.5 bg-card-warm rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-sky to-coral rounded-full transition-all duration-500"
          style={{ width: `${((currentIndex + (showResults ? 1 : 0)) / dueCards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      {currentCard && (
        <div className="bg-card rounded-[20px] p-6 shadow-[var(--shadow-md)] space-y-6">
          {/* Prompt */}
          <div className="bg-card-warm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="capitalize">{currentCard.type}</Badge>
            </div>
            <p className="text-lg text-ink leading-relaxed text-pretty">{currentCard.prompt}</p>
            {currentCard.imageUrl && (
              <img src={currentCard.imageUrl} alt="Card" className="mt-4 w-full max-h-48 object-cover rounded-xl" />
            )}
          </div>

          {/* Recording */}
          {!showResults && (
            <>
              <AudioRecorder onAudioReady={handleAudioReady} disabled={isEvaluating} />
              {isEvaluating && (
                <div className="flex items-center justify-center gap-2 text-sky">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="font-medium">Evaluating...</span>
                </div>
              )}
            </>
          )}

          {/* Results */}
          {showResults && evaluation && (
            <div className="space-y-4">
              <EvaluationResults result={evaluation} showSaveButton={false} />
              <Button
                variant="coral"
                size="lg"
                onClick={handleNext}
                className="w-full rounded-2xl text-lg font-bold"
              >
                <ChevronRight size={20} />
                {currentIndex < dueCards.length - 1 ? 'Next Card' : 'Finish Session'}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-danger-soft border border-danger/30 rounded-2xl p-4 text-danger text-sm">{error}</div>
      )}
    </div>
  );
}
