import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveSession } from '../../services/geminiLive';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';
import { Mic, MicOff, LogOut, BarChart3, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
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
      onAudioResponse: () => {},
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
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          <span>{themeEmoji}</span>
          <span className="capitalize">{scenario.theme}</span>
          <span className="text-ink-faint">&rarr;</span>
          <span className="font-semibold text-ink">{scenario.brandName}</span>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
          isConnected ? 'bg-leaf-soft text-leaf' : 'bg-amber-soft text-amber'
        )}>
          <div className={cn('size-1.5 rounded-full', isConnected ? 'bg-leaf' : 'bg-amber animate-pulse')} />
          {isConnected ? 'Live' : 'Connecting'}
        </div>
      </div>

      {/* Scene hero with AI bubble */}
      <div className="relative overflow-hidden rounded-[20px] sm:rounded-[20px] shadow-[var(--shadow-lg)]">
        {scenario.sceneImageUrl ? (
          <img
            src={scenario.sceneImageUrl}
            alt={`Scene: ${scenario.brandName} in ${scenario.location}`}
            className="w-full h-56 sm:h-64 object-cover"
          />
        ) : (
          <div className="w-full h-56 sm:h-64 bg-gradient-to-br from-amber/15 via-card-warm to-sky/15 flex items-center justify-center">
            <span className="text-7xl drop-shadow-lg">{themeEmoji}</span>
          </div>
        )}

        {/* Warm gradient overlay (amber, not black) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26]/70 via-[#2D2A26]/20 to-transparent" />

        {/* AI speech bubble */}
        {latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-coral-soft shadow-[var(--shadow-md)] flex items-center justify-center text-xl border-2 border-white/30">
                {aiEmoji}
              </div>
              <div className="bg-card/95 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-[var(--shadow-md)] max-w-[85%]">
                <p className="text-[11px] text-ink-muted mb-0.5 capitalize font-semibold">{scenario.aiRole}</p>
                <p className="text-sm text-ink leading-relaxed text-pretty">
                  {currentAiText.trim() || latestAiMessage}
                  {currentAiText.trim() && <span className="animate-pulse ml-0.5 text-coral">|</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!latestAiMessage && (
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-end gap-2.5">
              <div className="flex-shrink-0 size-11 rounded-full bg-coral-soft shadow-[var(--shadow-md)] flex items-center justify-center text-xl border-2 border-white/30">
                {aiEmoji}
              </div>
              <div className="bg-card/90 backdrop-blur-sm rounded-[20px] rounded-bl-md px-4 py-3 shadow-[var(--shadow-md)]">
                <p className="text-sm text-ink-muted italic">Waiting for connection...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "Your Turn" mic area */}
      <div className="bg-card rounded-[20px] p-8 mx-4 sm:mx-0 shadow-[var(--shadow-md)]">
        <div className="flex flex-col items-center gap-5">
          {/* Mic button with coral glow rings */}
          <div className="relative">
            {isMicActive && (
              <>
                <div className="absolute -inset-3 rounded-full bg-coral/15 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute -inset-5 rounded-full bg-coral/8 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
                <div className="absolute -inset-2 rounded-full border-2 border-coral/30 animate-pulse" />
              </>
            )}
            <button
              onClick={toggleMic}
              disabled={!isConnected}
              aria-label={isMicActive ? 'Stop microphone' : 'Start speaking'}
              className={cn(
                'relative size-[88px] rounded-full flex items-center justify-center transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral/40',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isMicActive
                  ? 'bg-gradient-to-b from-coral to-coral-hover text-white shadow-lg shadow-coral/30'
                  : 'bg-gradient-to-b from-coral to-coral-hover text-white shadow-lg shadow-coral/25 hover:shadow-xl hover:shadow-coral/35 active:scale-95',
              )}
            >
              {isMicActive ? <MicOff size={36} /> : <Mic size={36} />}
            </button>
          </div>

          <p className={cn(
            'text-sm font-semibold',
            isMicActive ? 'text-coral' : 'text-ink-secondary'
          )}>
            {!isConnected ? 'Connecting...' : isMicActive ? 'Listening...' : 'Tap to Speak'}
          </p>
        </div>
      </div>

      {/* Chat history (collapsible, journal-style) */}
      {turns.length > 0 && (
        <div className="mx-4 sm:mx-0">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink-secondary transition-colors w-full justify-center py-2"
          >
            <MessageCircle size={14} />
            <span>Conversation ({turns.length} messages)</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHistory && (
            <div className="bg-card-warm rounded-[20px] p-4 mt-2 max-h-64 overflow-y-auto space-y-3 shadow-[var(--shadow-sm)]">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3',
                      turn.role === 'user'
                        ? 'bg-sky-soft text-ink'
                        : 'bg-card text-ink shadow-[var(--shadow-sm)]',
                    )}
                  >
                    <p className="text-[11px] text-ink-muted mb-0.5 font-semibold capitalize">
                      {turn.role === 'user' ? 'You' : scenario.aiRole}
                    </p>
                    <p className="text-sm text-pretty">{turn.text}</p>
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
          variant="primary"
          size="lg"
          onClick={handleEndConversation}
          disabled={turns.length === 0}
          aria-label="Analyze conversation"
          className="flex-1 bg-leaf hover:bg-leaf text-white"
        >
          <BarChart3 size={18} />
          Analyze
        </Button>
      </div>

      {error && (
        <div className="mx-4 sm:mx-0 bg-danger-soft border border-danger/30 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}
    </div>
  );
}
