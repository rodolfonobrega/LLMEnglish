import { useState, useEffect } from 'react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getImageConfigAuto } from '../../config/images';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt, getSkillScenarioPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { getTrailsForTheme } from '../../utils/roleplayTrails';
import { getUserContext, type UserContext } from '../../services/storage';
import { Sparkles, Briefcase, Coffee, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { Link } from 'react-router-dom';

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

function getSceneImagePrompt(brandName: string, location: string, aiRole: string, isSkill: boolean): string {
  const style = isSkill
    ? 'Professional, clean, corporate illustration, well-lit modern office or professional setting.'
    : 'Cozy, warm, inviting interior.';
  return `A ${style} illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work. Anime/cartoon style, soft lighting, vibrant colors, wide shot, no text overlays, suitable as a background for an app.`;
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

type SimulationMode = 'everyday' | 'skill';

export function ScenarioSetup({ onScenarioReady }: ScenarioSetupProps) {
  const [mode, setMode] = useState<SimulationMode>('everyday');
  const [theme, setTheme] = useState('random');
  const [intensity, setIntensity] = useState<ScenarioIntensity>('adventurous');
  const [customDescription, setCustomDescription] = useState('');
  const [selectedTrail, setSelectedTrail] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  useEffect(() => {
    setUserContext(getUserContext());
  }, [mode]);

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
    // Validation:
    if (mode === 'everyday' && isCustom && !customDescription.trim()) {
      setError('Please describe your scenario.');
      return;
    }
    if (mode === 'skill' && !customDescription.trim()) {
      setError('Please describe the interview or skill scenario you want to practice.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      let prompt = '';
      let activeTheme = theme;

      if (mode === 'everyday') {
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
        prompt = getScenarioGenerationPrompt(themeForPrompt, intensity, customDesc);
      } else {
        activeTheme = 'custom';
        prompt = getSkillScenarioPrompt(
          customDescription.trim(),
          userContext?.profile || '',
          userContext?.currentLevel || 'Intermediate',
          userContext?.goals || ''
        );
      }

      const response = await chatCompletion(
        'You are a world-class creative director who designs immersive role-play scenarios. You create vivid, specific characters with distinct voices and personalities. Respond only with valid JSON.',
        prompt,
      );

      const cleanResponse = cleanJson(response);
      const parsed = JSON.parse(cleanResponse);

      const systemPrompt = getLiveRoleplaySystemPrompt(
        mode === 'skill' ? 'Professional Interview/Skill Practice' : (isCustom ? customDescription.trim() || 'custom' : theme),
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
        getSceneImagePrompt(parsed.brandName, parsed.location, parsed.aiRole, mode === 'skill'),
        getImageConfigAuto('scenarioThumbnail')
      ).catch(() => undefined);

      const scenario: LiveScenario = {
        id: crypto.randomUUID(),
        theme: activeTheme,
        intensity: mode === 'skill' ? 'skill' : intensity,
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
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Live Simulation</h2>
          <p className="text-muted-foreground text-sm">Step into a real conversation.</p>
        </div>

        <div className="flex bg-muted p-1 rounded-xl w-fit">
          <button
            onClick={() => setMode('everyday')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2',
              mode === 'everyday' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Coffee size={16} /> Everyday Scenarios
          </button>
          <button
            onClick={() => setMode('skill')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2',
              mode === 'skill' ? 'bg-background text-[var(--sky)] shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Briefcase size={16} /> Skill & Interview
          </button>
        </div>
      </div>

      {mode === 'skill' && (
        <div className="bg-[var(--sky-soft)] border border-[var(--sky)]/20 rounded-xl p-4 flex gap-3 text-sm text-[var(--sky-dark)]">
          <UserIcon size={20} className="shrink-0 text-[var(--sky)]" />
          <p>
            <strong>Skill Simulator</strong> will use your saved Profile (Current Level: {userContext?.currentLevel || 'Intermediate'}) to generate a highly realistic interview or professional simulation. You can update your context in the <Link to="/practice" className="underline font-bold">Practice area</Link>.
          </p>
        </div>
      )}

      {/* THEME SELECTOR (chips, like Discovery) */}
      {mode === 'everyday' && (
        <div className="space-y-6">
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
        </div>
      )}

      {/* CUSTOM DESCRIPTION - only when "Custom Topic" is selected or Skill Mode is active */}
      {(isCustom || mode === 'skill') && (
        <div>
          <SectionLabel>{mode === 'skill' ? 'Describe the Interview / Skill Scenario' : 'Describe Your Scenario'}</SectionLabel>
          <textarea
            value={customDescription}
            onChange={e => setCustomDescription(e.target.value)}
            placeholder={mode === 'skill'
              ? "e.g., Technical interview with a recruiter at Google for a Front-End position. Ask me about React."
              : "e.g., Returning a faulty blender at a department store, negotiating a discount at a street market in Bangkok..."}
            rows={4}
            className={cn(
              'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
              'focus:outline-none focus:ring-2 focus:ring-[var(--sky)]/50 focus:border-[var(--sky)]',
              'transition-colors text-sm leading-relaxed',
            )}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {mode === 'skill'
              ? "The AI will act as the interviewer or expert and will grill you based on your profile context."
              : "Be as specific or as vague as you want. The AI will build a full scene around your idea."}
          </p>
        </div>
      )}

      {/* INTENSITY SELECTOR - Only for everyday mode */}
      {mode === 'everyday' && (
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
      )}

      {/* GENERATE BUTTON */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={(mode === 'everyday' && isCustom && !customDescription.trim()) || (mode === 'skill' && !customDescription.trim())}
        className="w-full text-lg font-bold py-4 rounded-2xl"
      >
        {mode === 'skill' ? <Briefcase size={20} /> : <Sparkles size={20} />}
        {mode === 'skill' ? 'Start Training' : 'Step Into the Scene'}
      </Button>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm text-center">{error}</div>
      )}
    </div>
  );
}
