import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ScenarioSetup } from './ScenarioSetup';
import { LiveSession } from './LiveSession';
import { ConversationAnalysis } from './ConversationAnalysis';
import { Button } from '../ui/Button';
import type { LiveScenario, ConversationTurn, LiveSessionMode } from '../../types/scenario';
import type { Briefing, SessionSize } from '../../types/master';

type LivePhase = 'setup' | 'conversation' | 'analysis';

export function LiveRoleplayPage() {
  const [phase, setPhase] = useState<LivePhase>('setup');
  const [scenario, setScenario] = useState<LiveScenario | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Phase 2 (F-P2-02/03/05) — Master briefing + sessionMode can arrive via
  // router state from Prática Sugerida / Paths. Kept immutable for the
  // lifetime of this route.
  const { briefing, sessionMode } = useMemo<{
    briefing: Briefing | null;
    sessionMode: LiveSessionMode;
  }>(() => {
    const state = location.state as {
      briefing?: Briefing;
      sessionMode?: SessionSize;
    } | null;
    return {
      briefing: state?.briefing ?? null,
      // Default to 'standard' when the user enters Live manually (no
      // briefing). The Master only enforces 'mini' when it routed here.
      sessionMode: state?.sessionMode ?? 'standard',
    };
  }, [location.state]);

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

  const handleRetryScenario = () => {
    setTurns([]);
    setPhase('conversation');
    // Keep scenario intact — re-enters LiveSession with same scenario
  };

  return (
    <div className="space-y-6">
      {/* Back to practice hub - only on setup phase (conversation/analysis have their own exit) */}
      {phase === 'setup' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/practice')}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ChevronLeft size={18} />
          Practice
        </Button>
      )}

      {phase === 'setup' && (
        <ScenarioSetup
          onScenarioReady={handleScenarioReady}
          briefing={briefing}
          sessionMode={sessionMode}
        />
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
          onRetry={handleRetryScenario}
          briefing={briefing}
        />
      )}
    </div>
  );
}
