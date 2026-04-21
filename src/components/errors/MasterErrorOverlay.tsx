/**
 * MasterErrorOverlay — Phase 3 (F-P3-03).
 *
 * The Error Dashboard (`/errors`) is the one surface where we don't
 * enforce stealth: students who navigate here explicitly want analysis.
 * This overlay exposes the Master's current reading of the LearnerModel
 * alongside the raw error-frequency list the page already shows:
 *
 *   * Chronic errors     — `learnerModel.chronic_errors`, ordered by
 *                          occurrences. Shows hypothesis (a short
 *                          pedagogical note) when present.
 *   * Acquiring patterns — `learnerModel.acquiring_patterns`, ordered
 *                          by ascending success rate so the "weakest
 *                          in-progress" patterns come first.
 *   * Recently mastered  — `learnerModel.mastered_patterns`, top N.
 *
 * Read-only. No LLM calls. Fails silently when Master is disabled or
 * the LearnerModel can't be loaded.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, TrendingUp, Lightbulb, Trophy } from 'lucide-react';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { loadLearnerModel } from '../../services/learnerModel';
import type {
  LearnerModel,
  AcquiringPattern,
  ChronicError,
} from '../../types/learnerModel';

const TOP_CHRONIC = 3;
const TOP_ACQUIRING = 3;
const TOP_MASTERED = 5;

export function MasterErrorOverlay() {
  const [model, setModel] = useState<LearnerModel | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!masterEnabled()) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await loadLearnerModel();
        if (!cancelled) setModel(next);
      } catch (err) {
        console.warn('[MasterErrorOverlay] loadLearnerModel failed', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;
  if (!masterEnabled()) return null;
  if (!model) return null;

  // When the model is completely empty, nothing to show.
  const isEmpty =
    model.chronic_errors.length === 0 &&
    model.acquiring_patterns.length === 0 &&
    model.mastered_patterns.length === 0;
  if (isEmpty) return null;

  const topChronic = [...model.chronic_errors]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, TOP_CHRONIC);

  const topAcquiring = [...model.acquiring_patterns]
    .sort((a, b) => a.success_rate - b.success_rate)
    .slice(0, TOP_ACQUIRING);

  const topMastered = model.mastered_patterns.slice(0, TOP_MASTERED);

  return (
    <section
      className="rounded-2xl border border-primary/20 bg-primary-soft p-5 space-y-5"
      data-testid="master-error-overlay"
    >
      <header className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
            Leitura do tutor
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
            Como o Mestre está enxergando o seu momento atual. Esta é a
            única tela onde ele fala em termos pedagógicos.
          </p>
        </div>
      </header>

      {topChronic.length > 0 && (
        <ChronicBlock chronic={topChronic} />
      )}

      {topAcquiring.length > 0 && (
        <AcquiringBlock acquiring={topAcquiring} />
      )}

      {topMastered.length > 0 && (
        <MasteredBlock mastered={topMastered} />
      )}

      {typeof model.confidence === 'number' && (
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-primary/10">
          Confiança do modelo:{' '}
          <span className="font-semibold tabular-nums">
            {Math.round(model.confidence * 100)}%
          </span>
          {model.diagnostic_mode && (
            <span className="ml-2">· em modo diagnóstico</span>
          )}
        </p>
      )}
    </section>
  );
}

function ChronicBlock({ chronic }: { chronic: ChronicError[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
        <AlertTriangle size={12} />
        Erros crônicos em foco
      </div>
      <ul className="space-y-2">
        {chronic.map((c) => (
          <li
            key={c.id}
            className="rounded-xl bg-card border border-border p-3 space-y-1"
            data-testid="master-overlay-chronic"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground truncate">
                {humanizePatternId(c.id)}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {c.occurrences}x
              </span>
            </div>
            {c.hypothesis && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
                <Lightbulb size={12} className="mt-0.5 shrink-0 text-[var(--amber)]" />
                <span>{c.hypothesis}</span>
              </p>
            )}
            {c.teaching_attempts > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tentativas diretas do Mestre: {c.teaching_attempts}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AcquiringBlock({ acquiring }: { acquiring: AcquiringPattern[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
        <TrendingUp size={12} />
        Em aquisição
      </div>
      <ul className="space-y-2">
        {acquiring.map((a) => {
          const pct = Math.round(a.success_rate * 100);
          return (
            <li
              key={a.id}
              className="rounded-xl bg-card border border-border p-3 space-y-1"
              data-testid="master-overlay-acquiring"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground truncate">
                  {humanizePatternId(a.id)}
                </p>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {pct}% · {a.attempts} tent.
                </span>
              </div>
              {a.hypothesis && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
                  <Lightbulb size={12} className="mt-0.5 shrink-0 text-[var(--amber)]" />
                  <span>{a.hypothesis}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MasteredBlock({ mastered }: { mastered: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-leaf">
        <Trophy size={12} />
        Dominados recentemente
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mastered.map((id) => (
          <span
            key={id}
            className="text-xs rounded-full bg-leaf-soft text-leaf px-2.5 py-1"
            data-testid="master-overlay-mastered"
          >
            {humanizePatternId(id)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Canonical pattern ids are snake_case (e.g.
 * `past_continuous_in_interrupted_narrative`). Humanize them for the
 * overlay — still pedagogical language, just readable.
 */
function humanizePatternId(id: string): string {
  return id
    .split('_')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
