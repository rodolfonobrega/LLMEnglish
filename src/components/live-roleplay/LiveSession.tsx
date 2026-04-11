import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveSession } from '../../services/geminiLive';
import { OpenAIRealtimeLiveSession } from '../../services/openaiRealtimeLive';
import type { ILiveSession } from '../../services/liveSession';
import { getRuntimeModelConfig } from '../../services/runtimeState';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';
import { LogOut, BarChart3, MessageCircle } from 'lucide-react';
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
  const sessionRef = useRef<ILiveSession | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, currentAiText]);

  const checkForFarewell = useCallback((text: string) => {
    const farewells = ['bye', 'goodbye', 'see you', 'take care', 'have a good', 'have a nice', 'thanks, bye', 'thank you, bye'];
    return farewells.some(f => text.toLowerCase().trim().includes(f));
  }, []);

  useEffect(() => {
    const callbacks = {
      onAudioResponse: () => { },
      onTextResponse: (text: string) => setCurrentAiText(prev => prev + text),
      onTurnComplete: () => {
        setCurrentAiText(prev => {
          if (prev.trim()) {
            const newTurn: ConversationTurn = { role: 'ai', text: prev.trim(), timestamp: Date.now() };
            setTurns(t => [...t, newTurn]);
            if (checkForFarewell(prev)) {
              setTimeout(() => onEndRef.current([...turnsRef.current, newTurn]), 2000);
            }
          }
          return '';
        });
      },
      onUserTranscription: (text: string) => {
        const userTurn: ConversationTurn = { role: 'user', text, timestamp: Date.now() };
        setTurns(t => [...t, userTurn]);
      },
      onError: setError,
      onConnectionChange: setIsConnected,
    };

    const config = getRuntimeModelConfig();
    const liveSource = config?.liveSource ?? 'gemini';
    const session: ILiveSession = liveSource === 'openai'
      ? new OpenAIRealtimeLiveSession(callbacks)
      : new GeminiLiveSession(callbacks);

    sessionRef.current = session;
    session.connect(scenario.systemPrompt, scenario.suggestedVoice);
    return () => session.disconnect();
  }, [scenario, checkForFarewell]);

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

  const latestUserMessage = [...turns].reverse().find(t => t.role === 'user')?.text || '';

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
          {isConnected ? 'Ao Vivo' : 'Conectando'}
        </div>
      </div>

      {/* Immersive scene with AI + user bubbles */}
      <div className="relative overflow-hidden rounded-[20px] sm:rounded-2xl shadow-lg border border-border/50">
        {scenario.sceneImageUrl ? (
          <img
            src={scenario.sceneImageUrl}
            alt={`Scene: ${scenario.brandName} in ${scenario.location}`}
            className="w-full h-64 sm:h-72 object-cover"
          />
        ) : (
          <div className="w-full h-64 sm:h-72 bg-gradient-to-br from-primary-soft via-muted to-secondary flex items-center justify-center">
            <span className="text-7xl drop-shadow-sm">{themeEmoji}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-white/30 dark:from-black/70 dark:to-transparent" />

        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Character avatar with status indicator */}
        <div className="absolute top-4 left-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center overflow-hidden bg-white text-2xl">
              {aiEmoji}
            </div>
            <div className={cn(
              'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center',
              isConnected ? 'bg-green-500' : 'bg-yellow-500',
            )}>
              <div className={cn('w-2 h-2 bg-white rounded-full', !isConnected && 'animate-pulse')} />
            </div>
          </div>
        </div>

        {/* AI speech bubble */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-end gap-2.5">
            <div className="ml-16 max-w-[70%]">
              <div className="relative bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-[20px] rounded-tl-sm px-4 py-3 shadow-lg border border-white/50 dark:border-border/50">
                <div className="absolute -left-2 top-0 w-4 h-4 bg-white/95 dark:bg-card/95 transform rotate-45" />
                <p className="text-[11px] text-muted-foreground mb-0.5 capitalize font-semibold uppercase tracking-wider">
                  {scenario.aiRole}
                </p>
                {latestAiMessage ? (
                  <p className="text-sm text-foreground leading-relaxed text-pretty">
                    {currentAiText.trim() || latestAiMessage}
                    {currentAiText.trim() && <span className="animate-pulse ml-0.5 text-blue-500">|</span>}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aguardando conexão...</p>
                )}
              </div>
            </div>
          </div>

          {/* User speech bubble (latest user message overlaid on scene) */}
          {latestUserMessage && (
            <div className="flex justify-end mt-2">
              <div className="max-w-[55%] animate-message-in">
                <div className="relative bg-blue-600/90 backdrop-blur-sm rounded-[20px] rounded-br-sm px-4 py-2.5 shadow-lg text-white">
                  <div className="absolute -right-2 bottom-0 w-4 h-4 bg-blue-600/90 transform rotate-45" />
                  <p className="text-[10px] opacity-70 mb-0.5 font-semibold">Você</p>
                  <p className="text-sm leading-relaxed">{latestUserMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mic area */}
      <Card className="p-6 mx-4 sm:mx-0 shadow-sm border-slate-100">
        <div className="flex flex-col items-center gap-4">
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
            {!isConnected ? 'Conectando...' : isMicActive ? 'Ouvindo...' : 'Toque para Falar'}
          </p>
        </div>
      </Card>

      {/* Chat history (always visible) */}
      {turns.length > 0 && (
        <div className="mx-4 sm:mx-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
            <MessageCircle size={14} />
            <span>Conversa ({turns.length} mensagens)</span>
          </div>
          <div className="bg-slate-50 dark:bg-card/50 rounded-2xl p-4 max-h-56 overflow-y-auto space-y-3 shadow-inner border border-slate-100 dark:border-border/50">
            {turns.map((turn, i) => (
              <div
                key={`${turn.role}-${turn.timestamp}-${i}`}
                className={cn('flex animate-message-in', turn.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                    turn.role === 'user'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-card text-foreground shadow-sm border border-slate-100 dark:border-border/50',
                  )}
                >
                  <p className={cn("text-[10px] mb-0.5 font-semibold capitalize opacity-80", turn.role === 'user' ? 'text-blue-100' : 'text-muted-foreground')}>
                    {turn.role === 'user' ? 'Você' : scenario.aiRole}
                  </p>
                  <p className="leading-relaxed text-pretty">{turn.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
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
          Sair
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
          Analisar
        </Button>
      </div>

      {error && (
        <div className="mx-4 sm:mx-0 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}
