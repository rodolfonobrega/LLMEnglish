import { useState } from 'react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { getTrailsForTheme } from '../../utils/roleplayTrails';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface ScenarioSetupProps {
  onScenarioReady: (scenario: LiveScenario) => void;
}

const THEMES = [
  { id: 'food', label: 'Food & Dining', icon: '🍽️' },
  { id: 'travel', label: 'Travel & Hotels', icon: '✈️' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'work', label: 'Work & Business', icon: '💼' },
  { id: 'health', label: 'Healthcare', icon: '🏥' },
  { id: 'social', label: 'Social & Friends', icon: '👋' },
  { id: 'transport', label: 'Transportation', icon: '🚕' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'education', label: 'Education', icon: '📖' },
  { id: 'random', label: 'Surprise Me!', icon: '🎲' },
  { id: 'custom', label: 'Custom Topic', icon: '✨' },
];

function getSceneImagePrompt(brandName: string, location: string, aiRole: string): string {
  return `A cozy illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work in a warm, inviting interior. Anime/cartoon style, soft lighting, vibrant colors, wide shot, no text overlays, suitable as a background for a language learning app.`;
}

const INTENSITIES: { id: ScenarioIntensity; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Everyday situations' },
  { id: 'adventurous', label: 'Adventurous', desc: 'Unique & colorful' },
  { id: 'wild', label: 'Wild', desc: 'Bizarre & unforgettable' },
];

// ─── Section label ───────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">
      {children}
    </p>
  );
}

export function ScenarioSetup({ onScenarioReady }: ScenarioSetupProps) {
  const [theme, setTheme] = useState('random');
  const [intensity, setIntensity] = useState<ScenarioIntensity>('adventurous');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedTrail, setSelectedTrail] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = theme === 'custom';
  const trails = getTrailsForTheme(theme);
  const showTrails = !isCustom && theme !== 'random' && trails.length > 0;
  const selectedTrailData = showTrails ? trails.find(t => t.id === selectedTrail) : null;
  const selectedStepData = selectedTrailData?.steps.find(s => s.id === selectedStep) ?? null;

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    setSelectedTrail(null);
    setSelectedStep(null);
  };

  const handleGenerate = async () => {
    // Validation: custom needs a description
    if (isCustom && !customDescription.trim()) {
      setError('Please describe your scenario.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      let themeForPrompt: string | undefined;
      let customDesc: string | undefined;
      if (isCustom) {
        customDesc = customDescription.trim();
      } else if (selectedStepData) {
        customDesc = selectedStepData.scenarioContext;
        if (theme !== 'random') themeForPrompt = theme;
      } else {
        if (theme !== 'random') themeForPrompt = theme;
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
  const displayLabel = isCustom ? (customDescription.trim() || 'Custom scenario') : selectedTheme?.label || 'Random';

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-8">
        <div className="relative">
          <div className="size-24 bg-[var(--sky-soft)] rounded-full flex items-center justify-center">
            <Sparkles size={40} className="text-[var(--sky)] animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-foreground font-bold text-xl">Building Scene...</p>
          <p className="text-muted-foreground text-sm">{displayLabel}</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 bg-muted rounded-full w-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
          </div>
          <p className="text-center text-muted-foreground text-xs">
            Generating illustration & persona
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-5 border border-border space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Live Roleplay</h2>
        <p className="text-muted-foreground text-sm">Pick a scene, then step into a real conversation.</p>
      </div>

      {/* THEME SELECTOR (chips, like Discovery) */}
      <div>
        <SectionLabel>Scene / Theme</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer',
                theme === t.id
                  ? 'bg-[var(--sky)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TRAIL SELECTOR - only when theme has trails (non-custom, non-random) */}
      {showTrails && (
        <div>
          <SectionLabel>Scenario Trail</SectionLabel>
          <div className="space-y-3">
            {trails.map(trail => (
              <button
                key={trail.id}
                onClick={() => {
                  setSelectedTrail(trail.id);
                  setSelectedStep('random');
                }}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-colors duration-200 cursor-pointer',
                  selectedTrail === trail.id
                    ? 'bg-[var(--sky-soft)] border-[var(--sky)]'
                    : 'bg-muted/30 border-border hover:bg-accent/50 hover:border-accent',
                )}
              >
                <p className="font-semibold text-foreground">{trail.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{trail.description}</p>
              </button>
            ))}
          </div>

          {selectedTrailData && (
            <div className="mt-4">
              <SectionLabel>Step</SectionLabel>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedStep('random')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer',
                    selectedStep === 'random'
                      ? 'bg-[var(--sky)] text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span>🎲</span>
                  <span>Random</span>
                </button>
                {selectedTrailData.steps.map(step => (
                  <button
                    key={step.id}
                    onClick={() => setSelectedStep(step.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer',
                      selectedStep === step.id
                        ? 'bg-[var(--sky)] text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CUSTOM DESCRIPTION - only when "Custom Topic" is selected */}
      {isCustom && (
        <div>
          <SectionLabel>Describe Your Scenario</SectionLabel>
          <textarea
            value={customDescription}
            onChange={e => setCustomDescription(e.target.value)}
            placeholder="e.g., Returning a faulty blender at a department store, negotiating a discount at a street market in Bangkok..."
            rows={3}
            className={cn(
              'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
              'focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/50 focus:border-[var(--sky)]',
              'transition-colors text-sm leading-relaxed',
            )}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Be as specific or as vague as you want. The AI will build a full scene around your idea.
          </p>
        </div>
      )}

      {/* INTENSITY SELECTOR */}
      <div>
        <SectionLabel>Intensity</SectionLabel>
        <div className="flex gap-2">
          {INTENSITIES.map(i => (
            <button
              key={i.id}
              onClick={() => setIntensity(i.id)}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer text-center',
                intensity === i.id
                  ? 'bg-[var(--sky)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span className="block">{i.label}</span>
              <span className="block text-[10px] font-normal opacity-80 mt-0.5">{i.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GENERATE BUTTON */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={isCustom && !customDescription.trim()}
        className="w-full text-lg font-bold py-4 rounded-2xl"
      >
        <Sparkles size={20} />
        Step Into the Scene
      </Button>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm text-center">{error}</div>
      )}
    </div>
  );
}
