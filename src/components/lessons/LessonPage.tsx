import { useState } from 'react';
import { LessonSetup } from './LessonSetup';
import { LessonSession } from './LessonSession';
import { LessonSummary } from './LessonSummary';
import type { LessonTopic, LessonSummary as LessonSummaryType } from '../../types/lesson';
import type { ConversationTurn } from '../../types/scenario';

type LessonPhase = 'setup' | 'lesson' | 'summary';

export function LessonPage() {
  const [phase, setPhase] = useState<LessonPhase>('setup');
  const [topic, setTopic] = useState<LessonTopic | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [summary, setSummary] = useState<LessonSummaryType | null>(null);

  const handleLessonReady = (t: LessonTopic, prompt: string) => {
    setTopic(t);
    setSystemPrompt(prompt);
    setPhase('lesson');
  };

  const handleLessonEnd = (conversationTurns: ConversationTurn[], lessonSummary: LessonSummaryType | null) => {
    setTurns(conversationTurns);
    setSummary(lessonSummary);
    setPhase('summary');
  };

  const handleExit = () => {
    setPhase('setup');
    setTopic(null);
    setSystemPrompt('');
    setTurns([]);
    setSummary(null);
  };

  return (
    <div className="space-y-6">
      {phase === 'setup' && (
        <LessonSetup onLessonReady={handleLessonReady} />
      )}
      {phase === 'lesson' && topic && (
        <LessonSession
          topic={topic}
          systemPrompt={systemPrompt}
          onEnd={handleLessonEnd}
          onExit={handleExit}
        />
      )}
      {phase === 'summary' && topic && (
        <LessonSummary
          topic={topic}
          turns={turns}
          summary={summary}
          onReset={handleExit}
        />
      )}
    </div>
  );
}
