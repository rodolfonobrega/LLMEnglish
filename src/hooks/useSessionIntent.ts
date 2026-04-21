/**
 * useSessionIntent — Phase 8 hook.
 *
 * Thin wrapper around `services/sessionIntent.ts` using
 * `useSyncExternalStore` so any React component can observe the current
 * `SessionIntent` without prop drilling.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  extendSessionIntent,
  getSessionIntent,
  setSessionIntent,
  subscribe,
} from '../services/sessionIntent';
import type { SessionIntent } from '../types/master';

export interface UseSessionIntent {
  intent: SessionIntent | null;
  setIntent: (next: Partial<SessionIntent> | null) => void;
  extendIntent: (minutes: number) => void;
}

export function useSessionIntent(): UseSessionIntent {
  const intent = useSyncExternalStore<SessionIntent | null>(
    subscribe,
    getSessionIntent,
    getSessionIntent,
  );
  const setIntent = useCallback(
    (next: Partial<SessionIntent> | null) => setSessionIntent(next),
    [],
  );
  const extendIntent = useCallback(
    (minutes: number) => extendSessionIntent(minutes),
    [],
  );
  return { intent, setIntent, extendIntent };
}
