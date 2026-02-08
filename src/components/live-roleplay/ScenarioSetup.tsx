import { useState } from 'react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt } from '../../utils/prompts';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { Sparkles, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface ScenarioSetupProps {
  onScenarioReady: (scenario: LiveScenario) => void;
}

const THEMES = [
  { id: 'food', label: 'Food & Dining', tagline: 'Order like a local', icon: '🍽️', gradient: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20' },
  { id: 'travel', label: 'Travel & Hotels', tagline: 'Check in, explore', icon: '✈️', gradient: 'from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20' },
  { id: 'shopping', label: 'Shopping', tagline: 'Find the perfect deal', icon: '🛍️', gradient: 'from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/20' },
  { id: 'work', label: 'Work & Business', tagline: 'Nail that meeting', icon: '💼', gradient: 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20' },
  { id: 'health', label: 'Healthcare', tagline: 'Describe your symptoms', icon: '🏥', gradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20' },
  { id: 'social', label: 'Social & Friends', tagline: 'Make conversation flow', icon: '👋', gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20' },
  { id: 'transport', label: 'Transportation', tagline: 'Get where you need to go', icon: '🚕', gradient: 'from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/20' },
  { id: 'entertainment', label: 'Entertainment', tagline: 'Book tickets & events', icon: '🎬', gradient: 'from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20' },
  { id: 'education', label: 'Education', tagline: 'Campus life & classes', icon: '📖', gradient: 'from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20' },
  { id: 'random', label: 'Surprise Me!', tagline: 'A random adventure', icon: '🎲', gradient: 'from-fuchsia-50 to-pink-50 dark:from-fuchsia-950/30 dark:to-pink-950/20' },
];

function getSceneImagePrompt(brandName: string, location: string, aiRole: string): string {
  return `A cozy illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work in a warm, inviting interior. Anime/cartoon style, soft lighting, vibrant colors, wide shot, no text overlays, suitable as a background for a language learning app.`;
}

const INTENSITIES: { id: ScenarioIntensity; label: string; desc: string; icon: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Everyday situations', icon: '☕' },
  { id: 'adventurous', label: 'Adventurous', desc: 'Unique & colorful', icon: '🧭' },
  { id: 'wild', label: 'Wild', desc: 'Bizarre & unforgettable', icon: '🌋' },
];

export function ScenarioSetup({ onScenarioReady }: ScenarioSetupProps) {
  const [theme, setTheme] = useState('random');
  const [intensity, setIntensity] = useState<ScenarioIntensity>('adventurous');
  const [customDescription, setCustomDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = theme === 'custom';

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // Determine the theme string to pass to the prompt
      let themeForPrompt: string | undefined;
      const customDesc = isCustom ? customDescription.trim() : undefined;
      if (!isCustom && theme !== 'random') {
        themeForPrompt = theme;
      }

      const prompt = getScenarioGenerationPrompt(themeForPrompt, intensity, customDesc);
      const response = await chatCompletion(
        'You are a world-class creative director who designs immersive role-play scenarios. You create vivid, specific characters with distinct voices and personalities. Respond only with valid JSON.',
        prompt,
      );

      const parsed = JSON.parse(response);

      const systemPrompt = getLiveRoleplaySystemPrompt(
        isCustom ? customDescription.trim() || 'custom' : theme,
        parsed.userRole,
        parsed.aiRole,
        parsed.brandName,
        parsed.location,
        parsed.systemDetails,
        parsed.characterPersonality,
        parsed.characterSpeechStyle,
        parsed.openingLine
      );

      // Start image generation in parallel (non-blocking)
      const imagePromise = generateImage(
        getSceneImagePrompt(parsed.brandName, parsed.location, parsed.aiRole)
      ).catch(() => undefined);

      const scenario: LiveScenario = {
        id: crypto.randomUUID(),
        theme: isCustom ? 'custom' : theme,
        intensity,
        descriptionPt: parsed.descriptionPt,
        systemPrompt,
        brandName: parsed.brandName,
        location: parsed.location,
        userRole: parsed.userRole,
        aiRole: parsed.aiRole,
        characterPersonality: parsed.characterPersonality,
        characterSpeechStyle: parsed.characterSpeechStyle,
      };

      const sceneImageUrl = await imagePromise;
      if (sceneImageUrl) {
        scenario.sceneImageUrl = sceneImageUrl;
      }

      onScenarioReady(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate scenario');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedTheme = THEMES.find(t => t.id === theme);
  const displayIcon = isCustom ? '✏️' : selectedTheme?.icon || '🎲';
  const displayLabel = isCustom ? (customDescription.trim() || 'Custom theme') : selectedTheme?.label || 'Random';

  return (
    <div className="space-y-8">
      {!isGenerating ? (
        <>
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-ink text-balance">
              Where will you go today?
            </h2>
            <p className="text-ink-muted text-pretty max-w-md mx-auto">
              Pick a scene or describe your own, then step into a real conversation.
            </p>
          </div>

          {/* Theme grid */}
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'relative flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all duration-200',
                  'bg-gradient-to-br',
                  t.gradient,
                  'min-h-[110px]',
                  theme === t.id
                    ? 'ring-2 ring-sky shadow-[var(--shadow-md)] scale-[1.02]'
                    : 'shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:scale-[1.01]',
                )}
              >
                <span className="text-3xl">{t.icon}</span>
                <div>
                  <p className="font-bold text-ink text-sm leading-tight">{t.label}</p>
                  <p className="text-ink-muted text-xs mt-0.5">{t.tagline}</p>
                </div>
                {theme === t.id && (
                  <div className="absolute top-2 right-2 size-5 bg-sky rounded-full flex items-center justify-center">
                    <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  </div>
                )}
              </button>
            ))}

            {/* Custom theme card */}
            <button
              onClick={() => setTheme('custom')}
              className={cn(
                'relative flex flex-col items-start gap-2 p-4 rounded-2xl text-left transition-all duration-200 col-span-2',
                'bg-gradient-to-br from-card-warm to-card',
                'min-h-[80px]',
                isCustom
                  ? 'ring-2 ring-coral shadow-[var(--shadow-md)] scale-[1.01]'
                  : 'shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:scale-[1.005]',
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="size-10 rounded-xl bg-coral-soft flex items-center justify-center flex-shrink-0">
                  <Pencil size={20} className="text-coral" />
                </div>
                <div>
                  <p className="font-bold text-ink text-sm leading-tight">Describe Your Own</p>
                  <p className="text-ink-muted text-xs mt-0.5">Type any scenario you want to practice</p>
                </div>
              </div>
              {isCustom && (
                <div className="absolute top-2 right-2 size-5 bg-coral rounded-full flex items-center justify-center">
                  <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {/* Intensity selector */}
          <div className="space-y-3">
            <p className="text-sm font-bold text-ink-secondary text-center">How wild should it be?</p>
            <div className="flex gap-2">
              {INTENSITIES.map(i => (
                <button
                  key={i.id}
                  onClick={() => setIntensity(i.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-200',
                    'border-2',
                    intensity === i.id
                      ? i.id === 'wild'
                        ? 'border-coral bg-coral-soft shadow-[var(--shadow-md)] scale-[1.03]'
                        : i.id === 'adventurous'
                          ? 'border-amber bg-amber-soft shadow-[var(--shadow-md)] scale-[1.03]'
                          : 'border-sky bg-sky-soft shadow-[var(--shadow-md)] scale-[1.03]'
                      : 'border-edge bg-card hover:bg-card-hover',
                  )}
                >
                  <span className="text-2xl">{i.icon}</span>
                  <span className="text-xs font-bold text-ink">{i.label}</span>
                  <span className="text-[10px] text-ink-muted leading-tight">{i.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom description input */}
          {isCustom && (
            <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-md)] space-y-3">
              <label htmlFor="custom-theme" className="block text-sm font-bold text-ink-secondary">
                Describe your scenario
              </label>
              <textarea
                id="custom-theme"
                value={customDescription}
                onChange={e => setCustomDescription(e.target.value)}
                placeholder={"Try something like:\n• Buying a handmade recycled surfboard from an artisan in Hawaii\n• Convincing a street magician in New Orleans to teach you a trick\n• Ordering a mystery tasting menu at a hidden speakeasy in Tokyo\n• Returning a cursed antique at a flea market in Savannah"}
                rows={4}
                className={cn(
                  'w-full px-4 py-3 bg-card-warm border border-edge rounded-xl text-ink placeholder-ink-muted resize-none',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                  'transition-colors text-sm leading-relaxed',
                )}
              />
              <p className="text-xs text-ink-faint">
                Be as specific or as vague as you want. The AI will build a full scene with a memorable character around your idea.
              </p>
            </div>
          )}

          {/* Start button */}
          <Button
            variant="coral"
            size="lg"
            onClick={handleGenerate}
            disabled={isCustom && !customDescription.trim()}
            className="w-full text-lg font-bold py-4 rounded-2xl"
          >
            Step Into the Scene
            <span className="ml-1">{displayIcon}</span>
          </Button>
        </>
      ) : (
        /* Loading state */
        <div className="space-y-6 py-4">
          {/* Animated scene placeholder */}
          <div className="relative overflow-hidden rounded-2xl h-56">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-100 via-card-warm to-sky-100 dark:from-amber-950/30 dark:via-card-warm dark:to-sky-950/30 animate-pulse" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3">
              <div className="relative">
                <Sparkles size={40} className="text-coral animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
              <div>
                <p className="text-ink font-bold text-lg">Building your scene...</p>
                <p className="text-ink-muted text-sm mt-1">
                  {displayIcon} {displayLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Skeleton cards */}
          <div className="space-y-3">
            <div className="h-5 bg-card-hover rounded-lg w-2/3 animate-pulse" />
            <div className="h-4 bg-card-hover rounded-lg w-full animate-pulse" />
            <div className="h-4 bg-card-hover rounded-lg w-4/5 animate-pulse" />
          </div>

          <p className="text-center text-ink-muted text-sm">
            Generating scene illustration & scenario...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-danger-soft border border-danger/30 rounded-xl p-4 text-danger text-sm">{error}</div>
      )}
    </div>
  );
}
