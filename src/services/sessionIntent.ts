/**
 * sessionIntent — Phase 8 (F-P8-01).
 *
 * Lightweight module-level store for the student-declared `SessionIntent`.
 * Lives outside the React tree so any service (prescribe, drill pipelines,
 * cross-surface nudges) can read the current intent without prop drilling.
 *
 * Design mirrors `runtimeConfigSnapshot.ts`: a single snapshot + pub/sub
 * channel so React components can use `useSyncExternalStore` for consistent
 * rerenders.
 *
 * Persistence: the intent is mirrored to `localStorage` so a refresh
 * inside the session does not lose the student's declaration. An expired
 * intent (past `expires_at`) is dropped on load.
 */

import type { SessionIntent } from '../types/master';

const STORAGE_KEY = 'llmenglish.session_intent.v1';

let current: SessionIntent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function readLocalStorage(): SessionIntent | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionIntent;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.expires_at) {
      const t = Date.parse(parsed.expires_at);
      if (Number.isFinite(t) && t <= Date.now()) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalStorage(intent: SessionIntent | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (intent === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // swallow quota / disabled storage
  }
}

// Hydrate on module load. Safe under SSR because `readLocalStorage`
// returns `null` when localStorage is absent.
current = readLocalStorage();

/**
 * Return the active session intent, or `null` when nothing is set.
 * Expired intents are discarded lazily.
 */
export function getSessionIntent(): SessionIntent | null {
  if (!current) return null;
  if (current.expires_at) {
    const t = Date.parse(current.expires_at);
    if (Number.isFinite(t) && t <= Date.now()) {
      current = null;
      writeLocalStorage(null);
      emit();
      return null;
    }
  }
  return current;
}

/**
 * Declare a new session intent, merging into any existing one. Pass
 * `null` to clear. Fires listeners synchronously.
 *
 * `declared_at` is auto-populated when the caller omits it.
 */
export function setSessionIntent(
  next: Partial<SessionIntent> | null,
): void {
  if (next === null) {
    current = null;
    writeLocalStorage(null);
    emit();
    return;
  }
  const merged: SessionIntent = {
    ...(current ?? { declared_at: new Date().toISOString() }),
    ...next,
    declared_at: current?.declared_at ?? new Date().toISOString(),
  };
  current = merged;
  writeLocalStorage(merged);
  emit();
}

/** Extend the current intent's expires_at by `minutes`. No-op when empty. */
export function extendSessionIntent(minutes: number): void {
  if (!current) return;
  const base = current.expires_at ? Date.parse(current.expires_at) : Date.now();
  if (!Number.isFinite(base)) return;
  const nextExpires = new Date(base + minutes * 60 * 1000).toISOString();
  current = { ...current, expires_at: nextExpires };
  writeLocalStorage(current);
  emit();
}

/** Pub/sub used by React hooks via `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper — resets both state and storage. */
export function resetSessionIntentForTest(): void {
  current = null;
  writeLocalStorage(null);
  emit();
}
