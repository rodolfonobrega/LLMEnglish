import { describe, it, expect } from 'vitest';
import {
  computeLiveSessionPoint,
  mergeIntoProfile,
  computeTrajectory,
  emptyProfile,
  DEFAULT_WINDOW_SIZE,
} from './liveFluencyAggregator';
import type { ConversationTurn } from '../../types/scenario';
import type { LiveSessionPoint } from '../../types/learnerModel';

function turn(role: 'user' | 'ai', text: string, ts: number): ConversationTurn {
  return { role, text, timestamp: ts };
}

describe('computeLiveSessionPoint', () => {
  it('counts user turns only and averages non-empty lengths', () => {
    const point = computeLiveSessionPoint({
      sessionId: 'sess-1',
      turns: [
        turn('ai', 'Hello, how are you?', 1_000),
        turn('user', 'I am fine thanks', 2_000),
        turn('ai', 'Great! What did you do today?', 3_000),
        turn('user', 'I went to the park with my dog', 6_000),
        turn('ai', 'That sounds fun.', 7_000),
      ],
      theme: 'SOCIAL',
      endedAt: '2026-04-21T00:00:00.000Z',
    });

    expect(point.turns_count).toBe(2);
    expect(point.theme).toBe('social');
    expect(point.size).toBe('standard');
    expect(point.avg_turn_length_words).toBeCloseTo((4 + 8) / 2, 1);
    expect(point.avg_response_latency_ms).toBe(Math.round((1000 + 3000) / 2));
    expect(point.abandoned_turn_count).toBe(0);
  });

  it('flags empty and tiny turns as abandoned', () => {
    const point = computeLiveSessionPoint({
      sessionId: 'sess-2',
      turns: [
        turn('ai', 'Hi.', 100),
        turn('user', '', 200),
        turn('ai', 'Something?', 300),
        turn('user', 'uh', 500),
        turn('ai', 'Go on.', 600),
        turn('user', 'I really wanted to try the new restaurant.', 800),
      ],
      theme: 'food',
    });

    expect(point.turns_count).toBe(3);
    expect(point.abandoned_turn_count).toBe(2);
  });

  it('skips latency for orphan user turns with no preceding AI turn', () => {
    const point = computeLiveSessionPoint({
      sessionId: 'sess-3',
      turns: [
        turn('user', 'I start the conversation.', 1000),
        turn('ai', 'Oh, hello.', 1500),
        turn('user', 'How are you today?', 3000),
      ],
      theme: 'social',
    });
    expect(point.avg_response_latency_ms).toBe(1500);
  });
});

describe('mergeIntoProfile', () => {
  it('grows the window to the cap and preserves recency', () => {
    let profile = emptyProfile();
    for (let i = 0; i < DEFAULT_WINDOW_SIZE + 3; i++) {
      const p: LiveSessionPoint = {
        session_id: `s-${i}`,
        at: new Date(2026, 3, 1, 0, 0, i).toISOString(),
        theme: i % 2 === 0 ? 'workplace' : 'social',
        size: 'standard',
        turns_count: 4,
        avg_turn_length_words: 6,
        avg_response_latency_ms: 1000,
        abandoned_turn_count: 0,
      };
      profile = mergeIntoProfile(profile, p);
    }

    expect(profile.session_points.length).toBe(DEFAULT_WINDOW_SIZE);
    expect(profile.sessions_considered[0]).toBe(`s-${3}`);
    expect(profile.sessions_considered[DEFAULT_WINDOW_SIZE - 1]).toBe(
      `s-${DEFAULT_WINDOW_SIZE + 2}`,
    );
    expect(profile.distinct_themes_in_window).toBe(2);
  });

  it('dedupes by session_id: re-emitting same session replaces the old point', () => {
    const first: LiveSessionPoint = {
      session_id: 'dup',
      at: '2026-04-21T00:00:00.000Z',
      theme: 'workplace',
      size: 'standard',
      turns_count: 5,
      avg_turn_length_words: 7,
      avg_response_latency_ms: 900,
      abandoned_turn_count: 0,
    };
    const second: LiveSessionPoint = {
      ...first,
      at: '2026-04-21T00:10:00.000Z',
      avg_turn_length_words: 10,
    };

    let profile = mergeIntoProfile(undefined, first);
    profile = mergeIntoProfile(profile, second);

    expect(profile.session_points.length).toBe(1);
    expect(profile.session_points[0]?.avg_turn_length_words).toBe(10);
    expect(profile.avg_turn_length_words).toBe(10);
  });

  it('computes abandoned_turn_rate as global ratio', () => {
    const a: LiveSessionPoint = {
      session_id: 'a',
      at: '2026-04-21T00:00:00.000Z',
      theme: 'social',
      size: 'standard',
      turns_count: 10,
      avg_turn_length_words: 5,
      avg_response_latency_ms: 0,
      abandoned_turn_count: 2,
    };
    const b: LiveSessionPoint = {
      session_id: 'b',
      at: '2026-04-21T01:00:00.000Z',
      theme: 'travel',
      size: 'mini',
      turns_count: 4,
      avg_turn_length_words: 6,
      avg_response_latency_ms: 0,
      abandoned_turn_count: 1,
    };

    let profile = mergeIntoProfile(undefined, a);
    profile = mergeIntoProfile(profile, b);

    expect(profile.abandoned_turn_rate).toBeCloseTo(3 / 14, 3);
    expect(profile.distinct_themes_in_window).toBe(2);
  });
});

describe('computeTrajectory', () => {
  it('returns noisy with fewer than 3 points', () => {
    expect(computeTrajectory([])).toBe('noisy');
  });

  it('detects clear improvement', () => {
    const points: LiveSessionPoint[] = [0, 0, 0, 1, 1, 1].map((_, i) => ({
      session_id: `s${i}`,
      at: new Date(2026, 3, 1, 0, 0, i).toISOString(),
      theme: 'x',
      size: 'standard',
      turns_count: 4,
      avg_turn_length_words: i < 3 ? 3 : 8,
      avg_response_latency_ms: 1000,
      abandoned_turn_count: 0,
    }));
    expect(computeTrajectory(points)).toBe('improving');
  });

  it('detects clear regression', () => {
    const points: LiveSessionPoint[] = [0, 0, 0, 1, 1, 1].map((_, i) => ({
      session_id: `s${i}`,
      at: new Date(2026, 3, 1, 0, 0, i).toISOString(),
      theme: 'x',
      size: 'standard',
      turns_count: 4,
      avg_turn_length_words: i < 3 ? 10 : 3,
      avg_response_latency_ms: 1000,
      abandoned_turn_count: 0,
    }));
    expect(computeTrajectory(points)).toBe('regressing');
  });

  it('labels highly-variant data noisy', () => {
    const lengths = [2, 12, 3, 14, 2, 13];
    const points: LiveSessionPoint[] = lengths.map((L, i) => ({
      session_id: `s${i}`,
      at: new Date(2026, 3, 1, 0, 0, i).toISOString(),
      theme: 'x',
      size: 'standard',
      turns_count: 4,
      avg_turn_length_words: L,
      avg_response_latency_ms: 1000,
      abandoned_turn_count: 0,
    }));
    expect(computeTrajectory(points)).toBe('noisy');
  });
});
