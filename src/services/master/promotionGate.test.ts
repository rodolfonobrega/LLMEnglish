import { describe, it, expect } from 'vitest';
import { canPromote } from './promotionGate';
import { emptyPatternEvidence, type AcquiringPattern } from '../../types/learnerModel';

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function masteryReadyPattern(): AcquiringPattern {
  const firstSuccess = iso(10);
  const firstLive = iso(8);
  const lastLive = iso(2);
  const reExposureAt = iso(5); // > 48h after first_success_at (10 days ago)
  const evidence = emptyPatternEvidence();
  evidence.sessions_touched = ['s1', 's2', 's3'];
  evidence.themes_seen = ['cooking', 'travel'];
  evidence.modalities_seen = ['phrase', 'live'];
  evidence.live_turns_correct = 3;
  evidence.live_turns_incorrect = 0;
  evidence.live_sessions_touched = ['live1', 'live2'];
  evidence.live_themes_seen = ['cooking', 'travel'];
  evidence.first_live_success_at = firstLive;
  evidence.last_live_success_at = lastLive;
  evidence.consecutive_correct = 5;
  evidence.longest_streak = 6;
  evidence.first_success_at = firstSuccess;
  evidence.last_failure_at = null;
  evidence.re_exposure_checks = [
    { at: reExposureAt, passed: true, context: 'different theme: work', was_live: true },
  ];
  return {
    id: 'past_continuous',
    success_rate: 0.9,
    attempts: 12,
    last_seen: iso(1),
    evidence,
    trajectory: 'stable',
  };
}

describe('canPromote (Phase 7 promotion gate)', () => {
  it('promotes a pattern that satisfies all 7 rules', () => {
    const result = canPromote(masteryReadyPattern());
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('rejects the OLD bar (success_rate >= 0.8 && attempts >= 5) with the new rules', () => {
    const p = masteryReadyPattern();
    // Old bar: 5 attempts at 0.8 success. Wipe the new fields.
    p.attempts = 5;
    p.evidence = emptyPatternEvidence();
    p.trajectory = 'noisy';
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('rejects a lucky streak in one drill session', () => {
    const p = masteryReadyPattern();
    p.evidence!.sessions_touched = ['s1']; // only 1 session
    p.evidence!.live_sessions_touched = ['live1'];
    p.evidence!.live_themes_seen = ['cooking'];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule2_sessions');
  });

  it('rejects 10 perfect drills + 1 perfect long Live', () => {
    const p = masteryReadyPattern();
    p.evidence!.live_sessions_touched = ['live1']; // only 1 Live session
    p.evidence!.live_themes_seen = ['cooking'];
    p.evidence!.first_live_success_at = iso(2);
    p.evidence!.last_live_success_at = iso(2);
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule6_live_confirmed');
  });

  it('rejects 2 perfect Lives in the same theme', () => {
    const p = masteryReadyPattern();
    p.evidence!.live_sessions_touched = ['live1', 'live2'];
    p.evidence!.live_themes_seen = ['cooking']; // only 1 theme!
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule6_live_confirmed');
  });

  it('rejects 2 Live sessions less than 72h apart', () => {
    const p = masteryReadyPattern();
    p.evidence!.first_live_success_at = iso(1);
    p.evidence!.last_live_success_at = iso(0.5); // ~12h apart
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule6_live_confirmed');
  });

  it('rejects when trajectory is regressing', () => {
    const p = masteryReadyPattern();
    p.trajectory = 'regressing';
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule5_trajectory');
  });

  it('rejects when no passing re_exposure_check exists', () => {
    const p = masteryReadyPattern();
    p.evidence!.re_exposure_checks = [];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule7_re_exposure');
  });

  it('rejects when re_exposure_check is too soon after first_success_at', () => {
    const p = masteryReadyPattern();
    p.evidence!.first_success_at = iso(1);
    p.evidence!.re_exposure_checks = [
      { at: iso(0.5), passed: true, context: 'drill', was_live: true }, // 12h after first
    ];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule7_re_exposure');
  });

  it('rejects when passing re_exposure_check is not Live', () => {
    const p = masteryReadyPattern();
    p.evidence!.re_exposure_checks = [
      { at: iso(5), passed: true, context: 'drill', was_live: false },
    ];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule7_re_exposure');
  });

  it('rejects when themes_seen has only 1 theme', () => {
    const p = masteryReadyPattern();
    p.evidence!.themes_seen = ['cooking'];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule3_themes');
  });

  it('rejects when modalities_seen has only 1 modality', () => {
    const p = masteryReadyPattern();
    p.evidence!.modalities_seen = ['phrase'];
    const result = canPromote(p);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('rule4_modalities');
  });
});
