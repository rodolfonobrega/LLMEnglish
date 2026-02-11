import { Loader2, Volume2, CheckCircle2, AlertTriangle, Lightbulb, MessageCircle, Star } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import type { EvaluationResult } from '../../types/card';
import { ScoreDisplay } from './ScoreDisplay';
import { Button } from '../ui/Button';

interface EvaluationResultsProps {
  result: EvaluationResult;
  onSaveToLibrary?: () => void;
  showSaveButton?: boolean;
}

export function EvaluationResults({ result, onSaveToLibrary, showSaveButton = true }: EvaluationResultsProps) {
  const { speak, isLoading: ttsLoading } = useTTS();

  return (
    <div className="space-y-5">
      {/* Score */}
      <div className="flex justify-center py-2">
        <ScoreDisplay score={result.score} size="lg" />
      </div>

      {/* What you said */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle size={12} className="text-muted-foreground" />
          </div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What you said</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">{result.userTranscription || '(no speech detected)'}</p>
      </div>

      {/* Corrected version */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-[var(--leaf-soft)] flex items-center justify-center">
              <CheckCircle2 size={12} className="text-[var(--leaf)]" />
            </div>
            <h4 className="text-xs font-bold text-[var(--leaf)] uppercase tracking-wide">Corrected Version</h4>
          </div>
          <button
            onClick={() => speak(result.correctedVersion)}
            disabled={ttsLoading}
            aria-label="Listen to corrected version"
            className="size-8 rounded-full bg-[var(--sky-soft)] flex items-center justify-center text-[var(--sky)] hover:bg-[var(--sky)]/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          </button>
        </div>
        <p className="text-[var(--leaf)] font-medium leading-relaxed">{result.correctedVersion}</p>
      </div>

      {/* Better Alternatives */}
      {result.betterAlternatives.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-full bg-[var(--amber-soft)] flex items-center justify-center">
              <Lightbulb size={12} className="text-[var(--amber)]" />
            </div>
            <h4 className="text-xs font-bold text-[var(--amber)] uppercase tracking-wide">More Natural Ways</h4>
          </div>
          <ul className="space-y-2.5">
            {result.betterAlternatives.map((alt, i) => (
              <li key={i} className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5">
                <span className="text-muted-foreground text-sm leading-relaxed">{alt}</span>
                <button
                  onClick={() => speak(alt)}
                  aria-label={`Listen to alternative ${i + 1}`}
                  className="size-7 rounded-full bg-[var(--sky-soft)] flex items-center justify-center text-[var(--sky)] hover:bg-[var(--sky)]/20 transition-colors ml-2 flex-shrink-0 cursor-pointer"
                >
                  <Volume2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrections */}
      {result.corrections.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
              <AlertTriangle size={12} className="text-[var(--danger)]" />
            </div>
            <h4 className="text-xs font-bold text-[var(--danger)] uppercase tracking-wide">Corrections</h4>
          </div>
          <ul className="space-y-2">
            {result.corrections.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-muted-foreground text-sm">
                <span className="flex-shrink-0 size-5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pronunciation Feedback */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-6 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
            <Volume2 size={12} className="text-[var(--sky)]" />
          </div>
          <h4 className="text-xs font-bold text-[var(--sky)] uppercase tracking-wide">Pronunciation Feedback</h4>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Rhythm', value: result.pronunciationFeedback.rhythm },
            { label: 'Intonation', value: result.pronunciationFeedback.intonation },
            { label: 'Connected Speech', value: result.pronunciationFeedback.connectedSpeech },
          ].filter(item => item.value).map(item => (
            <div key={item.label} className="bg-muted rounded-xl px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide mb-0.5">{item.label}</p>
              <p className="text-foreground text-sm leading-relaxed">{item.value}</p>
            </div>
          ))}
          {result.pronunciationFeedback.tips.length > 0 && (
            <div className="bg-muted rounded-xl px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide mb-1.5">Tips</p>
              <ul className="space-y-1">
                {result.pronunciationFeedback.tips.map((tip, i) => (
                  <li key={i} className="text-foreground text-sm leading-relaxed">&bull; {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Overall Feedback */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
            <Star size={12} className="text-[var(--sky)]" />
          </div>
          <h4 className="text-xs font-bold text-[var(--sky)] uppercase tracking-wide">Overall Feedback</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">{result.overallFeedback}</p>
      </div>

      {/* Save Button */}
      {showSaveButton && onSaveToLibrary && (
        <Button variant="coral" size="lg" onClick={onSaveToLibrary} className="w-full rounded-2xl text-lg font-bold py-4 cursor-pointer">
          Save to Library
        </Button>
      )}
    </div>
  );
}
