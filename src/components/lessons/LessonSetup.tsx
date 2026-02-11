import { useState } from 'react';
import { Book, Lightbulb, Mic, MessageCircle, Briefcase, MessagesSquare, GraduationCap, Pencil, Coffee, Scale, ArrowRight } from 'lucide-react';
import { getLiveLessonSystemPrompt } from '../../utils/prompts';
import { getConversationTone } from '../../services/storage';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../utils/cn';
import type { LessonTopic } from '../../types/lesson';
import type { ConversationTone } from '../../types/settings';

interface LessonSetupProps {
  onLessonReady: (topic: LessonTopic, systemPrompt: string) => void;
}

interface TopicCategory {
  id: string;
  label: string;
  tagline: string;
  icon: typeof Book;
  gradient: string;
  activeClass: string;
  subtopics: { id: string; label: string }[];
}

const TOPICS: TopicCategory[] = [
  {
    id: 'grammar',
    label: 'Grammar',
    tagline: 'Build solid foundations',
    icon: Book,
    gradient: 'from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20',
    activeClass: 'ring-indigo-200 bg-indigo-50',
    subtopics: [
      { id: 'verb-tenses', label: 'Verb Tenses' },
      { id: 'conditionals', label: 'Conditionals' },
      { id: 'relative-clauses', label: 'Relative Clauses' },
      { id: 'articles', label: 'Articles (a/an/the)' },
      { id: 'prepositions', label: 'Prepositions' },
    ],
  },
  {
    id: 'vocabulary',
    label: 'Vocabulary',
    tagline: 'Expand your word bank',
    icon: Lightbulb,
    gradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20',
    activeClass: 'ring-amber-200 bg-amber-50',
    subtopics: [
      { id: 'travel', label: 'Travel' },
      { id: 'food-cooking', label: 'Food & Cooking' },
      { id: 'technology', label: 'Technology' },
      { id: 'emotions', label: 'Emotions & Feelings' },
      { id: 'daily-routines', label: 'Daily Routines' },
    ],
  },
  {
    id: 'pronunciation',
    label: 'Pronunciation',
    tagline: 'Sound like a native',
    icon: Mic,
    gradient: 'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20',
    activeClass: 'ring-rose-200 bg-rose-50',
    subtopics: [
      { id: 'connected-speech', label: 'Connected Speech' },
      { id: 'word-stress', label: 'Word Stress' },
      { id: 'intonation', label: 'Intonation Patterns' },
      { id: 'minimal-pairs', label: 'Minimal Pairs' },
    ],
  },
  {
    id: 'idioms-slang',
    label: 'Idioms & Slang',
    tagline: 'Speak like locals do',
    icon: MessageCircle,
    gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20',
    activeClass: 'ring-emerald-200 bg-emerald-50',
    subtopics: [
      { id: 'common-idioms', label: 'Common Idioms' },
      { id: 'phrasal-verbs', label: 'Phrasal Verbs' },
      { id: 'american-slang', label: 'American Slang' },
      { id: 'british-slang', label: 'British Slang' },
    ],
  },
  {
    id: 'business-english',
    label: 'Business English',
    tagline: 'Nail that meeting',
    icon: Briefcase,
    gradient: 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20',
    activeClass: 'ring-slate-200 bg-slate-50',
    subtopics: [
      { id: 'meetings', label: 'Meetings' },
      { id: 'emails', label: 'Emails & Writing' },
      { id: 'negotiations', label: 'Negotiations' },
      { id: 'presentations', label: 'Presentations' },
    ],
  },
  {
    id: 'conversation',
    label: 'Conversation',
    tagline: 'Keep the chat flowing',
    icon: MessagesSquare,
    gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20',
    activeClass: 'ring-violet-200 bg-violet-50',
    subtopics: [
      { id: 'small-talk', label: 'Small Talk' },
      { id: 'opinions', label: 'Sharing Opinions' },
      { id: 'storytelling', label: 'Storytelling' },
      { id: 'debating', label: 'Friendly Debates' },
    ],
  },
  {
    id: 'exam-prep',
    label: 'Exam Prep',
    tagline: 'Get that score',
    icon: GraduationCap,
    gradient: 'from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/20',
    activeClass: 'ring-sky-200 bg-sky-50',
    subtopics: [
      { id: 'ielts', label: 'IELTS Speaking' },
      { id: 'toefl', label: 'TOEFL Speaking' },
      { id: 'cambridge', label: 'Cambridge Exams' },
    ],
  },
];

const TONE_LABELS: Record<ConversationTone, { label: string; icon: typeof Coffee }> = {
  casual: { label: 'Casual', icon: Coffee },
  balanced: { label: 'Balanced', icon: Scale },
  formal: { label: 'Formal', icon: Briefcase },
};

export function LessonSetup({ onLessonReady }: LessonSetupProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const tone = getConversationTone();

  const selectedTopic = TOPICS.find(t => t.id === selectedCategory);
  const ToneIcon = TONE_LABELS[tone].icon;

  const handleCategorySelect = (categoryId: string) => {
    if (categoryId === selectedCategory) return;
    setSelectedCategory(categoryId);
    setSelectedSubtopic(null);
    setIsCustom(false);
  };

  const handleCustomSelect = () => {
    setSelectedCategory(null);
    setSelectedSubtopic(null);
    setIsCustom(true);
  };

  const canStart = isCustom
    ? customRequest.trim().length > 0
    : selectedCategory !== null;

  const handleStart = () => {
    const topic: LessonTopic = isCustom
      ? { category: 'custom', customRequest: customRequest.trim() }
      : { category: selectedCategory!, subtopic: selectedSubtopic || undefined };

    const systemPrompt = getLiveLessonSystemPrompt(
      topic.category,
      topic.subtopic,
      tone,
      topic.customRequest
    );

    onLessonReady(topic, systemPrompt);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          What do you want to learn?
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Pick a topic and start a real conversation lesson with your AI teacher.
        </p>
      </div>

      {/* Tone indicator */}
      <div className="flex items-center justify-center">
        <a
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <ToneIcon size={14} />
          <span>
            Tone: <span className="font-semibold text-foreground">{TONE_LABELS[tone].label}</span>
          </span>
          <span className="text-xs opacity-60">Change in Settings</span>
        </a>
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {TOPICS.map(t => {
          const Icon = t.icon;
          return (
            <Card
              key={t.id}
              onClick={() => handleCategorySelect(t.id)}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md border-transparent relative',
                'bg-gradient-to-br',
                t.gradient,
                selectedCategory === t.id
                  ? cn('ring-2 ring-primary shadow-md', t.activeClass)
                  : 'hover:bg-opacity-80',
              )}
            >
              <CardContent className="p-4 flex flex-col items-start gap-3 h-full justify-between">
                <div className={cn(
                  'size-10 rounded-xl flex items-center justify-center',
                  selectedCategory === t.id
                    ? 'bg-primary text-white'
                    : 'bg-white/70 dark:bg-white/10 text-foreground'
                )}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-tight">{t.label}</p>
                  <p className="text-muted-foreground/80 text-xs mt-0.5">{t.tagline}</p>
                </div>
                {selectedCategory === t.id && (
                  <div className="absolute top-2 right-2 size-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom topic card */}
      <Card
        onClick={handleCustomSelect}
        className={cn(
          'cursor-pointer transition-all duration-200 border-dashed border-2',
          isCustom
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <CardContent className="p-6 flex items-center gap-4">
          <div className={cn(
            'size-12 rounded-full flex items-center justify-center flex-shrink-0',
            isCustom ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
          )}>
            <Pencil size={20} />
          </div>
          <div>
            <p className="font-bold text-foreground text-base">Ask About Anything</p>
            <p className="text-muted-foreground text-sm">Type any topic you want to learn or practice</p>
          </div>
          {isCustom && (
            <div className="ml-auto size-6 bg-primary rounded-full flex items-center justify-center">
              <svg className="size-3.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subtopic pills */}
      {selectedTopic && selectedTopic.subtopics.length > 0 && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <p className="text-sm font-semibold text-muted-foreground mb-3 ml-1">
            Focus area <span className="text-xs font-normal opacity-70">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTopic.subtopics.map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubtopic(selectedSubtopic === sub.id ? null : sub.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer border',
                  selectedSubtopic === sub.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom input */}
      {isCustom && (
        <Card className="animate-in slide-in-from-top-2 duration-300 border-primary/20 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <label htmlFor="custom-topic" className="block text-sm font-bold text-foreground">
              What do you want to learn?
            </label>
            <textarea
              id="custom-topic"
              value={customRequest}
              onChange={e => setCustomRequest(e.target.value)}
              placeholder={"Try something like:\n\u2022 How to use the present perfect vs simple past\n\u2022 Common phrasal verbs for everyday conversations\n\u2022 How to make small talk at parties\n\u2022 Vocabulary for job interviews"}
              rows={4}
              className={cn(
                'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                'transition-colors text-sm leading-relaxed',
              )}
            />
            <p className="text-xs text-muted-foreground">
              Be as specific or as vague as you want. Your teacher will adapt the lesson to your needs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Start button */}
      <Button
        size="lg"
        onClick={handleStart}
        disabled={!canStart}
        className="w-full text-lg font-bold py-6 rounded-xl transition-colors duration-200"
      >
        Start Lesson
        <ArrowRight size={20} className="ml-1" />
      </Button>
    </div>
  );
}
