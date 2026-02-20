import type { User, Path, Scenario, Lesson } from '@/types';

export const currentUser: User = {
  id: '1',
  name: 'Lucca',
  level: 5,
  xp: 448,
  maxXp: 500,
  streak: 23,
  avatar: '/images/avatar-user.png',
};

export const travelLessons: Lesson[] = [
  {
    id: 'travel-basics',
    title: 'Travel Basics',
    description: 'Learn essential travel vocabulary',
    xp: 60,
    maxXp: 60,
    progress: 100,
    totalSteps: 12,
    completedSteps: 12,
    image: 'travel-basics',
    locked: false,
    category: 'travel',
  },
  {
    id: 'hotel-checkin',
    title: 'Hotel Check-in',
    description: 'Check into your hotel smoothly',
    xp: 70,
    maxXp: 70,
    progress: 0,
    totalSteps: 12,
    completedSteps: 5,
    image: 'hotel-checkin',
    locked: false,
    category: 'travel',
  },
  {
    id: 'navigating-nyc',
    title: 'Navigating NYC',
    description: 'Get around the city like a local',
    xp: 80,
    maxXp: 80,
    progress: 0,
    totalSteps: 15,
    completedSteps: 0,
    image: 'navigating-nyc',
    locked: true,
    category: 'travel',
  },
  {
    id: 'lost-luggage',
    title: 'Lost Luggage',
    description: 'Handle luggage issues at the airport',
    xp: 75,
    maxXp: 75,
    progress: 0,
    totalSteps: 14,
    completedSteps: 0,
    image: 'lost-luggage',
    locked: true,
    category: 'travel',
  },
];

export const workLessons: Lesson[] = [
  {
    id: 'meeting-client',
    title: 'Meeting with Client',
    description: 'Professional client interactions',
    xp: 70,
    maxXp: 70,
    progress: 0,
    totalSteps: 10,
    completedSteps: 0,
    image: 'meeting-client',
    locked: false,
    category: 'work',
  },
  {
    id: 'presentation',
    title: 'Giving a Presentation',
    description: 'Present your ideas confidently',
    xp: 85,
    maxXp: 85,
    progress: 0,
    totalSteps: 16,
    completedSteps: 0,
    image: 'presentation',
    locked: true,
    category: 'work',
  },
];

export const paths: Path[] = [
  {
    id: 'travel-path',
    title: 'Travel Path',
    description: 'Master English for traveling',
    category: 'travel',
    nextLesson: 'At the Airport',
    xpRange: '80-120',
    image: 'travel',
    progress: 42,
    lessons: travelLessons,
  },
  {
    id: 'work-path',
    title: 'Work Path',
    description: 'Professional English skills',
    category: 'work',
    nextLesson: 'Meeting with Client',
    xpRange: '70-100',
    image: 'work',
    progress: 15,
    lessons: workLessons,
  },
];

export const currentScenario: Scenario = {
  id: 'hotel-reception',
  title: 'Hotel Check-in',
  description: 'Check into your hotel',
  character: {
    name: 'Sarah',
    avatar: 'receptionist',
    role: 'Hotel Receptionist',
  },
  dialogue: "Good evening! Welcome to the Grand Hotel. How can I help you today?",
  backgroundImage: 'hotel-lobby',
  suggestedWords: ['gonna', 'check-in', 'refund', 'awkward'],
  hints: [
    'Begin with a greeting',
    'Use the phrase "check-in"',
    'Speak clearly',
  ],
  xpBonus: 5,
};

export const suggestedWords = [
  { word: 'gate', translation: 'portão' },
  { word: 'boarding pass', translation: 'cartão de embarque' },
  { word: 'luggage search', translation: 'busca de bagagem' },
];

export const feedbackItems = [
  { id: '1', type: 'success' as const, message: 'Great start! Keep it up!', xpBonus: 5 },
  { id: '2', type: 'success' as const, message: 'Speak clearly', xpBonus: 0 },
  { id: '3', type: 'success' as const, message: 'Use the phrase "check-in"', xpBonus: 0 },
  { id: '4', type: 'success' as const, message: 'Begin with a greeting', xpBonus: 0 },
];
