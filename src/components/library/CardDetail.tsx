import type { Card } from '../../types/card';
import { computeReviewStats } from '../../types/review';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { useTTS } from '../../hooks/useTTS';
import { base64ToAudioUrl, playAudioUrl } from '../../utils/audio';
import { ArrowLeft, Volume2, Loader2, Play, BarChart3, Calendar, Repeat } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface CardDetailProps {
  card: Card;
  onBack: () => void;
}

export function CardDetail({ card, onBack }: CardDetailProps) {
  const { speak, isLoading: ttsLoading } = useTTS();
  const stats = computeReviewStats(card.reviews);

  const playUserAudio = () => {
    if (card.userAudioBlob) {
      playAudioUrl(base64ToAudioUrl(card.userAudioBlob, 'audio/webm'));
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft size={18} />
        Back to Library
      </Button>

      {/* Card Info */}
      <div className="bg-card rounded-[20px] p-6 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="capitalize">{card.type}</Badge>
          <span className="text-xs text-ink-faint">
            Created {new Date(card.createdAt).toLocaleDateString()}
          </span>
        </div>

        <p className="text-xl text-ink mb-5 text-pretty leading-relaxed font-medium">{card.prompt}</p>

        {card.imageUrl && (
          <img src={card.imageUrl} alt="Card" className="w-full max-h-64 object-cover rounded-2xl mb-5" />
        )}

        {/* Listen buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => speak(card.latestEvaluation?.correctedVersion || card.prompt)}
            disabled={ttsLoading}
            aria-label="Listen to AI audio"
          >
            {ttsLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
            Listen to AI Audio
          </Button>
          {card.userAudioBlob && (
            <Button
              variant="secondary"
              size="sm"
              onClick={playUserAudio}
              aria-label="Play my recording"
            >
              <Play size={16} />
              My Recording
            </Button>
          )}
        </div>
      </div>

      {/* Review Stats */}
      <div className="bg-card rounded-[20px] p-6 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-5">
          <div className="size-7 rounded-full bg-sky-soft flex items-center justify-center">
            <BarChart3 size={14} className="text-sky" />
          </div>
          <h3 className="text-sm font-bold text-sky uppercase tracking-wide">Review History</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-card-warm rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-ink tabular-nums">{stats.totalReviews}</p>
            <p className="text-xs text-ink-muted mt-0.5">Total</p>
          </div>
          <div className="bg-leaf-soft rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-leaf tabular-nums">{stats.correctCount}</p>
            <p className="text-xs text-ink-muted mt-0.5">Correct</p>
          </div>
          <div className="bg-amber-soft rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-amber tabular-nums">{stats.averageScore || '-'}</p>
            <p className="text-xs text-ink-muted mt-0.5">Avg Score</p>
          </div>
        </div>

        {card.reviews.length > 0 && (
          <div className="mt-5 space-y-2">
            <h4 className="text-xs text-ink-faint uppercase font-semibold tracking-wide">Recent Reviews</h4>
            {card.reviews.slice(-5).reverse().map((review, i) => (
              <div key={i} className="flex items-center justify-between bg-card-warm rounded-xl px-4 py-2.5">
                <span className="text-xs text-ink-muted">
                  {new Date(review.date).toLocaleDateString()}
                </span>
                <ScoreDisplay score={review.score} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evaluation Results */}
      {card.latestEvaluation && (
        <div className="bg-card rounded-[20px] p-6 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-2 mb-5">
            <div className="size-7 rounded-full bg-leaf-soft flex items-center justify-center">
              <Repeat size={14} className="text-leaf" />
            </div>
            <h3 className="text-sm font-bold text-leaf uppercase tracking-wide">Latest Evaluation</h3>
          </div>
          <EvaluationResults result={card.latestEvaluation} showSaveButton={false} />
        </div>
      )}

      {/* Scheduling Info */}
      <div className="bg-card rounded-[20px] p-6 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-7 rounded-full bg-amber-soft flex items-center justify-center">
            <Calendar size={14} className="text-amber" />
          </div>
          <h3 className="text-sm font-bold text-amber uppercase tracking-wide">Scheduling</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Interval', value: `${card.interval} days` },
            { label: 'Ease Factor', value: card.easeFactor.toFixed(2) },
            { label: 'Next Review', value: card.nextReviewAt ? new Date(card.nextReviewAt).toLocaleDateString() : 'Not scheduled' },
            { label: 'Repetitions', value: String(card.repetitions) },
          ].map(item => (
            <div key={item.label} className="bg-card-warm rounded-xl px-4 py-3">
              <p className="text-xs text-ink-faint">{item.label}</p>
              <p className="text-ink font-semibold tabular-nums mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
