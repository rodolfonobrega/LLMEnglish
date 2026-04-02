import type { Badge, GamificationState, SessionReport } from '../types/gamification';
import { BADGES, XP_PER_LEVEL } from '../types/gamification';
import {
  getCards,
  getGamification,
  saveGamification,
  saveSessionReport,
} from './storage'
import { setRuntimeGamification } from './runtimeState'

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isYesterday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

function emitGamificationUpdate(state: GamificationState): void {
  setRuntimeGamification(state)
  window.dispatchEvent(new Event('gamification-update'))
}

export async function syncGamificationState(): Promise<GamificationState> {
  const state = await getGamification()
  const cards = await getCards()
  state.totalCards = cards.length
  checkAndAwardBadges(state)
  await saveGamification(state)
  emitGamificationUpdate(state)
  return state
}

export async function addXP(amount: number): Promise<GamificationState> {
  const state = await getGamification()
  state.xp += amount;
  state.level = Math.floor(state.xp / XP_PER_LEVEL) + 1;

  // Update streak
  if (!isToday(state.lastPracticeDate)) {
    if (isYesterday(state.lastPracticeDate)) {
      state.streak += 1;
    } else {
      state.streak = 1;
    }
    state.lastPracticeDate = new Date().toISOString();
  }
  if (state.streak > state.longestStreak) {
    state.longestStreak = state.streak;
  }

  state.totalSessions += 1;
  state.totalCards = (await getCards()).length;

  // Check badges
  checkAndAwardBadges(state);

  await saveGamification(state)
  emitGamificationUpdate(state)
  return state
}

function checkAndAwardBadges(state: GamificationState): void {
  const earned = new Set(state.badges.map(b => b.id));
  const award = (badgeId: string) => {
    if (earned.has(badgeId)) return;
    const badge = BADGES.find(b => b.id === badgeId);
    if (badge) {
      state.badges.push({ ...badge, earnedAt: new Date().toISOString() } as Badge);
    }
  };

  if (state.totalSessions >= 1) award('first_card');
  if (state.streak >= 3) award('streak_3');
  if (state.streak >= 7) award('streak_7');
  if (state.streak >= 30) award('streak_30');
  if (state.totalCards >= 25) award('cards_25');
  if (state.totalCards >= 100) award('cards_100');
  if (state.level >= 5) award('level_5');
  if (state.level >= 10) award('level_10');
}

export async function createSessionReport(
  type: SessionReport['type'],
  scores: number[],
  errorsFound: number,
  xpEarned: number,
  timeSpentSeconds: number,
  improvements?: string[]
): Promise<SessionReport> {
  const averageScore =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const report: SessionReport = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    type,
    exercisesCompleted: scores.length,
    scores,
    averageScore,
    errorsFound,
    xpEarned,
    timeSpentSeconds,
    improvements: improvements ?? [],
  };
  await saveSessionReport(report)
  return report;
}
