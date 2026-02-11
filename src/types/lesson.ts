export interface LessonTopic {
  category: string;       // e.g., 'grammar', 'vocabulary'
  subtopic?: string;      // e.g., 'verb-tenses', 'travel-words'
  customRequest?: string; // free-text from user
}

export interface LessonVocabularyItem {
  word: string;
  definition: string;
  example: string;
}

export interface LessonSummary {
  vocabularyLearned: LessonVocabularyItem[];
  grammarPoints: string[];
  pronunciationTips: string[];
  practiceRecommendations: string[];
  overallFeedback: string;
}
