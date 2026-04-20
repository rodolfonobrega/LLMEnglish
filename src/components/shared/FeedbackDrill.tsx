import { useState } from 'react';
import { Loader2, Mic, Square, Volume2, RotateCcw, Check, Sparkles } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { speechToText } from '../../services/openai';
import { cn } from '../../utils/cn';

interface FeedbackDrillProps {
  /** The model answer the user should try to reproduce. */
  target: string;
  /** The user's original transcription — rendered as a diff anchor. */
  original?: string;
  /**
   * Optional callback fired when the user reaches a high enough similarity
   * to count as "got it". The parent can bump gamification / telemetry.
   */
  onMastered?: (attempt: { transcript: string; similarity: number }) => void;
}

const MASTERY_THRESHOLD = 0.82;

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Very lightweight token-level Jaccard similarity. Good enough for drill
 * feedback; we are not trying to be an alignment engine here.
 */
function similarity(a: string, b: string): number {
  const ta = new Set(normalizeForCompare(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeForCompare(b).split(' ').filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap += 1;
  });
  return overlap / Math.max(ta.size, tb.size);
}

interface Attempt {
  transcript: string;
  similarity: number;
}

/**
 * Feedback-as-practice drill.
 *
 * Flow:
 *   1. Show the native `target` (with a TTS button) and a tiny diff hint vs `original`.
 *   2. User records a new attempt and we STT it.
 *   3. We score similarity → show a status (great / close / try again) + diff.
 *   4. User can retry until they hit mastery (token Jaccard ≥ 0.82) or dismiss.
 *
 * The drill is INTENTIONALLY scoped to a single target sentence: the full
 * 5D scorecard lives in `ScorecardDisplay`, while this component is about
 * closing the loop with motor practice of one concrete correction.
 */
export function FeedbackDrill({ target, original, onMastered }: FeedbackDrillProps) {
  const { speak, isLoading: ttsLoading } = useTTS();
  const recorder = useAudioRecorder();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bestAttempt = attempts.length
    ? attempts.reduce((a, b) => (a.similarity >= b.similarity ? a : b))
    : null;
  const mastered = bestAttempt ? bestAttempt.similarity >= MASTERY_THRESHOLD : false;

  const handleStop = async () => {
    recorder.stopRecording();
    // The recorder writes audioBlob asynchronously after stop() returns; wait
    // briefly so the MediaRecorder.onstop handler can fill state.audioBlob.
    let tries = 0;
    while (tries < 40 && !recorder.audioBlob) {
      await new Promise((r) => setTimeout(r, 50));
      tries += 1;
    }
    const audioBlob = recorder.audioBlob;
    if (!audioBlob) return;
    setIsTranscribing(true);
    setError(null);
    try {
      const transcript = await speechToText(audioBlob);
      const sim = similarity(transcript, target);
      const attempt: Attempt = { transcript, similarity: sim };
      setAttempts((prev) => [...prev, attempt]);
      if (sim >= MASTERY_THRESHOLD) {
        onMastered?.(attempt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao transcrever');
    } finally {
      setIsTranscribing(false);
      recorder.discardRecording();
    }
  };

  const statusForSim = (sim: number) => {
    if (sim >= MASTERY_THRESHOLD) return { label: 'Mandou bem!', color: 'var(--leaf)', icon: <Check size={14} /> };
    if (sim >= 0.6) return { label: 'Tá perto — tenta de novo', color: 'var(--amber)', icon: <Sparkles size={14} /> };
    return { label: 'Escuta de novo e repete', color: 'var(--danger)', icon: <RotateCcw size={14} /> };
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-primary-soft flex items-center justify-center">
          <Sparkles size={12} className="text-primary" />
        </div>
        <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Pratique a correção</h4>
      </div>

      <div className="rounded-xl bg-muted/60 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-leaf font-medium leading-relaxed flex-1">{target}</p>
          <button
            onClick={() => speak(target)}
            disabled={ttsLoading}
            aria-label="Ouvir o alvo"
            className="flex-shrink-0 size-8 rounded-full bg-primary-soft flex items-center justify-center text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          </button>
        </div>
        {original && (
          <p className="text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wide font-semibold">Você disse:</span>{' '}
            <span className="italic">"{original}"</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        {!recorder.isRecording ? (
          <button
            onClick={recorder.startRecording}
            disabled={isTranscribing}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm',
              'bg-primary text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50',
            )}
          >
            <Mic size={16} />
            {attempts.length === 0 ? 'Tentar falar' : 'Tentar de novo'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm bg-[var(--danger)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Square size={16} />
            Parar
          </button>
        )}
        {isTranscribing && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> transcrevendo...
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-[var(--danger)] text-center">{error}</p>
      )}

      {attempts.length > 0 && bestAttempt && (
        <div className="space-y-2">
          <div
            className="rounded-xl px-4 py-3 border"
            style={{
              borderColor: statusForSim(bestAttempt.similarity).color,
              backgroundColor: 'var(--card)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: statusForSim(bestAttempt.similarity).color }}>
                {statusForSim(bestAttempt.similarity).icon}
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: statusForSim(bestAttempt.similarity).color }}
              >
                {statusForSim(bestAttempt.similarity).label}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                {Math.round(bestAttempt.similarity * 100)}% match
              </span>
            </div>
            <p className="text-sm text-foreground/80 italic">"{bestAttempt.transcript}"</p>
          </div>

          {mastered && (
            <p className="text-xs text-leaf text-center">Beleza, você pegou! Pode seguir pra próxima.</p>
          )}
        </div>
      )}
    </div>
  );
}
