import { useState } from 'react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { Sparkles, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../utils/cn';

interface ScenarioSetupProps {
  onScenarioReady: (scenario: LiveScenario) => void;
}

const THEMES = [
  { id: 'food', label: 'Food & Dining', tagline: 'Order like a local', icon: '🍽️', gradient: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20', activeClass: 'ring-orange-200 bg-orange-50' },
  { id: 'travel', label: 'Travel & Hotels', tagline: 'Check in, explore', icon: '✈️', gradient: 'from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20', activeClass: 'ring-sky-200 bg-sky-50' },
  { id: 'shopping', label: 'Shopping', tagline: 'Find the perfect deal', icon: '🛍️', gradient: 'from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/20', activeClass: 'ring-pink-200 bg-pink-50' },
  { id: 'work', label: 'Work & Business', tagline: 'Nail that meeting', icon: '💼', gradient: 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/20', activeClass: 'ring-slate-200 bg-slate-50' },
  { id: 'health', label: 'Healthcare', tagline: 'Describe your symptoms', icon: '🏥', gradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20', activeClass: 'ring-emerald-200 bg-emerald-50' },
  { id: 'social', label: 'Social & Friends', tagline: 'Make conversation flow', icon: '👋', gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20', activeClass: 'ring-violet-200 bg-violet-50' },
  { id: 'transport', label: 'Transportation', tagline: 'Get where you need to go', icon: '🚕', gradient: 'from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/20', activeClass: 'ring-yellow-200 bg-yellow-50' },
  { id: 'entertainment', label: 'Entertainment', tagline: 'Book tickets & events', icon: '🎬', gradient: 'from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20', activeClass: 'ring-red-200 bg-red-50' },
  { id: 'education', label: 'Education', tagline: 'Campus life & classes', icon: '📖', gradient: 'from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20', activeClass: 'ring-indigo-200 bg-indigo-50' },
  { id: 'random', label: 'Surprise Me!', tagline: 'A random adventure', icon: '🎲', gradient: 'from-fuchsia-50 to-pink-50 dark:from-fuchsia-950/30 dark:to-pink-950/20', activeClass: 'ring-fuchsia-200 bg-fuchsia-50' },
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

      const cleanResponse = cleanJson(response);
      const parsed = JSON.parse(cleanResponse);

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
    <div className="space-y-8 animate-in fade-in duration-500">
      {!isGenerating ? (
        <>
          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Where will you go today?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Pick a scene or describe your own, then step into a real conversation.
            </p>
          </div>

          {/* Theme grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {THEMES.map(t => (
              <Card
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-transparent',
                  'bg-gradient-to-br',
                  t.gradient,
                  theme === t.id
                    ? cn('ring-2 ring-primary shadow-md scale-[1.02]', t.activeClass)
                    : 'hover:bg-opacity-80',
                )}
              >
                <CardContent className="p-4 flex flex-col items-start gap-3 h-full justify-between">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t.label}</p>
                    <p className="text-muted-foreground/80 text-xs mt-0.5">{t.tagline}</p>
                  </div>
                  {theme === t.id && (
                    <div className="absolute top-2 right-2 size-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Custom theme & Intensity row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Custom theme */}
            <Card
              onClick={() => setTheme('custom')}
              className={cn(
                'cursor-pointer transition-all duration-200 md:col-span-2 border-dashed border-2',
                isCustom
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <CardContent className="p-6 flex items-center gap-4 h-full">
                <div className={cn("size-12 rounded-full flex items-center justify-center flex-shrink-0", isCustom ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Pencil size={20} />
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">Describe Your Own</p>
                  <p className="text-muted-foreground text-sm">Type any scenario you want to practice</p>
                </div>
                {isCustom && (
                  <div className="ml-auto size-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="size-3.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Intensity selector */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground ml-1">Intensity</p>
              <div className="flex flex-col gap-2">
                {INTENSITIES.map(i => (
                  <button
                    key={i.id}
                    onClick={() => setIntensity(i.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-all duration-200 border text-left',
                      intensity === i.id
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="text-xl">{i.icon}</span>
                    <div>
                      <span className="text-sm font-semibold block">{i.label}</span>
                      <span className="text-[10px] text-muted-foreground/80 leading-tight">{i.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>


          {/* Custom description input */}
          {isCustom && (
            <Card className="animate-in slide-in-from-top-2 duration-300 border-primary/20 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <label htmlFor="custom-theme" className="block text-sm font-bold text-foreground">
                  Describe your scenario
                </label>
                <textarea
                  id="custom-theme"
                  value={customDescription}
                  onChange={e => setCustomDescription(e.target.value)}
                  placeholder={"Try something like:\n• Buying a handmade recycled surfboard from an artisan in Hawaii\n• Convincing a street magician in New Orleans to teach you a trick\n• Ordering a mystery tasting menu at a hidden speakeasy in Tokyo\n• Returning a cursed antique at a flea market in Savannah"}
                  rows={4}
                  className={cn(
                    'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                    'transition-colors text-sm leading-relaxed',
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Be as specific or as vague as you want. The AI will build a full scene with a memorable character around your idea.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Start button */}
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={isCustom && !customDescription.trim()}
            className="w-full text-lg font-bold py-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Step Into the Scene
            <span className="ml-2">{displayIcon}</span>
          </Button>
        </>
      ) : (
        /* Loading state */
        <Card className="p-8 border-none shadow-none bg-transparent">
          <div className="space-y-8 py-8 flex flex-col items-center justify-center">
            {/* Animated scene placeholder */}
            <div className="relative overflow-hidden rounded-full size-64 shadow-2xl ring-4 ring-background">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-spin-slow opacity-20" />
              <div className="absolute inset-2 bg-background rounded-full flex flex-col items-center justify-center text-center p-6 bg-slate-50">
                <div className="relative mb-4">
                  <Sparkles size={48} className="text-primary animate-bounce decoration-clone" style={{ animationDuration: '2s' }} />
                </div>
                <div>
                  <p className="text-foreground font-bold text-xl mb-1">Building Scene...</p>
                  <p className="text-muted-foreground text-sm font-medium px-4">
                    {displayIcon} {displayLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <div className="h-2 bg-muted rounded-full w-full overflow-hidden">
                <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
              </div>
              <p className="text-center text-muted-foreground text-xs font-mono uppercase tracking-wider">
                Generating illustration & persona
              </p>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm text-center">{error}</div>
      )}
    </div>
  );
}
