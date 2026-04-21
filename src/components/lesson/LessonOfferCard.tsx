/**
 * LessonOfferCard — Wave 6 Stage B.
 *
 * Surfaces live (non-dry-run) lesson offers on the Practice Hub as a
 * soft suggestion. Thematic copy only — no pedagogical labels.
 *
 * Flow on "Try it":
 *   - composeLesson(learnerModel, candidate)    → LessonPlan
 *   - createLesson(userId, plan)                → LessonRow
 *   - setOfferStatus(offerId, 'accepted')
 *   - navigate(`/lesson/${lesson.id}`)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, X } from 'lucide-react';
import type { LessonOfferRow } from '../../types/supabase';
import type { LessonCandidate } from '../../services/master/lessonTriggers';
import { getCurrentUser } from '../../services/supabase/auth';
import { masterEnabled } from '../../services/runtimeConfigSnapshot';
import { loadLearnerModel } from '../../services/learnerModel';
import { composeLesson } from '../../services/master/composeLesson';
import {
  createLesson,
  fetchLiveOffers,
  setOfferStatus,
} from '../../services/master/lessonService';

const MUTE_HOURS = 24;

function offerToCandidate(offer: LessonOfferRow): LessonCandidate {
  return {
    trigger_type: offer.trigger_type,
    candidate_pattern: offer.candidate_pattern,
    reason: 'surfaced_live_offer',
  };
}

export function LessonOfferCard() {
  const navigate = useNavigate();
  const [offer, setOffer] = useState<LessonOfferRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!masterEnabled()) return;
    const user = getCurrentUser();
    if (!user) return;
    let cancelled = false;
    (async () => {
      const offers = await fetchLiveOffers(user.id);
      if (!cancelled && offers.length > 0) setOffer(offers[0]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!offer) return null;

  const handleAccept = async () => {
    setErr(null);
    setBusy(true);
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('Não autenticado.');
      const learnerModel = await loadLearnerModel(user.id);
      const plan = await composeLesson({
        learnerModel,
        candidate: offerToCandidate(offer),
      });
      if (!plan) {
        setErr('Não consegui montar a atividade agora. Tenta de novo em instantes.');
        return;
      }
      const lesson = await createLesson(user.id, plan);
      if (!lesson) {
        setErr('Erro ao criar a atividade.');
        return;
      }
      await setOfferStatus(offer.id, 'accepted');
      navigate(`/lesson/${lesson.id}`);
    } catch (e) {
      console.warn('[LessonOfferCard] accept failed:', e);
      setErr('Falha ao iniciar a atividade.');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    const muteUntil = new Date(Date.now() + MUTE_HOURS * 3600_000).toISOString();
    await setOfferStatus(offer.id, 'dismissed', muteUntil);
    setOffer(null);
  };

  return (
    <section>
      <div
        className="w-full rounded-2xl border border-primary/30 bg-primary-soft px-5 py-4"
        data-testid="lesson-offer-card"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-primary">
                Que tal uma atividade rápida juntos?
              </div>
              <button
                type="button"
                aria-label="Dispensar"
                onClick={handleDismiss}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Preparei algo pensando em você. Leva alguns minutos.
            </div>
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-wait"
              data-testid="lesson-offer-accept"
            >
              {busy ? 'Preparando…' : 'Vamos lá'}
            </button>
            {err && (
              <p className="mt-2 text-xs text-[var(--danger)]" data-testid="lesson-offer-error">
                {err}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
