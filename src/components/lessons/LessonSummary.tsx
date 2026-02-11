import { useState } from 'react';
import { BookOpen, Check, GraduationCap, Lightbulb, Mic, RotateCcw, Target, Volume2, Plus } from 'lucide-react';
import { addCard } from '../../services/storage';
import { addXP } from '../../services/gamification';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../utils/cn';
import type { LessonTopic, LessonSummary as LessonSummaryType } from '../../types/lesson';
import type { ConversationTurn } from '../../types/scenario';
import type { Card as FlashCard } from '../../types/card';

interface LessonSummaryProps {
  topic: LessonTopic;
  turns: ConversationTurn[];
  summary: LessonSummaryType | null;
  onReset: () => void;
}

function getTopicLabel(topic: LessonTopic): string {
  if (topic.customRequest) return topic.customRequest;
  const label = topic.category.charAt(0).toUpperCase() + topic.category.slice(1).replace(/-/g, ' ');
  if (topic.subtopic) {
    const sub = topic.subtopic.charAt(0).toUpperCase() + topic.subtopic.slice(1).replace(/-/g, ' ');
    return `${label} — ${sub}`;
  }
  return label;
}

export function LessonSummary({ topic, turns, summary, onReset }: LessonSummaryProps) {
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const [xpAwarded, setXpAwarded] = useState(false);

  const topicLabel = getTopicLabel(topic);

  // Award XP for completing a lesson
  if (!xpAwarded && turns.length >= 2) {
    const xpAmount = Math.min(turns.length * 5, 100);
    addXP(xpAmount);
    setXpAwarded(true);
  }

  const handleSaveVocab = (index: number) => {
    if (!summary || savedItems.has(index)) return;

    const item = summary.vocabularyLearned[index];
    const card: FlashCard = {
      id: crypto.randomUUID(),
      type: 'phrase',
      prompt: `What does "${item.word}" mean? Use it in a sentence.`,
      expectedContext: `${item.definition}. Example: ${item.example}`,
      targetVocabulary: [item.word],
      context: topicLabel,
      theme: topic.category,
      createdAt: new Date().toISOString(),
      nextReviewAt: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      reviews: [],
    };

    addCard(card);
    setSavedItems(prev => new Set(prev).add(index));
  };

  const handleSaveAll = () => {
    if (!summary) return;
    summary.vocabularyLearned.forEach((_, i) => {
      if (!savedItems.has(i)) {
        handleSaveVocab(i);
      }
    });
  };

  if (!summary) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4 py-12">
          <div className="size-20 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <GraduationCap size={36} className="text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Lesson Complete!</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {turns.length < 2
              ? 'The lesson was too short to generate a summary. Try having a longer conversation next time!'
              : 'Could not generate a summary for this lesson, but great job practicing!'}
          </p>
          <Button size="lg" onClick={onReset} className="mt-4">
            <RotateCcw size={18} />
            New Lesson
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="size-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <GraduationCap size={28} className="text-white" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Lesson Summary</h2>
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">{topicLabel}</span>
          {' '}&middot;{' '}
          {turns.length} exchanges
        </p>
      </div>

      {/* Overall Feedback */}
      <Card className="border-indigo-100 dark:border-indigo-900/30 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Target size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                Overall Feedback
              </h3>
              <p className="text-foreground text-sm leading-relaxed text-pretty">
                {summary.overallFeedback}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vocabulary Learned */}
      {summary.vocabularyLearned.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lightbulb size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Vocabulary Learned
              </h3>
            </div>
            {summary.vocabularyLearned.length > 1 && (
              <button
                onClick={handleSaveAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-semibold cursor-pointer"
              >
                <Plus size={12} />
                Save All to Review
              </button>
            )}
          </div>

          <div className="grid gap-3">
            {summary.vocabularyLearned.map((item, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{item.word}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.definition}</p>
                      <p className="text-sm text-foreground/80 mt-1.5 italic">"{item.example}"</p>
                    </div>
                    <button
                      onClick={() => handleSaveVocab(i)}
                      disabled={savedItems.has(i)}
                      className={cn(
                        'flex-shrink-0 size-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer',
                        savedItems.has(i)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                          : 'bg-muted hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-muted-foreground hover:text-indigo-600'
                      )}
                      aria-label={savedItems.has(i) ? 'Saved' : 'Save to review deck'}
                    >
                      {savedItems.has(i) ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Grammar Points */}
      {summary.grammarPoints.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <BookOpen size={14} className="text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
              Grammar Points
            </h3>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <ul className="space-y-2.5">
                {summary.grammarPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="size-5 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{i + 1}</span>
                    </div>
                    <p className="text-foreground leading-relaxed">{point}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Pronunciation Tips */}
      {summary.pronunciationTips.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <Volume2 size={14} className="text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
              Pronunciation Tips
            </h3>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <ul className="space-y-2.5">
                {summary.pronunciationTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Mic size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-foreground leading-relaxed">{tip}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Practice Recommendations */}
      {summary.practiceRecommendations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Target size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              What to Practice Next
            </h3>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <ul className="space-y-2.5">
                {summary.practiceRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <div className="size-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />
                    <p className="text-foreground leading-relaxed">{rec}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          onClick={onReset}
          className="flex-1 text-lg font-bold py-5 rounded-xl bg-indigo-600 hover:bg-indigo-700"
        >
          <RotateCcw size={18} />
          New Lesson
        </Button>
      </div>
    </div>
  );
}
