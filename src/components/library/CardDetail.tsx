import { useState, useRef, useEffect } from 'react';
import type { Card } from '../../types/card';
import { computeReviewStats } from '../../types/review';
import { EvaluationResults } from '../shared/EvaluationResults';
import { ScoreDisplay } from '../shared/ScoreDisplay';
import { useTTS } from '../../hooks/useTTS';
import { base64ToAudioUrl, playAudioUrl } from '../../utils/audio';
import { ArrowLeft, Volume2, Loader2, Play, Square, BarChart3, Calendar, Repeat } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface CardDetailProps {
  card: Card;
  onBack: () => void;
}

export function CardDetail({ card, onBack }: CardDetailProps) {
  const { speak, isLoading: ttsLoading } = useTTS();
  const stats = computeReviewStats(card.reviews);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleUserAudio = () => {
    if (isPlayingUserAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlayingUserAudio(false);
    } else if (card.userAudioBlob) {
      const audio = playAudioUrl(base64ToAudioUrl(card.userAudioBlob, 'audio/webm'));
      audioRef.current = audio;
      setIsPlayingUserAudio(true);

      audio.onended = () => {
        setIsPlayingUserAudio(false);
        audioRef.current = null;
      };

      audio.onpause = () => {
        setIsPlayingUserAudio(false);
      };
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft size={18} />
        Voltar
      </Button>

      {/* Card Info */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="capitalize">{card.type}</Badge>
          <span className="text-xs text-muted-foreground">
            Criado em {new Date(card.createdAt).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <p className="text-xl text-foreground mb-5 text-pretty leading-relaxed font-medium">{card.prompt}</p>

        {card.imageUrl && (
          <img src={card.imageUrl} alt="Card visual prompt" className="w-full max-h-64 object-cover rounded-2xl mb-5" />
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => speak(card.latestEvaluation?.correctedVersion || card.prompt)}
            disabled={ttsLoading}
            aria-label="Ouvir áudio da IA"
          >
            {ttsLoading ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
            Ouvir Áudio da IA
          </Button>
          {card.userAudioBlob && (
            <Button
              variant={isPlayingUserAudio ? "destructive" : "secondary"}
              size="sm"
              onClick={toggleUserAudio}
              aria-label={isPlayingUserAudio ? "Parar gravação" : "Ouvir minha gravação"}
            >
              {isPlayingUserAudio ? <Square size={16} fill="currentColor" /> : <Play size={16} />}
              {isPlayingUserAudio ? "Parar" : "Minha Gravação"}
            </Button>
          )}
        </div>
      </div>

      {/* Review Stats */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-5">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <BarChart3 size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Histórico de Revisões</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-muted rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{stats.totalReviews}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </div>
          <div className="bg-[var(--leaf-soft)] rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-leaf tabular-nums">{stats.correctCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Corretas</p>
          </div>
          <div className="bg-[var(--amber-soft)] rounded-2xl p-3">
            <p className="text-2xl font-extrabold text-[var(--amber)] tabular-nums">{stats.averageScore || '-'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Média</p>
          </div>
        </div>

        {card.reviews.length > 0 && (
          <div className="mt-5 space-y-2">
            <h4 className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Revisões Recentes</h4>
            {card.reviews.slice(-5).reverse().map((review, i) => (
              <div key={i} className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {new Date(review.date).toLocaleDateString('pt-BR')}
                </span>
                <ScoreDisplay score={review.score} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evaluation Results */}
      {card.latestEvaluation && (
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-5">
            <div className="size-7 rounded-full bg-leaf-soft flex items-center justify-center">
              <Repeat size={14} className="text-leaf" />
            </div>
            <h3 className="text-sm font-bold text-leaf uppercase tracking-wide">Última Avaliação</h3>
          </div>
          <EvaluationResults result={card.latestEvaluation} showSaveButton={false} />
        </div>
      )}

      {/* Scheduling Info */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-7 rounded-full bg-[var(--amber-soft)] flex items-center justify-center">
            <Calendar size={14} className="text-[var(--amber)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--amber)] uppercase tracking-wide">Agendamento</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Intervalo', value: `${card.interval} dias` },
            { label: 'Fator de Facilidade', value: card.easeFactor.toFixed(2) },
            { label: 'Próxima Revisão', value: card.nextReviewAt ? new Date(card.nextReviewAt).toLocaleDateString('pt-BR') : 'Não agendada' },
            { label: 'Repetições', value: String(card.repetitions) },
          ].map(item => (
            <div key={item.label} className="bg-muted rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-foreground font-semibold tabular-nums mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
