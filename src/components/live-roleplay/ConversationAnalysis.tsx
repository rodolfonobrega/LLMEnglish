import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveScenario, ConversationTurn } from '../../types/scenario';
import { chatCompletion, textToSpeech } from '../../services/openai';
import { getModelConfig } from '../../services/storage';
import { getConversationAnalysisPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { base64ToAudioUrl, stopCurrentAudio } from '../../utils/audio';

function getTtsMimeType(): string {
  const config = getModelConfig();
  return config.ttsProvider === 'gemini' ? 'audio/wav' : 'audio/mp3';
}
import { addXP } from '../../services/gamification';
import { XP_PER_LIVE_SESSION } from '../../types/gamification';
import { Loader2, Volume2, Play, Square, RotateCcw, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface ConversationAnalysisProps {
  scenario: LiveScenario;
  turns: ConversationTurn[];
  onReset: () => void;
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

export function ConversationAnalysis({ scenario, turns, onReset }: ConversationAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    analyzeConversation();
  }, []);

  // Auto-generate audio once analysis is ready
  useEffect(() => {
    if (analysis && !dialogueAudioReady && !isGeneratingAudio) {
      generateDialogueAudio(analysis);
    }
  }, [analysis]);

  const analyzeConversation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const prompt = getConversationAnalysisPrompt(turns);
      const response = await chatCompletion(
        'You analyze English conversations. Respond only with valid JSON.',
        prompt,
      );
      const cleanResponse = cleanJson(response);
      const data: AnalysisData = JSON.parse(cleanResponse);
      setAnalysis(data);

      addXP(XP_PER_LIVE_SESSION);
      window.dispatchEvent(new Event('gamification-update'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const generateDialogueAudio = async (data: AnalysisData) => {
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
  };

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
          <Sparkles size={48} className="text-coral animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
        <div className="text-center">
          <p className="text-ink font-bold text-lg">Analyzing your conversation...</p>
          <p className="text-ink-muted text-sm mt-1">
            {themeEmoji} {scenario.brandName}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-danger-soft border border-danger/30 rounded-xl p-4 text-danger">{error}</div>
        <Button variant="ghost" onClick={onReset} className="text-sky">Try Again</Button>
      </div>
    );
  }

  if (!analysis) return null;

  const audioProgressPct = audioTotal > 0 ? Math.round((audioProgress / audioTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Scene image header with warm amber overlay */}
      {scenario.sceneImageUrl ? (
        <div className="relative overflow-hidden rounded-[20px] shadow-[var(--shadow-lg)]">
          <img
            src={scenario.sceneImageUrl}
            alt={`Scene: ${scenario.brandName}`}
            className="w-full h-36 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-parchment via-parchment/50 to-amber/10" />
          <div className="absolute bottom-4 left-5 right-5">
            <h2 className="text-2xl font-extrabold text-ink text-balance">Conversation Analysis</h2>
            <p className="text-sm text-ink-secondary mt-0.5">
              {themeEmoji} {scenario.brandName} &middot; {scenario.location}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-ink text-balance">Conversation Analysis</h2>
          <p className="text-sm text-ink-secondary">
            {themeEmoji} {scenario.brandName} &middot; {scenario.location}
          </p>
        </div>
      )}

      {/* Overall Feedback */}
      <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-7 rounded-full bg-leaf-soft flex items-center justify-center">
            <CheckCircle2 size={16} className="text-leaf" />
          </div>
          <h3 className="text-sm font-bold text-leaf uppercase tracking-wide">Overall Feedback</h3>
        </div>
        <p className="text-ink-secondary leading-relaxed text-pretty">{analysis.overallFeedback}</p>
      </div>

      {/* Improvements */}
      {analysis.improvements.length > 0 && (
        <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="size-7 rounded-full bg-coral-soft flex items-center justify-center">
              <AlertTriangle size={16} className="text-coral" />
            </div>
            <h3 className="text-sm font-bold text-coral uppercase tracking-wide">Areas for Improvement</h3>
          </div>
          <ul className="space-y-3">
            {analysis.improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-3 text-ink-secondary">
                <span className="flex-shrink-0 size-6 rounded-full bg-coral-soft text-coral text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-pretty leading-relaxed">{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shadowing Lab */}
      <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-sky-soft flex items-center justify-center">
              <Volume2 size={16} className="text-sky" />
            </div>
            <h3 className="text-sm font-bold text-sky uppercase tracking-wide">Shadowing Lab</h3>
          </div>
          <div className="flex items-center gap-2">
            {dialogueAudioReady && (
              <Button
                variant="coral"
                size="sm"
                onClick={isPlayingDialogue ? stopDialogue : playFullDialogue}
                aria-label={isPlayingDialogue ? 'Stop dialogue playback' : 'Play full dialogue'}
              >
                {isPlayingDialogue ? <Square size={14} /> : <Play size={14} />}
                {isPlayingDialogue ? 'Stop' : 'Play All'}
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-ink-faint mb-3 text-pretty">
          Native version of your conversation. Tap any line to hear it, or play all for full shadowing practice.
        </p>

        {/* Audio generation progress bar */}
        {isGeneratingAudio && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 size={12} className="animate-spin text-sky" />
              <span>Generating audio... {audioProgress}/{audioTotal}</span>
            </div>
            <div className="h-1.5 bg-card-warm rounded-full overflow-hidden">
              <div
                className="h-full bg-sky rounded-full transition-all duration-300 ease-out"
                style={{ width: `${audioProgressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Journal-style dialogue with interactive lines */}
        <div className="bg-card-warm rounded-2xl p-4 space-y-3">
          {analysis.cleanDialogue.map((turn, i) => {
            const isPlaying = currentPlayingLine === i;
            const canPlay = dialogueAudioReady && dialogueAudioUrls[i];

            return (
              <div
                key={i}
                className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <button
                  onClick={() => canPlay && playIndividualLine(i)}
                  disabled={!canPlay}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-left transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/50',
                    turn.role === 'user'
                      ? 'bg-sky-soft text-ink'
                      : 'bg-card text-ink shadow-[var(--shadow-sm)]',
                    isPlaying && 'ring-2 ring-sky shadow-[var(--shadow-md)] scale-[1.02]',
                    canPlay && !isPlaying && 'hover:shadow-[var(--shadow-md)] hover:scale-[1.01] cursor-pointer',
                    !canPlay && 'opacity-70 cursor-default',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[11px] text-ink-muted capitalize font-semibold">
                      {turn.role === 'user' ? 'You (native)' : scenario.aiRole}
                    </p>
                    {canPlay && (
                      <div className={cn(
                        'flex-shrink-0 size-5 rounded-full flex items-center justify-center transition-colors',
                        isPlaying
                          ? 'bg-sky text-white'
                          : 'bg-ink/5 text-ink-muted',
                      )}>
                        {isPlaying ? (
                          <div className="flex items-center gap-[2px]">
                            <span className="w-[2px] h-2 bg-white rounded-full animate-pulse" />
                            <span className="w-[2px] h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-[2px] h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <Volume2 size={10} />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-pretty leading-relaxed">{turn.text}</p>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action */}
      <Button
        variant="coral"
        size="lg"
        onClick={onReset}
        className="w-full text-lg font-bold py-4 rounded-2xl"
      >
        <RotateCcw size={18} />
        Start New Conversation
      </Button>
    </div>
  );
}
