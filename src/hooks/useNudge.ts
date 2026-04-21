/**
 * useNudge — Phase 4 (F-P4-03).
 *
 * Thin wrapper around `services/master/nudgeEngine.ts` using
 * `useSyncExternalStore`. Components that render the
 * `NudgeCard` subscribe through this hook so they re-render when a
 * new nudge is stored or the current one is dismissed/consumed.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  consumeNudge,
  dismissNudge,
  getPendingNudge,
  subscribe,
  type PendingNudge,
} from '../services/master/nudgeEngine';

export interface UseNudge {
  nudge: PendingNudge | null;
  dismiss: () => void;
  consume: () => PendingNudge | null;
}

export function useNudge(): UseNudge {
  const nudge = useSyncExternalStore<PendingNudge | null>(
    subscribe,
    getPendingNudge,
    getPendingNudge,
  );
  const dismiss = useCallback(() => dismissNudge(), []);
  const consume = useCallback(() => consumeNudge(), []);
  return { nudge, dismiss, consume };
}
