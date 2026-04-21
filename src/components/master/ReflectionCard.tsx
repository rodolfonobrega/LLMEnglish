/**
 * ReflectionCard — Phase 3 (F-P3-01c).
 *
 * End-of-session card rendered by Live / Review / Lesson / Exercises /
 * Paths surfaces after `generateSessionReflection` resolves. Two-line
 * stealth copy ("strength" + "opportunity"), a dismiss affordance, and
 * an explicit "desligar reflexões" escape valve that flips the profile
 * flag.
 *
 * Design notes:
 *   * We never show `salient_patterns` verbatim — they're metadata for
 *     the history page, not for the student.
 *   * Opt-out flips `profiles.reflections_opt_in = false` immediately
 *     and marks this specific row as the one that triggered it, so the
 *     history page can annotate "opted out on this session".
 *   * Dismissal is soft: the row stays so the history page can show it.
 */

import { useState } from 'react';
import { Sparkles, X, BellOff } from 'lucide-react';
import type { StoredSessionReflection } from '../../services/sessionReflections';
import {
  dismissReflection,
  markReflectionOptedOut,
} from '../../services/sessionReflections';
import { updateProfile } from '../../services/supabase/auth';
import { useAuth } from '../../contexts/AuthContext';

interface ReflectionCardProps {
  reflection: StoredSessionReflection;
  /**
   * Called after the student dismisses or opts out, so the parent can
   * hide the card from its local state. The parent is responsible for
   * unmounting — this component does not animate itself away.
   */
  onClose?: () => void;
}

export function ReflectionCard({ reflection, onClose }: ReflectionCardProps) {
  const { refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await dismissReflection(reflection.id);
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  const handleOptOut = async () => {
    setBusy(true);
    try {
      // Flip profile flag first — if it succeeds we can safely mark the
      // row. If the row update fails (e.g., DB hiccup), the opt-out
      // still takes effect because the profile flag is what gates
      // future reflections.
      try {
        await updateProfile({ reflections_opt_in: false });
        await refreshProfile();
      } catch (err) {
        console.warn('[ReflectionCard] profile opt-out failed', err);
      }
      await markReflectionOptedOut(reflection.id);
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  return (
    <section>
      <div
        className="w-full rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4"
        data-testid="reflection-card"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-accent">Um pensamento rápido</div>
              <button
                type="button"
                aria-label="Dispensar"
                onClick={handleDismiss}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                data-testid="reflection-card-dismiss"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-foreground leading-snug" data-testid="reflection-strength">
              {reflection.strength_text}
            </p>
            <p className="text-sm text-muted-foreground leading-snug" data-testid="reflection-opportunity">
              {reflection.opportunity_text}
            </p>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleOptOut}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
                data-testid="reflection-card-opt-out"
              >
                <BellOff size={12} />
                Desligar reflexões
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
