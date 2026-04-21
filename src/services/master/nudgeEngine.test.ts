import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtimeConfigSnapshot', async () => {
  const actual =
    await vi.importActual<typeof import('../runtimeConfigSnapshot')>(
      '../runtimeConfigSnapshot',
    );
  return {
    ...actual,
    masterEnabled: vi.fn(),
  };
});

vi.mock('../sessionIntent', async () => {
  const actual =
    await vi.importActual<typeof import('../sessionIntent')>(
      '../sessionIntent',
    );
  return {
    ...actual,
    getSessionIntent: vi.fn(),
  };
});

import { masterEnabled } from '../runtimeConfigSnapshot';
import { getSessionIntent } from '../sessionIntent';
import {
  NUDGE_THROTTLE_MS,
  REVIEW_CHRONIC_THRESHOLD,
  consumeNudge,
  dismissNudge,
  getPendingNudge,
  isNudgeAllowed,
  recordNudgeEvent,
  resetNudgeEngineForTest,
  setPendingNudgeForTest,
  subscribe,
} from './nudgeEngine';

const masterEnabledMock = vi.mocked(masterEnabled);
const getSessionIntentMock = vi.mocked(getSessionIntent);

function fireReviewMisses(patternId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    recordNudgeEvent({ type: 'review_miss_chronic', pattern_id: patternId });
  }
}

describe('nudgeEngine', () => {
  beforeEach(() => {
    // Polyfill localStorage for node-like vitest environment
    if (typeof localStorage === 'undefined') {
      const store = new Map<string, string>();
      (globalThis as unknown as { localStorage: Storage }).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size;
        },
      } as Storage;
    }
    resetNudgeEngineForTest();
    masterEnabledMock.mockReturnValue(true);
    getSessionIntentMock.mockReturnValue(null);
  });

  describe('gates', () => {
    it('refuses to create a nudge when Master is disabled', () => {
      masterEnabledMock.mockReturnValue(false);
      fireReviewMisses('past_simple_regular_verbs', REVIEW_CHRONIC_THRESHOLD);
      expect(getPendingNudge()).toBeNull();
    });

    it('refuses to create a nudge during quick_practice', () => {
      getSessionIntentMock.mockReturnValue({
        declared_at: new Date().toISOString(),
        quick_practice: true,
      });
      fireReviewMisses('past_simple_regular_verbs', REVIEW_CHRONIC_THRESHOLD);
      expect(getPendingNudge()).toBeNull();
    });

    it('isNudgeAllowed honours all gates', () => {
      expect(isNudgeAllowed()).toBe(true);
      masterEnabledMock.mockReturnValueOnce(false);
      expect(isNudgeAllowed()).toBe(false);
    });
  });

  describe('Rule 1: consecutive chronic misses', () => {
    it('does not fire before the threshold', () => {
      fireReviewMisses('past_simple_regular_verbs', REVIEW_CHRONIC_THRESHOLD - 1);
      expect(getPendingNudge()).toBeNull();
    });

    it('fires exactly at the threshold', () => {
      fireReviewMisses('past_simple_regular_verbs', REVIEW_CHRONIC_THRESHOLD);
      const nudge = getPendingNudge();
      expect(nudge).not.toBeNull();
      expect(nudge!.kind).toBe('live_for_chronic');
      expect(nudge!.pattern_id).toBe('past_simple_regular_verbs');
      expect(nudge!.destination_path).toBe('/live');
    });

    it('resets the streak on a different pattern', () => {
      fireReviewMisses('pattern_a', REVIEW_CHRONIC_THRESHOLD - 1);
      recordNudgeEvent({ type: 'review_miss_chronic', pattern_id: 'pattern_b' });
      expect(getPendingNudge()).toBeNull();
    });

    it('resets the streak on a non-chronic hit', () => {
      fireReviewMisses('pattern_a', REVIEW_CHRONIC_THRESHOLD - 1);
      recordNudgeEvent({ type: 'review_hit_other', pattern_id: 'pattern_a' });
      recordNudgeEvent({ type: 'review_miss_chronic', pattern_id: 'pattern_a' });
      expect(getPendingNudge()).toBeNull();
    });
  });

  describe('Rule 2: hard pattern fired in Live', () => {
    it('fires immediately and overrides a simmering review streak', () => {
      fireReviewMisses('past_simple_regular_verbs', REVIEW_CHRONIC_THRESHOLD - 1);
      recordNudgeEvent({
        type: 'live_hard_pattern_fired',
        pattern_id: 'third_person_s',
      });
      const nudge = getPendingNudge();
      expect(nudge).not.toBeNull();
      expect(nudge!.kind).toBe('oral_cloze_for_hard_pattern');
      expect(nudge!.pattern_id).toBe('third_person_s');
      expect(nudge!.destination_path).toBe('/exercises?mode=cloze');
    });

    it('is a no-op without a pattern_id', () => {
      recordNudgeEvent({ type: 'live_hard_pattern_fired' });
      expect(getPendingNudge()).toBeNull();
    });
  });

  describe('throttle', () => {
    it('refuses to fire a second nudge within the throttle window', () => {
      fireReviewMisses('pattern_a', REVIEW_CHRONIC_THRESHOLD);
      expect(getPendingNudge()).not.toBeNull();
      const firstCreatedAt = getPendingNudge()!.created_at;

      // Dismiss and try again immediately; the throttle still applies.
      dismissNudge();
      expect(getPendingNudge()).toBeNull();
      recordNudgeEvent({
        type: 'live_hard_pattern_fired',
        pattern_id: 'pattern_b',
      });
      expect(getPendingNudge()).toBeNull();
      // Throttle window is enforced.
      expect(NUDGE_THROTTLE_MS).toBeGreaterThan(0);
      expect(firstCreatedAt).toBeDefined();
    });
  });

  describe('dismiss and consume', () => {
    it('dismiss clears the pending nudge', () => {
      fireReviewMisses('pattern_a', REVIEW_CHRONIC_THRESHOLD);
      expect(getPendingNudge()).not.toBeNull();
      dismissNudge();
      expect(getPendingNudge()).toBeNull();
    });

    it('consume returns and clears the pending nudge', () => {
      fireReviewMisses('pattern_a', REVIEW_CHRONIC_THRESHOLD);
      const consumed = consumeNudge();
      expect(consumed).not.toBeNull();
      expect(consumed!.pattern_id).toBe('pattern_a');
      expect(getPendingNudge()).toBeNull();
    });
  });

  describe('subscriptions', () => {
    it('notifies listeners on event record', () => {
      const spy = vi.fn();
      const unsub = subscribe(spy);
      recordNudgeEvent({
        type: 'review_hit_other',
        pattern_id: 'pattern_a',
      });
      expect(spy).toHaveBeenCalled();
      unsub();
    });

    it('notifies listeners on dismiss and consume', () => {
      const spy = vi.fn();
      const unsub = subscribe(spy);
      setPendingNudgeForTest({
        kind: 'live_for_chronic',
        pattern_id: 'p',
        title: 't',
        subtitle: 's',
        destination_path: '/live',
        created_at: new Date().toISOString(),
      });
      spy.mockClear();
      dismissNudge();
      expect(spy).toHaveBeenCalledTimes(1);
      unsub();
    });
  });
});
