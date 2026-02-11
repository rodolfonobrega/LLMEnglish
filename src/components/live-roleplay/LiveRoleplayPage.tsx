import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ScenarioSetup } from './ScenarioSetup';
import { LiveSession } from './LiveSession';
import { ConversationAnalysis } from './ConversationAnalysis';
import { Button } from '../ui/Button';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';

type LivePhase = 'setup' | 'conversation' | 'analysis';

export function LiveRoleplayPage() {
  const [phase, setPhase] = useState<LivePhase>('setup');
  const [scenario, setScenario] = useState<LiveScenario | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const navigate = useNavigate();

  const handleScenarioReady = (s: LiveScenario) => {
    setScenario(s);
    setPhase('conversation');
  };

  const handleConversationEnd = (conversationTurns: ConversationTurn[]) => {
    setTurns(conversationTurns);
    setPhase('analysis');
  };

  const handleExit = () => {
    setPhase('setup');
    setScenario(null);
    setTurns([]);
  };

  return (
    <div className="space-y-6">
      {/* Back button - only on setup phase (conversation/analysis have their own exit) */}
      {phase === 'setup' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ChevronLeft size={18} />
          Back
        </Button>
      )}

      {phase === 'setup' && (
        <ScenarioSetup onScenarioReady={handleScenarioReady} />
      )}
      {phase === 'conversation' && scenario && (
        <LiveSession
          scenario={scenario}
          onEnd={handleConversationEnd}
          onExit={handleExit}
        />
      )}
      {phase === 'analysis' && scenario && (
        <ConversationAnalysis
          scenario={scenario}
          turns={turns}
          onReset={handleExit}
        />
      )}
    </div>
  );
}
