/**
 * NudgeCard — Phase 4 (F-P4-03).
 *
 * Renders the current `PendingNudge` from the nudge engine as a
 * soft one-liner with a "Vamos lá" action and a dismiss affordance.
 * Mirrors `LessonOfferCard` visually so the surface feels consistent.
 *
 * Gating applied here (belt-and-suspenders with the engine):
 *   * Master disabled → render nothing.
 *   * Student opted out of reflections → render nothing.
 *   * Quick-practice session intent active → render nothing.
 *
 * The engine already refuses to *create* nudges under those
 * conditions, but a user could flip a switch after the nudge was
 * stored. Re-checking at render time keeps the card honest.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useNudge } from '../../hooks/useNudge';
import { useSessionIntent } from '../../hooks/useSessionIntent';
import { useAuth } from '../../contexts/AuthContext';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';

export function NudgeCard() {
  const navigate = useNavigate();
  const { nudge, dismiss, consume } = useNudge();
  const { intent } = useSessionIntent();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!masterEnabled()) return null;
  if (!nudge) return null;
  if (intent?.quick_practice) return null;

  const optedOut = profile?.reflections_opt_in === false;
  if (optedOut) return null;

  const handleAccept = () => {
    const consumed = consume();
    if (consumed) {
      navigate(consumed.destination_path);
    }
  };

  return (
    <section>
      <div
        className="w-full rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4"
        data-testid="nudge-card"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-accent" data-testid="nudge-card-title">
                {nudge.title}
              </div>
              <button
                type="button"
                aria-label="Dispensar"
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="nudge-card-dismiss"
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="text-xs text-muted-foreground mt-0.5"
              data-testid="nudge-card-subtitle"
            >
              {nudge.subtitle}
            </div>
            <button
              type="button"
              onClick={handleAccept}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
              data-testid="nudge-card-accept"
            >
              Vamos lá
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
