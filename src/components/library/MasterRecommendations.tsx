/**
 * MasterRecommendations — Phase 4 (F-P4-01).
 *
 * Surfaces a "Hoje o tutor recomenda" strip at the top of the Library
 * page. Recommendations come from the intersection of:
 *
 *   * The top N `chronic_errors` on the LearnerModel (worst offenders
 *     first — lots of occurrences, recent).
 *   * Cards the student already owns that share the chronic
 *     pattern's `canonical_pattern`.
 *
 * Stealth rules still apply: we show the thematic prompt of the card,
 * never the pattern id itself. The framing copy ("o tutor recomenda")
 * is the only signal that something pedagogical is happening.
 *
 * Click behaviour:
 *   * "Revisar agora" → schedules `nextReviewAt = now` and triggers
 *     a refresh, so the Review page picks it up immediately.
 *   * The card title is clickable to open the detail (callback
 *     delegated to the parent, which owns CardDetail).
 */

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Play, ChevronRight } from 'lucide-react';
import type { Card } from '../../types/card';
import type { LearnerModel } from '../../types/learnerModel';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { loadLearnerModel } from '../../services/learnerModel';
import { updateCard } from '../../services/storage';
import { Button } from '../ui/Button';

const TOP_CHRONIC = 3;
const MAX_CARDS = 3;

interface MasterRecommendationsProps {
  cards: Card[];
  onSelectCard: (card: Card) => void;
  onCardsChanged: () => void | Promise<void>;
}

export function MasterRecommendations({
  cards,
  onSelectCard,
  onCardsChanged,
}: MasterRecommendationsProps) {
  const [model, setModel] = useState<LearnerModel | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);

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
        console.warn('[MasterRecommendations] loadLearnerModel failed', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recommended = useMemo<Card[]>(() => {
    if (!model) return [];
    const topPatterns = [...model.chronic_errors]
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, TOP_CHRONIC)
      .map((c) => c.id);
    if (topPatterns.length === 0) return [];

    const matches: Card[] = [];
    const seenCardIds = new Set<string>();
    for (const patternId of topPatterns) {
      for (const card of cards) {
        if (seenCardIds.has(card.id)) continue;
        if (card.canonical_pattern !== patternId) continue;
        matches.push(card);
        seenCardIds.add(card.id);
        if (matches.length >= MAX_CARDS) break;
      }
      if (matches.length >= MAX_CARDS) break;
    }
    return matches;
  }, [cards, model]);

  if (!loaded) return null;
  if (!masterEnabled()) return null;
  if (recommended.length === 0) return null;

  const handleReviewNow = async (card: Card) => {
    setBusyCardId(card.id);
    try {
      await updateCard({ ...card, nextReviewAt: new Date().toISOString() });
      await onCardsChanged();
    } catch (err) {
      console.warn('[MasterRecommendations] review scheduling failed', err);
    } finally {
      setBusyCardId(null);
    }
  };

  return (
    <section
      className="rounded-2xl border border-primary/30 bg-primary-soft p-4 space-y-3"
      data-testid="master-recommendations"
    >
      <header className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
          Hoje o tutor recomenda
        </h3>
      </header>
      <ul className="space-y-2">
        {recommended.map((card) => (
          <li
            key={card.id}
            className="rounded-xl bg-card border border-border px-3 py-2.5 flex items-center gap-3"
            data-testid="master-recommendation-item"
          >
            <button
              type="button"
              onClick={() => onSelectCard(card)}
              className="flex-1 min-w-0 text-left hover:text-primary transition-colors"
            >
              <p className="text-sm text-foreground line-clamp-2 leading-snug">
                {card.prompt}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                {card.type} · {card.theme ?? 'sem tema'}
              </p>
            </button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                void handleReviewNow(card);
              }}
              disabled={busyCardId === card.id}
              className="shrink-0 cursor-pointer"
              data-testid="master-recommendation-review"
            >
              <Play size={12} />
              {busyCardId === card.id ? '...' : 'Praticar'}
            </Button>
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          </li>
        ))}
      </ul>
    </section>
  );
}
