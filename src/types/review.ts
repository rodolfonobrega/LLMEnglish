export interface ReviewSession {
  cardId: string;
  date: string;
  score: number;
  userTranscription: string;
}

export interface ReviewStats {
  totalReviews: number;
  correctCount: number; // score >= 7
  averageScore: number;
}

export function computeReviewStats(reviews: { score: number }[]): ReviewStats {
  if (reviews.length === 0) {
    return { totalReviews: 0, correctCount: 0, averageScore: 0 };
  }
  const totalReviews = reviews.length;
  const correctCount = reviews.filter(r => r.score >= 7).length;
  const averageScore = reviews.reduce((sum, r) => sum + r.score, 0) / totalReviews;
  return { totalReviews, correctCount, averageScore: Math.round(averageScore * 10) / 10 };
}
