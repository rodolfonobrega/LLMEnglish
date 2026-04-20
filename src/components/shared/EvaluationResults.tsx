import { useState } from 'react';
import { Loader2, Volume2, CheckCircle2, AlertTriangle, Lightbulb, MessageCircle, Star, ThumbsUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import type { EvaluationResult, CorrectionItem } from '../../types/card';
import { normalizeCorrectionItem, normalizeEvaluationResult } from '../../types/card';
import { ScoreDisplay } from './ScoreDisplay';
import { ScorecardDisplay } from './ScorecardDisplay';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface EvaluationResultsProps {
  result: EvaluationResult;
  onSaveToLibrary?: () => void;
  showSaveButton?: boolean;
  /** Render the Feedback Drill slot above the default layout (Wave 1 F4). */
  drillSlot?: React.ReactNode;
}

const SEVERITY_ORDER: Record<NonNullable<CorrectionItem['severity']>, number> = {
  critical: 0,
  moderate: 1,
  polish: 2,
};

const SEVERITY_LABEL: Record<NonNullable<CorrectionItem['severity']>, string> = {
  critical: 'Crítico',
  moderate: 'Moderado',
  polish: 'Polimento',
};

const SEVERITY_COLOR: Record<NonNullable<CorrectionItem['severity']>, string> = {
  critical: 'var(--danger)',
  moderate: 'var(--amber)',
  polish: 'var(--primary)',
};

export function EvaluationResults({ result, onSaveToLibrary, showSaveButton = true, drillSlot }: EvaluationResultsProps) {
  const { speak, isLoading: ttsLoading } = useTTS();
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());

  const toggleExample = (index: number) => {
    setExpandedExamples(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const normalized = normalizeEvaluationResult(result);
  const corrections = [...normalized.corrections.map(normalizeCorrectionItem)].sort((a, b) => {
    const aRank = a.severity ? SEVERITY_ORDER[a.severity] : 1.5;
    const bRank = b.severity ? SEVERITY_ORDER[b.severity] : 1.5;
    return aRank - bRank;
  });
  const highlights = normalized.highlights ?? [];

  return (
    <div className="space-y-5">
      {/* Score — 5D scorecard when available, scalar fallback otherwise */}
      {normalized.scores5d ? (
        <ScorecardDisplay
          scores={normalized.scores5d}
          primaryDimension={normalized.primaryDimension}
          scalar={normalized.score}
          size="lg"
        />
      ) : (
        <div className="flex justify-center py-2">
          <ScoreDisplay score={normalized.score} size="lg" />
        </div>
      )}

      {drillSlot && <div>{drillSlot}</div>}

      {/* What you said */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 rounded-full bg-muted flex items-center justify-center">
            <MessageCircle size={12} className="text-muted-foreground" />
          </div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">O que você disse</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">{normalized.userTranscription || '(nenhuma fala detectada)'}</p>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-full bg-leaf-soft flex items-center justify-center">
              <ThumbsUp size={12} className="text-leaf" />
            </div>
            <h4 className="text-xs font-bold text-leaf uppercase tracking-wide">Mandou Bem!</h4>
          </div>
          <ul className="space-y-2">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 text-leaf mt-0.5">✓</span>
                <span className="text-leaf/90 leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrected version */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-leaf-soft flex items-center justify-center">
              <CheckCircle2 size={12} className="text-leaf" />
            </div>
            <h4 className="text-xs font-bold text-leaf uppercase tracking-wide">Versão Corrigida</h4>
          </div>
          <button
            onClick={() => speak(normalized.correctedVersion)}
            disabled={ttsLoading}
            aria-label="Ouvir versão corrigida"
            className="size-8 rounded-full bg-primary-soft flex items-center justify-center text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {ttsLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          </button>
        </div>
        <p className="text-leaf font-medium leading-relaxed">{normalized.correctedVersion}</p>
      </div>

      {/* Better Alternatives */}
      {normalized.betterAlternatives.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-full bg-[var(--amber-soft)] flex items-center justify-center">
              <Lightbulb size={12} className="text-[var(--amber)]" />
            </div>
            <h4 className="text-xs font-bold text-[var(--amber)] uppercase tracking-wide">Formas Mais Naturais</h4>
          </div>
          <ul className="space-y-2.5">
            {normalized.betterAlternatives.map((alt, i) => (
              <li key={i} className="flex items-center justify-between bg-muted rounded-xl px-4 py-2.5">
                <span className="text-muted-foreground text-sm leading-relaxed">{alt}</span>
                <button
                  onClick={() => speak(alt)}
                  aria-label={`Listen to alternative ${i + 1}`}
                  className="size-7 rounded-full bg-primary-soft flex items-center justify-center text-primary hover:bg-primary/20 transition-colors ml-2 flex-shrink-0 cursor-pointer"
                >
                  <Volume2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-6 rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
              <AlertTriangle size={12} className="text-[var(--danger)]" />
            </div>
            <h4 className="text-xs font-bold text-[var(--danger)] uppercase tracking-wide">Correções</h4>
          </div>
          <ul className="space-y-3">
            {corrections.map((c, i) => (
              <li key={i} className="space-y-1.5">
                <div className="flex items-start gap-2 text-muted-foreground text-sm">
                  <span className="flex-shrink-0 size-5 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="leading-relaxed flex-1">{c.tip}</span>
                  {c.severity && (
                    <span
                      className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: SEVERITY_COLOR[c.severity], backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}
                    >
                      {SEVERITY_LABEL[c.severity]}
                    </span>
                  )}
                </div>
                {c.example && (
                  <div className="ml-7">
                    <button
                      onClick={() => toggleExample(i)}
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer',
                        expandedExamples.has(i) ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                      )}
                    >
                      {expandedExamples.has(i) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expandedExamples.has(i) ? 'Esconder exemplo' : 'Ver exemplo'}
                    </button>
                    {expandedExamples.has(i) && (
                      <div className="mt-1.5 bg-muted rounded-lg px-3 py-2 text-sm text-foreground/80 italic leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                        "{c.example}"
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall Feedback */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-6 rounded-full bg-primary-soft flex items-center justify-center">
            <Star size={12} className="text-primary" />
          </div>
          <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Feedback Geral</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">{normalized.overallFeedback}</p>
      </div>

      {/* Save Button */}
      {showSaveButton && onSaveToLibrary && (
        <Button variant="coral" size="lg" onClick={onSaveToLibrary} className="w-full rounded-2xl text-lg font-bold py-4 cursor-pointer">
          Salvar na Biblioteca
        </Button>
      )}
    </div>
  );
}
