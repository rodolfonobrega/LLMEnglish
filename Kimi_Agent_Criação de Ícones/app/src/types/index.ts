export type User = {
  id: string;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  streak: number;
  avatar: string;
}

export type Lesson = {
  id: string;
  title: string;
  description: string;
  xp: number;
  maxXp: number;
  progress: number;
  totalSteps: number;
  completedSteps: number;
  image: string;
  locked: boolean;
  category: string;
}

export type Path = {
  id: string;
  title: string;
  description: string;
  category: string;
  nextLesson: string;
  xpRange: string;
  image: string;
  progress: number;
  lessons: Lesson[];
}

export type Scenario = {
  id: string;
  title: string;
  description: string;
  character: {
    name: string;
    avatar: string;
    role: string;
  };
  dialogue: string;
  backgroundImage: string;
  suggestedWords: string[];
  hints: string[];
  xpBonus: number;
}

export type FeedbackItem = {
  id: string;
  type: 'success' | 'tip' | 'warning';
  message: string;
  xpBonus?: number;
}

export type NavigationTab = 'home' | 'discover' | 'practice' | 'review' | 'progress' | 'profile';
