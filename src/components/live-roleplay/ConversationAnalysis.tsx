import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveScenario, ConversationTurn, LiveSession as LiveSessionData } from '../../types/scenario';
import { chatCompletion, textToSpeech } from '../../services/openai';
import { getModelConfig, saveLiveSession, getConversationTone } from '../../services/storage';
import { getConversationAnalysisPrompt, conversationAnalysisResponseSchema } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { base64ToAudioUrl, stopCurrentAudio } from '../../utils/audio';
import { addXP, createSessionReport } from '../../services/gamification';
import { XP_PER_LIVE_SESSION } from '../../types/gamification';
import type { ConversationTone } from '../../types/settings';
import { recordSessionSnapshot } from '../../services/errorAnalysis';
import { Loader2, Volume2, Play, Square, RotateCcw, CheckCircle2, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../utils/cn';

function getTtsMimeType(): string {
  const config = getModelConfig();
  // OpenAI returns MP3; Gemini and Groq (Orpheus) return WAV
  return config.ttsSource === 'openai' ? 'audio/mp3' : 'audio/wav';
}

interface ConversationAnalysisProps {
  scenario: LiveScenario;
  turns: ConversationTurn[];
  onReset: () => void;
  onRetry?: () => void;
}

interface AnalysisData {
  improvements: string[];
  cleanDialogue: { role: string; text: string }[];
  overallFeedback: string;
}

const themeEmojis: Record<string, string> = {
  food: '\uD83C\uDF7D\uFE0F', travel: '\u2708\uFE0F', shopping: '\uD83D\uDECD\uFE0F', work: '\uD83D\uDCBC',
  health: '\uD83C\uDFE5', social: '\uD83D\uDC4B', transport: '\uD83D\uDE95',
  entertainment: '\uD83C\uDFAC', education: '\uD83D\uDCD6', random: '\uD83C\uDFB2',
};

/** Pick two distinct TTS voices: one for the user lines, another for the AI partner. */
function getShadowingVoices(): { userVoice: string; aiVoice: string } {
  const config = getModelConfig();
  const primary = config.ttsVoice;
  // Pick a contrasting voice. If the user's configured voice is one of these, pick the other.
  const VOICE_A = 'nova';
  const VOICE_B = 'onyx';
  if (primary === VOICE_A) return { userVoice: VOICE_A, aiVoice: VOICE_B };
  if (primary === VOICE_B) return { userVoice: VOICE_B, aiVoice: VOICE_A };
  // If user configured a different voice, use it for "user" lines and pick onyx for AI
  return { userVoice: primary, aiVoice: VOICE_B };
}

export function ConversationAnalysis({ scenario, turns, onReset, onRetry }: ConversationAnalysisProps) {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tone] = useState<ConversationTone>(() => getConversationTone());

  // Audio state
  const [audioProgress, setAudioProgress] = useState<number>(0); // 0..totalLines for generation progress
  const [audioTotal, setAudioTotal] = useState<number>(0);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [dialogueAudioReady, setDialogueAudioReady] = useState(false);
  const [dialogueAudioUrls, setDialogueAudioUrls] = useState<string[]>([]);

  // Playback state
  const [isPlayingDialogue, setIsPlayingDialogue] = useState(false);
  const [currentPlayingLine, setCurrentPlayingLine] = useState<number | null>(null);
  const isPlayingFullRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const analyzeConversation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const prompt = getConversationAnalysisPrompt(turns, tone);
      const response = await chatCompletion(
        'You analyze English conversations. Respond only with valid JSON.',
        prompt,
        undefined,
        conversationAnalysisResponseSchema,
      );
      const cleanResponse = cleanJson(response);
      const data: AnalysisData = JSON.parse(cleanResponse);
      setAnalysis(data);

      // Background persistence: do not block or replace analysis on failure
      try {
        await addXP(XP_PER_LIVE_SESSION);

        const sessionData: LiveSessionData = {
          id: scenario.id,
          scenario,
          turns,
          analysis: {
            improvements: data.improvements,
            cleanDialogue: data.cleanDialogue.map(d => ({
              role: d.role as 'user' | 'ai',
              text: d.text,
              timestamp: Date.now(),
            })),
            overallFeedback: data.overallFeedback,
          },
          startedAt: new Date(turns[0]?.timestamp || Date.now()).toISOString(),
          endedAt: new Date().toISOString(),
        };
        await saveLiveSession(sessionData);

        const durationSec = turns.length > 0
          ? Math.round((Date.now() - turns[0].timestamp) / 1000)
          : 0;
        await createSessionReport(
          'live-roleplay',
          [],
          data.improvements.length,
          XP_PER_LIVE_SESSION,
          durationSec,
          data.improvements,
        );

        await recordSessionSnapshot();
      } catch (persistErr) {
        console.warn('Background persistence failed (analysis still shown):', persistErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [scenario, turns, tone]);

  const generateDialogueAudio = useCallback(async (data: AnalysisData) => {
    setIsGeneratingAudio(true);
    setAudioTotal(data.cleanDialogue.length);
    setAudioProgress(0);

    try {
      const { userVoice, aiVoice } = getShadowingVoices();

      // Generate all audio in parallel
      const promises = data.cleanDialogue.map(async (turn, index) => {
        const voice = turn.role === 'user' ? userVoice : aiVoice;
        const base64 = await textToSpeech(turn.text, voice);
        // Update progress as each one completes
        setAudioProgress(prev => prev + 1);
        return { index, url: base64ToAudioUrl(base64, getTtsMimeType()) };
      });

      const results = await Promise.all(promises);
      // Sort by index to maintain correct order
      results.sort((a, b) => a.index - b.index);
      setDialogueAudioUrls(results.map(r => r.url));
      setDialogueAudioReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, []);

  useEffect(() => {
    analyzeConversation();
  }, [analyzeConversation]);

  // Auto-generate audio once analysis is ready
  useEffect(() => {
    if (analysis && !dialogueAudioReady && !isGeneratingAudio) {
      generateDialogueAudio(analysis);
    }
  }, [analysis, dialogueAudioReady, isGeneratingAudio, generateDialogueAudio]);

  const playAudioAndWait = useCallback((url: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      stopCurrentAudio();
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => {
        currentAudioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        currentAudioRef.current = null;
        resolve();
      };
      audio.play();
    });
  }, []);

  const playFullDialogue = async () => {
    if (dialogueAudioUrls.length === 0) return;
    isPlayingFullRef.current = true;
    setIsPlayingDialogue(true);

    for (let i = 0; i < dialogueAudioUrls.length; i++) {
      if (!isPlayingFullRef.current) break;
      setCurrentPlayingLine(i);
      await playAudioAndWait(dialogueAudioUrls[i]);
      // Small gap between lines for natural rhythm
      if (i < dialogueAudioUrls.length - 1 && isPlayingFullRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    isPlayingFullRef.current = false;
    setIsPlayingDialogue(false);
    setCurrentPlayingLine(null);
  };

  const playIndividualLine = async (index: number) => {
    // Stop any full dialogue playback
    isPlayingFullRef.current = false;
    stopCurrentAudio();
    setIsPlayingDialogue(false);

    setCurrentPlayingLine(index);
    await playAudioAndWait(dialogueAudioUrls[index]);
    setCurrentPlayingLine(null);
  };

  const stopDialogue = () => {
    isPlayingFullRef.current = false;
    stopCurrentAudio();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlayingDialogue(false);
    setCurrentPlayingLine(null);
  };

  const themeEmoji = themeEmojis[scenario.theme] || '\uD83C\uDFB2';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <Sparkles size={48} className="text-primary animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
        <div className="text-center">
          <p className="text-foreground font-bold text-lg">Analisando sua conversa...</p>
          <p className="text-muted-foreground text-sm mt-1">
            {themeEmoji} {scenario.brandName}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive">{error}</div>
        <Button variant="ghost" onClick={onReset} className="text-primary hover:text-primary/80">Tentar Novamente</Button>
      </div>
    );
  }

  if (!analysis) return null;

  const audioProgressPct = audioTotal > 0 ? Math.round((audioProgress / audioTotal) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Scene image header with modern overlay */}
      {scenario.sceneImageUrl ? (
        <Card className="overflow-hidden border-none shadow-lg">
          <div className="relative h-40">
            <img
              src={scenario.sceneImageUrl}
              alt={`Scene: ${scenario.brandName}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-2xl font-bold text-foreground text-balance">Análise da Conversa</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {themeEmoji} {scenario.brandName} &middot; {scenario.location}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-1 px-1">
          <h2 className="text-2xl font-bold text-foreground text-balance">Análise da Conversa</h2>
          <p className="text-sm text-muted-foreground">
            {themeEmoji} {scenario.brandName} &middot; {scenario.location}
          </p>
        </div>
      )}

      {/* Overall Feedback */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Feedback Geral</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed text-pretty">{analysis.overallFeedback}</p>
        </CardContent>
      </Card>

      {/* Improvements */}
      {analysis.improvements.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Pontos para Melhorar</h3>
            </div>
            <ul className="space-y-4">
              {analysis.improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex-shrink-0 size-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5 dark:bg-amber-900/50 dark:text-amber-400">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground text-pretty leading-relaxed">{imp}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Shadowing Lab */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Volume2 size={18} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Laboratório de Shadowing</h3>
            </div>
            <div className="flex items-center gap-2">
              {dialogueAudioReady && (
                <Button
                  size="sm"
                  onClick={isPlayingDialogue ? stopDialogue : playFullDialogue}
                  aria-label={isPlayingDialogue ? 'Stop dialogue playback' : 'Play full dialogue'}
                  className={cn("gap-2", isPlayingDialogue ? "bg-destructive hover:bg-destructive/90 text-white" : "")}
                >
                  {isPlayingDialogue ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  {isPlayingDialogue ? 'Parar' : 'Ouvir Tudo'}
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6 text-pretty">
            Versão nativa da sua conversa. Toque em qualquer linha para ouvir, ou ouça tudo para praticar shadowing.
          </p>

          {/* Audio generation progress bar */}
          {isGeneratingAudio && (
            <div className="mb-6 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span>Gerando áudio... {audioProgress}/{audioTotal}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${audioProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Journal-style dialogue with interactive lines */}
          <div className="space-y-4">
            {analysis.cleanDialogue.map((turn, i) => {
              const isPlaying = currentPlayingLine === i;
              const canPlay = dialogueAudioReady && dialogueAudioUrls[i];

              return (
                <div
                  key={i}
                  className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    onClick={() => canPlay && playIndividualLine(i)}
                    className={cn(
                      'max-w-[85%] rounded-2xl px-5 py-4 text-left transition-all duration-200 border cursor-pointer select-none group',
                      turn.role === 'user'
                        ? 'bg-primary/5 border-primary/10 hover:border-primary/30'
                        : 'bg-card border-border hover:border-primary/30 shadow-sm',
                      isPlaying && 'ring-2 ring-primary border-transparent shadow-md scale-[1.01]',
                      !canPlay && 'opacity-70 cursor-default hover:border-border',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                        {turn.role === 'user' ? 'Você (nativo)' : scenario.aiRole}
                      </p>
                      {canPlay && (
                        <div className={cn(
                          'flex-shrink-0 size-6 rounded-full flex items-center justify-center transition-colors',
                          isPlaying
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                        )}>
                          {isPlaying ? (
                            <div className="flex items-center gap-[2px] h-3">
                              <span className="w-[2px] h-2 bg-current rounded-full animate-pulse" />
                              <span className="w-[2px] h-3 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <span className="w-[2px] h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                          ) : (
                            <Volume2 size={12} />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{turn.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="primary" size="lg" onClick={onRetry} className="w-full rounded-2xl cursor-pointer">
          <RotateCcw size={18} />
          Tentar Novamente
        </Button>
        <Button variant="secondary" size="lg" onClick={onReset} className="w-full rounded-2xl cursor-pointer">
          <Sparkles size={18} />
          Novo Cenario
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate('/history')} className="w-full rounded-2xl cursor-pointer">
          <Clock size={18} />
          Ver Historico
        </Button>
      </div>
    </div>
  );
}
