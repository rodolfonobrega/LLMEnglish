/**
 * Nudge engine — Phase 4 (F-P4-03).
 *
 * Lightweight event log + rule evaluator that powers one-liner
 * cross-surface nudges like:
 *
 *   * After 3 consecutive review cards on a chronic pattern:
 *       "Que tal praticar isso ao vivo?" → /live with a briefing.
 *   * After a Live session where a `hard_for_user` pattern fired:
 *       "Vou preparar uns drills rápidos de pronúncia pra você."
 *       → /oral-cloze with a briefing.
 *
 * Scope & constraints:
 *   - Strictly read-only on the LearnerModel (nothing is persisted
 *     back to Supabase from here).
 *   - Persistence: the log, the throttle clock, and the pending nudge
 *     live in `localStorage` so they survive refreshes but reset
 *     cleanly across devices.
 *   - Gates: all nudges are silenced when any of the following hold:
 *       * Master is disabled,
 *       * `quick_practice` session intent is active,
 *       * the 24h cross-surface throttle hasn't elapsed since the
 *         last dispatched nudge,
 *       * the student opted out of reflections
 *         (`profiles.reflections_opt_in === false`) — evaluated by
 *         callers since this module is sync and storage-only.
 *   - No LLM calls. All nudge copy is static thematic strings that
 *     sit below the pedagogical-language bar.
 *
 * Pub/sub mirrors `sessionIntent.ts` so components can subscribe via
 * `useSyncExternalStore`.
 */

import { getSessionIntent } from '../sessionIntent';
import { masterEnabled } from '../runtimeConfigSnapshot';

const LOG_STORAGE_KEY = 'llmenglish.nudge.log.v1';
const NUDGE_STORAGE_KEY = 'llmenglish.nudge.pending.v1';
const THROTTLE_STORAGE_KEY = 'llmenglish.nudge.last_dispatched_at.v1';

/** 24h throttle between any two nudges. */
export const NUDGE_THROTTLE_MS = 24 * 60 * 60 * 1000;

/** Retain at most this many events — bounded to keep the log small. */
const MAX_LOG_ENTRIES = 30;

/** How many consecutive chronic-pattern misses trigger the "live" nudge. */
export const REVIEW_CHRONIC_THRESHOLD = 3;

/** Event types the engine understands. */
export type NudgeEventType =
  | 'review_miss_chronic'
  | 'review_hit_other'
  | 'live_hard_pattern_fired';

export interface NudgeEvent {
  type: NudgeEventType;
  /** Pattern id involved (canonical). Optional for events without one. */
  pattern_id?: string;
  /** ISO timestamp. */
  at: string;
}

export type NudgeKind = 'live_for_chronic' | 'oral_cloze_for_hard_pattern';

export interface PendingNudge {
  kind: NudgeKind;
  pattern_id: string;
  /** Static thematic copy shown to the student. */
  title: string;
  subtitle: string;
  /** Destination route when the student accepts. */
  destination_path: string;
  created_at: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function readJSON<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // swallow quota / disabled storage
  }
}

function loadLog(): NudgeEvent[] {
  const arr = readJSON<NudgeEvent[]>(LOG_STORAGE_KEY);
  return Array.isArray(arr) ? arr : [];
}

function saveLog(log: NudgeEvent[]): void {
  const trimmed = log.slice(-MAX_LOG_ENTRIES);
  writeJSON(LOG_STORAGE_KEY, trimmed);
}

function loadPending(): PendingNudge | null {
  return readJSON<PendingNudge>(NUDGE_STORAGE_KEY);
}

function savePending(nudge: PendingNudge | null): void {
  writeJSON(NUDGE_STORAGE_KEY, nudge);
}

function loadLastDispatchedAt(): number {
  const v = readJSON<number>(THROTTLE_STORAGE_KEY);
  return typeof v === 'number' ? v : 0;
}

function saveLastDispatchedAt(ts: number): void {
  writeJSON(THROTTLE_STORAGE_KEY, ts);
}

/**
 * Returns true when a nudge dispatched right now would be silenced by
 * any of the gating rules. Opt-out checks (`reflections_opt_in`) are
 * the caller's responsibility — this function is sync and storage-only.
 */
export function isNudgeAllowed(): boolean {
  if (!masterEnabled()) return false;
  const intent = getSessionIntent();
  if (intent?.quick_practice) return false;
  const last = loadLastDispatchedAt();
  if (last > 0 && Date.now() - last < NUDGE_THROTTLE_MS) return false;
  return true;
}

/** Current pending nudge, if any. */
export function getPendingNudge(): PendingNudge | null {
  return loadPending();
}

/** Pub/sub for React components. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Log an event and re-evaluate nudge rules. If the rules fire and the
 * gates allow it, stores a `PendingNudge` and emits to listeners.
 */
export function recordNudgeEvent(event: Omit<NudgeEvent, 'at'>): void {
  const entry: NudgeEvent = { ...event, at: new Date().toISOString() };
  const log = loadLog();
  log.push(entry);
  saveLog(log);

  if (!isNudgeAllowed()) {
    emit();
    return;
  }

  const nudge = evaluateRules(log);
  if (nudge) {
    savePending(nudge);
    saveLastDispatchedAt(Date.now());
  }
  emit();
}

/**
 * Rule evaluator.
 *
 * Rule 1: last N consecutive events are `review_miss_chronic` on the
 * same `pattern_id` → propose a live session for that pattern.
 *
 * Rule 2: the latest event is `live_hard_pattern_fired` → propose an
 * oral-cloze drill for that pattern.
 */
function evaluateRules(log: NudgeEvent[]): PendingNudge | null {
  if (log.length === 0) return null;

  // Rule 2 takes precedence: the signal is more immediate.
  const latest = log[log.length - 1];
  if (latest.type === 'live_hard_pattern_fired' && latest.pattern_id) {
    return {
      kind: 'oral_cloze_for_hard_pattern',
      pattern_id: latest.pattern_id,
      title: 'Vou preparar uns drills rápidos pra você.',
      subtitle: 'Uns minutos de treino focado vão te deixar mais solto.',
      // OralCloze lives inside ExercisesPage under the `cloze` drill id.
      destination_path: '/exercises?mode=cloze',
      created_at: new Date().toISOString(),
    };
  }

  // Rule 1: scan from the end collecting consecutive chronic misses
  // on the same pattern. Any other event type breaks the streak.
  let streakPattern: string | null = null;
  let streakCount = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const ev = log[i];
    if (ev.type !== 'review_miss_chronic' || !ev.pattern_id) break;
    if (streakPattern === null) {
      streakPattern = ev.pattern_id;
      streakCount = 1;
      continue;
    }
    if (ev.pattern_id !== streakPattern) break;
    streakCount += 1;
  }

  if (streakPattern && streakCount >= REVIEW_CHRONIC_THRESHOLD) {
    return {
      kind: 'live_for_chronic',
      pattern_id: streakPattern,
      title: 'Que tal praticar isso ao vivo?',
      subtitle: 'Uma conversa curta pode fixar melhor do que cards repetidos.',
      destination_path: '/live',
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

/** Student dismissed the nudge. Clears the pending entry. */
export function dismissNudge(): void {
  savePending(null);
  emit();
}

/**
 * Student accepted the nudge. Caller is expected to route; we just
 * clear the pending entry so it doesn't fire again after navigation.
 */
export function consumeNudge(): PendingNudge | null {
  const current = loadPending();
  savePending(null);
  emit();
  return current;
}

/**
 * Force a specific nudge into the pending slot. Used by tests and by
 * surfaces that want to hand-craft a nudge (e.g. a bespoke live
 * recommendation) without going through the event log.
 */
export function setPendingNudgeForTest(nudge: PendingNudge | null): void {
  savePending(nudge);
  if (nudge) saveLastDispatchedAt(Date.now());
  emit();
}

/** Test helper — wipes log, pending nudge, and throttle clock. */
export function resetNudgeEngineForTest(): void {
  writeJSON(LOG_STORAGE_KEY, null);
  writeJSON(NUDGE_STORAGE_KEY, null);
  writeJSON(THROTTLE_STORAGE_KEY, null);
  emit();
}

/** Expose the log for tests / debugging. Read-only. */
export function getNudgeLogForTest(): NudgeEvent[] {
  return loadLog();
}
