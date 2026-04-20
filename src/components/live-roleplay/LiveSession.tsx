import { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveSession } from '../../services/geminiLive';
import { OpenAIRealtimeLiveSession } from '../../services/openaiRealtimeLive';
import type { ILiveSession } from '../../services/liveSession';
import { useRuntimeConfig } from '../../contexts/RuntimeConfigContext';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';
import { SceneCard } from './SceneCard';
import { MicPanel } from './MicPanel';
import { ChatHistory } from './ChatHistory';
import { ActionBar } from './ActionBar';

interface LiveSessionProps {
  scenario: LiveScenario;
  onEnd: (turns: ConversationTurn[]) => void;
  onExit: () => void;
}

export function LiveSession({ scenario, onEnd, onExit }: LiveSessionProps) {
  const { modelConfig: config } = useRuntimeConfig();
  const [isConnected, setIsConnected] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<ILiveSession | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  const checkForFarewell = useCallback((text: string) => {
    const farewells = [
      /\bbye\b/i, /\bgoodbye\b/i, /\bsee you\b/i, /\btake care\b/i,
      /\bhave a good\s+(day|night|one|trip|time|evening|morning)\b/i,
      /\bhave a nice\s+(day|night|trip|time|evening|morning)\b/i,
      /\bthanks,?\s*bye\b/i, /\bthank you,?\s*bye\b/i,
    ];
    return farewells.some(pattern => pattern.test(text));
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

    const liveSource = config?.liveSource ?? 'gemini';
    const session: ILiveSession = liveSource === 'openai'
      ? new OpenAIRealtimeLiveSession(callbacks)
      : new GeminiLiveSession(callbacks);

    sessionRef.current = session;
    session.connect(scenario.systemPrompt, scenario.suggestedVoice);
    return () => session.disconnect();
  }, [scenario, checkForFarewell, config]);

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

  return (
    <div className="space-y-5 -mx-4 sm:mx-0">
      <SceneCard
        scenario={scenario}
        isConnected={isConnected}
        turns={turns}
        currentAiText={currentAiText}
      />
      <MicPanel
        isConnected={isConnected}
        isMicActive={isMicActive}
        onToggleMic={toggleMic}
      />
      <ChatHistory
        turns={turns}
        aiRole={scenario.aiRole}
        currentAiText={currentAiText}
      />
      <ActionBar
        hasTurns={turns.length > 0}
        onExit={handleExitWithoutAnalysis}
        onAnalyze={handleEndConversation}
      />
      {error && (
        <div className="mx-4 sm:mx-0 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}
