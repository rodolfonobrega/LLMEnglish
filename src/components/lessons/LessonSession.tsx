import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveSession } from '../../services/geminiLive';
import { chatCompletion } from '../../services/openai';
import { getLessonSummaryPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LessonTopic, LessonSummary } from '../../types/lesson';
import type { ConversationTurn } from '../../types/scenario';
import { LogOut, BookOpen, MessageCircle, ChevronDown, ChevronUp, Clock, GraduationCap } from 'lucide-react';
import { Button } from '../ui/Button';
import { MicrophoneButton } from '../ui/custom/MicrophoneButton';
import { Card } from '../ui/card';
import { cn } from '../../utils/cn';

interface LessonSessionProps {
  topic: LessonTopic;
  systemPrompt: string;
  onEnd: (turns: ConversationTurn[], summary: LessonSummary | null) => void;
  onExit: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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

export function LessonSession({ topic, systemPrompt, onEnd, onExit }: LessonSessionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Scroll chat
  useEffect(() => {
    if (showHistory) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText, showHistory]);

  // Connect session
  useEffect(() => {
    const session = new GeminiLiveSession({
      onAudioResponse: () => {},
      onTextResponse: (text) => setCurrentAiText(prev => prev + text),
      onTurnComplete: () => {
        setCurrentAiText(prev => {
          if (prev.trim()) {
            const newTurn: ConversationTurn = { role: 'ai', text: prev.trim(), timestamp: Date.now() };
            setTurns(t => [...t, newTurn]);
          }
          return '';
        });
      },
      onUserTranscription: (text) => {
        if (text.trim()) {
          const newTurn: ConversationTurn = { role: 'user', text: text.trim(), timestamp: Date.now() };
          setTurns(t => [...t, newTurn]);
        }
      },
      onError: setError,
      onConnectionChange: setIsConnected,
    });

    sessionRef.current = session;
    session.connect(systemPrompt);
    return () => session.disconnect();
  }, [systemPrompt]);

  const toggleMic = useCallback(async () => {
    if (!sessionRef.current) return;
    if (isMicActive) {
      sessionRef.current.stopMicrophone();
      setIsMicActive(false);
    } else {
      await sessionRef.current.startMicrophone();
      setIsMicActive(true);
    }
  }, [isMicActive]);

  const handleEndLesson = async () => {
    sessionRef.current?.disconnect();
    setIsAnalyzing(true);

    const currentTurns = turnsRef.current;
    let summary: LessonSummary | null = null;

    if (currentTurns.length >= 2) {
      try {
        const topicLabel = getTopicLabel(topic);
        const prompt = getLessonSummaryPrompt(
          currentTurns.map(t => ({ role: t.role, text: t.text })),
          topicLabel
        );
        const response = await chatCompletion(
          'You are an expert English language teacher creating a lesson summary. Respond only with valid JSON.',
          prompt
        );
        const clean = cleanJson(response);
        summary = JSON.parse(clean);
      } catch {
        // If summary fails, proceed without it
      }
    }

    setIsAnalyzing(false);
    onEnd(currentTurns, summary);
  };

  const handleExitWithoutSummary = () => {
    sessionRef.current?.disconnect();
    onExit();
  };

  const latestAiMessage = currentAiText.trim()
    || [...turns].reverse().find(t => t.role === 'ai')?.text
    || '';

  const topicLabel = getTopicLabel(topic);

  return (
    <div className="space-y-5 -mx-4 sm:mx-0">
      {/* Top bar: topic + timer + connection */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap size={16} className="text-indigo-500" />
          <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
            {topicLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span className="font-mono">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
            isConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          )}>
            <div className={cn('size-1.5 rounded-full', isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse')} />
            {isConnected ? 'Live' : 'Connecting'}
          </div>
        </div>
      </div>

      {/* Teacher hero area */}
      <div className="relative overflow-hidden rounded-[20px] sm:rounded-2xl shadow-lg border border-border/50">
        <div className="w-full h-56 sm:h-64 bg-gradient-to-br from-indigo-100 via-purple-50 to-violet-100 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-violet-950/40 flex items-center justify-center">
          <div className="text-center">
            <div className="size-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl ring-4 ring-white/50">
              <GraduationCap size={36} className="text-white" />
            </div>
            <p className="text-sm font-bold text-indigo-900/70 dark:text-indigo-200/70">Your Teacher</p>
          </div>
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

        {/* Teacher speech bubble */}
        {latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-indigo-100 border-2 border-white shadow-md flex items-center justify-center">
                <GraduationCap size={18} className="text-indigo-600" />
              </div>
              <div className="bg-white/95 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-md max-w-[85%] border border-white/50">
                <p className="text-[11px] text-indigo-500 mb-0.5 font-semibold">Teacher</p>
                <p className="text-sm text-foreground leading-relaxed text-pretty">
                  {currentAiText.trim() || latestAiMessage}
                  {currentAiText.trim() && <span className="animate-pulse ml-0.5 text-indigo-500">|</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty / waiting state */}
        {!latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-indigo-100 border-2 border-white shadow-md flex items-center justify-center">
                <GraduationCap size={18} className="text-indigo-600" />
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-md border border-white/50">
                <p className="text-sm text-muted-foreground italic">Setting up your lesson...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mic area */}
      <Card className="p-8 mx-4 sm:mx-0 shadow-sm border-indigo-100 dark:border-indigo-900/30">
        <div className="flex flex-col items-center gap-6">
          <MicrophoneButton
            onClick={toggleMic}
            isRecording={isMicActive}
            disabled={!isConnected}
            size="lg"
          />
          <p className={cn(
            'text-sm font-semibold transition-colors',
            isMicActive ? 'text-indigo-600' : 'text-muted-foreground'
          )}>
            {!isConnected ? 'Connecting...' : isMicActive ? 'Listening...' : 'Tap to Speak'}
          </p>
        </div>
      </Card>

      {/* Chat history (collapsible) */}
      {turns.length > 0 && (
        <div className="mx-4 sm:mx-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2"
          >
            <MessageCircle size={14} />
            <span>Lesson Transcript ({turns.length} messages)</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHistory && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-4 mt-2 max-h-64 overflow-y-auto space-y-3 shadow-inner border border-indigo-100 dark:border-indigo-900/30">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                      turn.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-card text-foreground shadow-sm border border-indigo-100 dark:border-indigo-900/30',
                    )}
                  >
                    <p className={cn(
                      'text-[10px] mb-0.5 font-semibold capitalize opacity-80',
                      turn.role === 'user' ? 'text-indigo-200' : 'text-indigo-500'
                    )}>
                      {turn.role === 'user' ? 'You' : 'Teacher'}
                    </p>
                    <p className="leading-relaxed text-pretty">{turn.text}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-center gap-3 px-4 sm:px-0">
        <Button
          variant="ghost"
          size="lg"
          onClick={handleExitWithoutSummary}
          aria-label="Exit lesson"
          className="flex-1"
        >
          <LogOut size={18} />
          Exit
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={handleEndLesson}
          disabled={turns.length === 0 || isAnalyzing}
          aria-label="End lesson and review"
          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
        >
          {isAnalyzing ? (
            <>
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BookOpen size={18} />
              End & Review
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="mx-4 sm:mx-0 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
