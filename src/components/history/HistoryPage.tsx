import { useEffect, useMemo, useState } from 'react';
import { clearLiveSessions, getLiveSessions } from '../../services/storage';
import type { LiveSession } from '../../types/scenario';
import { Clock, MessageCircle, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../utils/cn';
import {
  listRecentReflections,
  type StoredSessionReflection,
} from '../../services/sessionReflections';

const themeEmojis: Record<string, string> = {
  food: '🍽️', travel: '✈️', shopping: '🛍️', work: '💼',
  health: '🏥', social: '👋', transport: '🚕',
  entertainment: '🎬', education: '📖', random: '🎲', custom: '✨',
};

function formatDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return '';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}min ${seconds}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Phase 3 (F-P3-02) — compact annotation shown inline in the history
 * feed when a stored reflection matches the session. Never renders
 * `salient_patterns` verbatim; those are metadata for future Master
 * queries, not for the student.
 */
function ReflectionAnnotation({
  reflection,
}: {
  reflection: StoredSessionReflection;
}) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/5 border border-accent/20">
      <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
      <div className="space-y-1 text-sm leading-snug">
        <p className="text-foreground">{reflection.strength_text}</p>
        <p className="text-muted-foreground">{reflection.opportunity_text}</p>
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  reflection,
}: {
  session: LiveSession;
  reflection?: StoredSessionReflection;
}) {
  return (
    <div className="space-y-4 animate-message-in">
      {/* Scene image */}
      {session.scenario.sceneImageUrl && (
        <div className="relative overflow-hidden rounded-xl">
          <img
            src={session.scenario.sceneImageUrl}
            alt={session.scenario.brandName}
            className="w-full h-36 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}

      {/* Phase 3 — Master reflection matching this session, when available. */}
      {reflection && <ReflectionAnnotation reflection={reflection} />}

      {/* Feedback */}
      {session.analysis?.overallFeedback && (
        <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">{session.analysis.overallFeedback}</p>
        </div>
      )}

      {/* Improvements */}
      {session.analysis?.improvements && session.analysis.improvements.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} />
            Pontos para Melhorar
          </div>
          <ul className="space-y-1.5">
            {session.analysis.improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-amber-500 font-bold text-xs mt-0.5">{i + 1}.</span>
                <span className="leading-relaxed">{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transcript */}
      {session.turns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <MessageCircle size={12} />
            Transcrição ({session.turns.length} mensagens)
          </div>
          <div className="bg-slate-50 dark:bg-card/50 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
            {session.turns.map((turn, i) => (
              <div
                key={i}
                className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                    turn.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-card text-foreground border border-slate-100 dark:border-border/50',
                  )}
                >
                  <p className={cn(
                    'text-[10px] mb-0.5 font-semibold capitalize opacity-80',
                    turn.role === 'user' ? 'text-blue-100' : 'text-muted-foreground',
                  )}>
                    {turn.role === 'user' ? 'Você' : session.scenario.aiRole}
                  </p>
                  <p className="leading-relaxed">{turn.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reflections, setReflections] = useState<StoredSessionReflection[]>([]);

  useEffect(() => {
    void loadSessions()
    // Load reflections separately — the network call is unrelated to
    // live-session storage and we don't want one failure to take the
    // other down.
    void (async () => {
      try {
        const rows = await listRecentReflections(100);
        setReflections(rows);
      } catch (err) {
        console.warn('[HistoryPage] reflections load failed', err);
      }
    })();
  }, [])

  const reflectionBySessionKey = useMemo(() => {
    const map = new Map<string, StoredSessionReflection>();
    for (const r of reflections) {
      map.set(r.session_key, r);
    }
    return map;
  }, [reflections]);

  const loadSessions = async () => {
    setIsLoading(true)
    const loadedSessions = await getLiveSessions()
    setSessions(
      loadedSessions.sort((a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    )
    setIsLoading(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 pb-20">
      <a href="/practice">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2 mb-1"
        >
          <ChevronLeft size={18} />
          Hub de Prática
        </Button>
      </a>
      <div className="flex items-center gap-3">
        <div className="p-3 bg-violet-50 dark:bg-violet-900/30 rounded-2xl">
          <Clock size={24} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Histórico de Conversas</h1>
          <p className="text-muted-foreground text-sm">Reveja suas simulações anteriores.</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Carregando conversas...
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-foreground mb-1">Nenhuma conversa ainda</p>
            <p className="text-sm text-muted-foreground">
              Faça sua primeira simulação ao vivo e ela aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const emoji = themeEmojis[session.scenario.theme] || '🎲';
            const isExpanded = expandedId === session.id;
            const duration = formatDuration(session.startedAt, session.endedAt);
            const userTurnCount = session.turns.filter(t => t.role === 'user').length;
            const reflection = reflectionBySessionKey.get(`live-${session.id}`);

            return (
              <Card key={session.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(session.id)}
                  className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl shrink-0 mt-0.5">{emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-foreground truncate flex items-center gap-1.5">
                          {session.scenario.brandName || 'Simulação'}
                          {reflection && (
                            <Sparkles
                              size={12}
                              className="text-accent shrink-0"
                              aria-label="Tem uma reflexão do Mestre"
                            />
                          )}
                        </p>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                      </div>
                      <p className="text-sm text-muted-foreground capitalize truncate">
                        {session.scenario.aiRole} &middot; {session.scenario.location}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{formatDate(session.startedAt)}</span>
                        {duration && <span>&middot; {duration}</span>}
                        <span>&middot; {session.turns.length} msgs ({userTurnCount} suas)</span>
                      </div>
                      {session.analysis?.overallFeedback && !isExpanded && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                          {session.analysis.overallFeedback}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    <div className="pt-4">
                      <SessionDetail session={session} reflection={reflection} />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Apagar todo o histórico de conversas?')) {
                void (async () => {
                  await clearLiveSessions()
                  setExpandedId(null)
                  await loadSessions()
                })()
              }
            }}
            className="text-destructive hover:text-destructive/80 text-xs"
          >
            Limpar Histórico
          </Button>
        </div>
      )}
    </div>
  );
}
