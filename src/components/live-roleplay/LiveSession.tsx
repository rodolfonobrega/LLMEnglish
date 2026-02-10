import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveSession } from '../../services/geminiLive';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';
import { LogOut, BarChart3, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { MicrophoneButton } from '../ui/custom/MicrophoneButton';
import { Card } from '../ui/card';
import { cn } from '../../utils/cn';

interface LiveSessionProps {
  scenario: LiveScenario;
  onEnd: (turns: ConversationTurn[]) => void;
  onExit: () => void;
}

const roleEmojis: Record<string, string> = {
  waiter: '👨‍🍳', waitress: '👩‍🍳', receptionist: '👩‍💼',
  barista: '☕', doctor: '👩‍⚕️', nurse: '👩‍⚕️',
  driver: '🚕', cashier: '🛒', seller: '🛒',
  clerk: '📋', agent: '👩‍💼', teacher: '👩‍🏫',
  guide: '🇺🇸', attendant: '👩‍🚀',
};

function getAiEmoji(aiRole: string): string {
  const lower = aiRole.toLowerCase();
  for (const [key, emoji] of Object.entries(roleEmojis)) {
    if (lower.includes(key)) return emoji;
  }
  return '🤖';
}

const themeEmojis: Record<string, string> = {
  food: '🍽️', travel: '✈️', shopping: '🛍️', work: '💼',
  health: '🏥', social: '👋', transport: '🚕',
  entertainment: '🎬', education: '📖', random: '🎲',
};

export function LiveSession({ scenario, onEnd, onExit }: LiveSessionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  useEffect(() => {
    if (showHistory) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText, showHistory]);

  const checkForFarewell = useCallback((text: string) => {
    const farewells = ['bye', 'goodbye', 'see you', 'take care', 'have a good', 'have a nice', 'thanks, bye', 'thank you, bye'];
    return farewells.some(f => text.toLowerCase().trim().includes(f));
  }, []);

  useEffect(() => {
    const session = new GeminiLiveSession({
      onAudioResponse: () => { },
      onTextResponse: (text) => setCurrentAiText(prev => prev + text),
      onTurnComplete: () => {
        setCurrentAiText(prev => {
          if (prev.trim()) {
            const newTurn: ConversationTurn = { role: 'ai', text: prev.trim(), timestamp: Date.now() };
            setTurns(t => [...t, newTurn]);
            if (checkForFarewell(prev)) {
              setTimeout(() => onEnd([...turnsRef.current, newTurn]), 2000);
            }
          }
          return '';
        });
      },
      onError: setError,
      onConnectionChange: setIsConnected,
    });

    sessionRef.current = session;
    session.connect(scenario.systemPrompt);
    return () => session.disconnect();
  }, [scenario, checkForFarewell, onEnd]);

  const toggleMic = async () => {
    if (!sessionRef.current) return;
    if (isMicActive) {
      sessionRef.current.stopMicrophone();
      setIsMicActive(false);
    } else {
      await sessionRef.current.startMicrophone();
      setIsMicActive(true);
    }
  };

  const handleEndConversation = () => {
    sessionRef.current?.disconnect();
    onEnd(turns);
  };

  const handleExitWithoutAnalysis = () => {
    sessionRef.current?.disconnect();
    onExit();
  };

  const latestAiMessage = currentAiText.trim()
    || [...turns].reverse().find(t => t.role === 'ai')?.text
    || '';

  const aiEmoji = getAiEmoji(scenario.aiRole);
  const themeEmoji = themeEmojis[scenario.theme] || '🎲';

  return (
    <div className="space-y-5 -mx-4 sm:mx-0">
      {/* Breadcrumb bar */}
      <div className="flex items-center justify-between px-4 sm:px-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{themeEmoji}</span>
          <span className="capitalize">{scenario.theme}</span>
          <span className="text-muted-foreground/50">&rarr;</span>
          <span className="font-semibold text-foreground">{scenario.brandName}</span>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
          isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        )}>
          <div className={cn('size-1.5 rounded-full', isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse')} />
          {isConnected ? 'Live' : 'Connecting'}
        </div>
      </div>

      {/* Scene hero with AI bubble */}
      <div className="relative overflow-hidden rounded-[20px] sm:rounded-2xl shadow-lg border border-border/50">
        {scenario.sceneImageUrl ? (
          <img
            src={scenario.sceneImageUrl}
            alt={`Scene: ${scenario.brandName} in ${scenario.location}`}
            className="w-full h-56 sm:h-64 object-cover"
          />
        ) : (
          <div className="w-full h-56 sm:h-64 bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 flex items-center justify-center">
            <span className="text-7xl drop-shadow-sm">{themeEmoji}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* AI speech bubble */}
        {latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-blue-100 border-2 border-white shadow-md flex items-center justify-center text-xl">
                {aiEmoji}
              </div>
              <div className="bg-white/95 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-md max-w-[85%] border border-white/50">
                <p className="text-[11px] text-muted-foreground mb-0.5 capitalize font-semibold">{scenario.aiRole}</p>
                <p className="text-sm text-foreground leading-relaxed text-pretty">
                  {currentAiText.trim() || latestAiMessage}
                  {currentAiText.trim() && <span className="animate-pulse ml-0.5 text-blue-500">|</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-blue-100 border-2 border-white shadow-md flex items-center justify-center text-xl">
                {aiEmoji}
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-md border border-white/50">
                <p className="text-sm text-muted-foreground italic">Waiting for connection...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "Your Turn" mic area */}
      <Card className="p-8 mx-4 sm:mx-0 shadow-sm border-slate-100">
        <div className="flex flex-col items-center gap-6">
          <MicrophoneButton
            onClick={toggleMic}
            isRecording={isMicActive}
            disabled={!isConnected}
            size="lg"
          />

          <p className={cn(
            'text-sm font-semibold transition-colors',
            isMicActive ? 'text-blue-600' : 'text-muted-foreground'
          )}>
            {!isConnected ? 'Connecting...' : isMicActive ? 'Listening...' : 'Tap to Speak'}
          </p>
        </div>
      </Card>

      {/* Chat history (collapsible, journal-style) */}
      {turns.length > 0 && (
        <div className="mx-4 sm:mx-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2"
          >
            <MessageCircle size={14} />
            <span>Conversation ({turns.length} messages)</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHistory && (
            <div className="bg-slate-50 rounded-2xl p-4 mt-2 max-h-64 overflow-y-auto space-y-3 shadow-inner border border-slate-100">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                      turn.role === 'user'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-foreground shadow-sm border border-slate-100',
                    )}
                  >
                    <p className={cn("text-[10px] mb-0.5 font-semibold capitalize opacity-80", turn.role === 'user' ? 'text-blue-100' : 'text-muted-foreground')}>
                      {turn.role === 'user' ? 'You' : scenario.aiRole}
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
          onClick={handleExitWithoutAnalysis}
          aria-label="Exit conversation"
          className="flex-1"
        >
          <LogOut size={18} />
          Exit
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={handleEndConversation}
          disabled={turns.length === 0}
          aria-label="Analyze conversation"
          className="flex-1"
        >
          <BarChart3 size={18} />
          Analyze
        </Button>
      </div>

      {error && (
        <div className="mx-4 sm:mx-0 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}

