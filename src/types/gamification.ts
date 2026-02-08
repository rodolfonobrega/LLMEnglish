export interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  totalSessions: number;
  totalCards: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export const XP_PER_EXERCISE = 10;
export const XP_PER_PERFECT_SCORE = 25;
export const XP_PER_REVIEW = 5;
export const XP_PER_LIVE_SESSION = 30;
export const XP_PER_LEVEL = 100;

export const BADGES = [
  { id: 'first_card', name: 'First Steps', description: 'Complete your first exercise', icon: '🎯' },
  { id: 'streak_3', name: 'On Fire', description: '3-day streak', icon: '🔥' },
  { id: 'streak_7', name: 'Unstoppable', description: '7-day streak', icon: '⚡' },
  { id: 'streak_30', name: 'Legendary', description: '30-day streak', icon: '👑' },
  { id: 'perfect_10', name: 'Perfectionist', description: '10 perfect scores', icon: '💎' },
  { id: 'cards_25', name: 'Collector', description: 'Save 25 cards', icon: '📚' },
  { id: 'cards_100', name: 'Scholar', description: 'Save 100 cards', icon: '🎓' },
  { id: 'live_5', name: 'Social Butterfly', description: 'Complete 5 live sessions', icon: '🦋' },
  { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐' },
  { id: 'level_10', name: 'Expert', description: 'Reach level 10', icon: '🏆' },
];
