import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatCompletion, generateImage } from '../../services/openai';
import { getImageConfigAuto } from '../../config/images';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt, getSkillScenarioPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { getConversationTone } from '../../services/storage';
import type { ConversationTone } from '../../types/settings';
import { Sparkles, Briefcase, Coffee, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { ThemeSelector } from '../shared/ThemeSelector';
import { SelectionDot } from '../shared/SelectionDot';

interface ScenarioSetupProps {
  onScenarioReady: (scenario: LiveScenario) => void;
}

type SimulationMode = 'everyday' | 'skill';
type SetupStep = 'mode' | 'theme' | 'generate';

const INTENSITIES: { id: ScenarioIntensity; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Situações do dia a dia' },
  { id: 'adventurous', label: 'Aventureiro', desc: 'Únicas e coloridas' },
  { id: 'wild', label: 'Insano', desc: 'Bizarras e inesquecíveis' },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">
      {children}
    </p>
  );
}

function getSceneImagePrompt(brandName: string, location: string, aiRole: string, isSkill: boolean): string {
  const style = isSkill
    ? 'Professional, clean, well-lit modern office or professional setting.'
    : 'Cozy, warm, inviting interior.';
  return `A ${style} illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work. Soft anime/cartoon style inspired by Studio Ghibli. Soft natural lighting, warm but NOT amber or sepia-toned. Color palette with wood browns, leafy greens, warm cream, soft pink, muted teal. Natural color variety, gentle bokeh, soft linework, no detailed faces, wide shot, no text overlays.`;
}

export function ScenarioSetup({ onScenarioReady }: ScenarioSetupProps) {
  const [searchParams] = useSearchParams();
  const initialMode: SimulationMode = searchParams.get('scenario') === 'interview' ? 'skill' : 'everyday';

  const [mode, setMode] = useState<SimulationMode>(initialMode);
  const [setupStep, setSetupStep] = useState<SetupStep>('mode');
  const [theme, setTheme] = useState<string | null>('random');
  const [intensity, setIntensity] = useState<ScenarioIntensity>('adventurous');
  const [customDescription, setCustomDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<ConversationTone>('balanced');

  useEffect(() => {
    void (async () => {
      const conversationTone = await getConversationTone();
      setTone(conversationTone);
    })();
  }, [mode]);

  const isCustom = theme === 'custom';
  const totalSteps = mode === 'everyday' ? 3 : 2;

  const getStepIndex = (): number => {
    if (setupStep === 'mode') return 0;
    if (setupStep === 'theme') return 1;
    if (setupStep === 'generate') return mode === 'everyday' ? 2 : 1;
    return 0;
  };

  const stepLabels = mode === 'everyday'
    ? ['Modo', 'Tema', 'Gerar']
    : ['Modo', 'Gerar'];

  const handleContinueFromMode = () => {
    if (mode === 'skill' && !customDescription.trim()) {
      setError('Descreva a entrevista ou cenário profissional que quer praticar.');
      return;
    }
    setError(null);
    setSetupStep(mode === 'everyday' ? 'theme' : 'generate');
  };

  const handleContinueFromTheme = () => {
    if (isCustom && !customDescription.trim()) {
      setError('Descreva o cenário que você quer praticar.');
      return;
    }
    setError(null);
    setSetupStep('generate');
  };

  const handleGenerate = async () => {
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
        } else {
          if (theme !== 'random') themeForPrompt = theme ?? undefined;
        }
        prompt = getScenarioGenerationPrompt(themeForPrompt, intensity, customDesc, tone);
      } else {
        activeTheme = 'custom';
        prompt = getSkillScenarioPrompt(
          customDescription.trim(),
          tone
        );
      }

      const response = await chatCompletion(
        'You are a world-class creative director who designs immersive role-play scenarios. You create vivid, specific characters with distinct voices and personalities. Respond only with valid JSON.',
        prompt,
      );

      const cleanResponse = cleanJson(response);
      const parsed = JSON.parse(cleanResponse);

      const systemPrompt = getLiveRoleplaySystemPrompt(
        mode === 'skill' ? 'Professional Interview/Skill Practice' : (isCustom ? customDescription.trim() || 'custom' : theme ?? 'random'),
        parsed.userRole,
        parsed.aiRole,
        parsed.brandName,
        parsed.location,
        parsed.systemDetails,
        parsed.characterPersonality,
        parsed.characterSpeechStyle,
        parsed.openingLine,
        tone
      );

      const imagePromise = generateImage(
        getSceneImagePrompt(parsed.brandName, parsed.location, parsed.aiRole, mode === 'skill'),
        getImageConfigAuto('scenarioThumbnail')
      ).catch(() => undefined);

      const scenario: LiveScenario = {
        id: crypto.randomUUID(),
        theme: activeTheme ?? 'random',
        intensity: mode === 'skill' ? 'skill' : intensity,
        descriptionPt: parsed.descriptionPt,
        systemPrompt,
        brandName: parsed.brandName,
        location: parsed.location,
        userRole: parsed.userRole,
        aiRole: parsed.aiRole,
        characterPersonality: parsed.characterPersonality,
        characterSpeechStyle: parsed.characterSpeechStyle,
        suggestedVoice: parsed.suggestedVoice,
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

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-8">
        <div className="relative">
          <div className="size-24 bg-primary-soft rounded-full flex items-center justify-center">
            <Sparkles size={40} className="text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-foreground font-bold text-xl">Montando a Cena...</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 bg-muted rounded-full w-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
          </div>
          <p className="text-center text-muted-foreground text-xs">Gerando ilustração e personagem</p>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex();

  return (
    <div className="bg-card rounded-2xl p-5 border border-border space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={cn(
              'flex-1 h-1.5 rounded-full transition-colors duration-300',
              i <= stepIndex ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>

      {/* Step: Mode */}
      {setupStep === 'mode' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Modo de simulação</h3>
            <p className="text-sm text-muted-foreground mt-1">Como você quer praticar?</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('everyday')}
              className={cn(
                'relative flex flex-col items-center gap-2 py-5 px-3 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer border-2',
                mode === 'everyday'
                  ? 'bg-card border-primary shadow-md'
                  : 'bg-card border-secondary hover:shadow-md hover:scale-[1.02]',
              )}
            >
              {mode === 'everyday' && <SelectionDot />}
              <Coffee size={24} />
              <span className="text-center">Cenários do Dia a Dia</span>
            </button>

            <button
              onClick={() => setMode('skill')}
              className={cn(
                'relative flex flex-col items-center gap-2 py-5 px-3 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer border-2',
                mode === 'skill'
                  ? 'bg-card border-primary shadow-md'
                  : 'bg-card border-secondary hover:shadow-md hover:scale-[1.02]',
              )}
            >
              {mode === 'skill' && <SelectionDot />}
              <Briefcase size={24} />
              <span className="text-center">Entrevista & Profissional</span>
            </button>
          </div>

          {mode === 'skill' && (
            <div className="space-y-3">
              <SectionLabel>Descreva a Entrevista / Cenário Profissional</SectionLabel>
              <textarea
                value={customDescription}
                onChange={e => setCustomDescription(e.target.value)}
                placeholder="Descreva o cenário. Inclua seu cargo e área para um treino mais realista. Ex: Entrevista técnica para Senior Front-End, tenho 5 anos com React e TypeScript."
                rows={3}
                className={cn(
                  'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'transition-colors text-sm leading-relaxed',
                )}
              />
            </div>
          )}

          <Button
            variant="coral"
            size="lg"
            onClick={handleContinueFromMode}
            className="w-full rounded-2xl cursor-pointer"
          >
            Continuar
            <ChevronRight size={18} />
          </Button>
        </div>
      )}

      {/* Step: Theme (everyday only) */}
      {setupStep === 'theme' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Cena e tema</h3>
            <p className="text-sm text-muted-foreground mt-1">Sobre o que você quer conversar?</p>
          </div>

          <ThemeSelector
            selected={theme || ''}
            onSelect={(t) => setTheme(t)}
          />

          {isCustom && (
            <div className="pt-2">
              <SectionLabel>Descreva Seu Cenário</SectionLabel>
              <textarea
                value={customDescription}
                onChange={e => setCustomDescription(e.target.value)}
                placeholder="ex: Devolver um liquidificador com defeito numa loja, pechinchar num mercado de rua..."
                rows={3}
                className={cn(
                  'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
                  'transition-colors text-sm leading-relaxed',
                )}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setSetupStep('mode')}
              className="flex-1 rounded-2xl cursor-pointer"
            >
              <ChevronLeft size={18} />
              Voltar
            </Button>
            <Button
              variant="coral"
              size="lg"
              onClick={handleContinueFromTheme}
              className="flex-1 rounded-2xl cursor-pointer"
            >
              Continuar
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Generate */}
      {setupStep === 'generate' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {mode === 'skill' ? 'Tudo pronto!' : 'Intensidade e gerar'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'skill' ? 'Revise e inicie seu treino.' : 'Escolha a intensidade e entre na cena.'}
            </p>
          </div>

          {mode === 'everyday' && (
            <div className="space-y-2.5">
              <SectionLabel>Intensidade</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {INTENSITIES.map(i => (
                  <button
                    key={i.id}
                    onClick={() => setIntensity(i.id)}
                    className={cn(
                      'relative flex-1 py-3 px-3 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer text-center border-2',
                      intensity === i.id
                        ? 'bg-card border-primary shadow-md'
                        : 'bg-card border-secondary hover:shadow-md hover:scale-[1.02]',
                    )}
                  >
                    {intensity === i.id && <SelectionDot />}
                    <span className="block text-foreground">{i.label}</span>
                    <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">{i.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
              {mode === 'everyday' ? <Coffee size={14} /> : <Briefcase size={14} />}
              {mode === 'everyday' ? 'Dia a Dia' : 'Profissional'}
            </span>
            {mode === 'everyday' && theme && theme !== 'random' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                Tema: {theme}
              </span>
            )}
          </div>

          {mode === 'skill' && customDescription.trim() && (
            <div className="bg-muted/30 border border-input rounded-xl p-4 text-sm text-foreground">
              <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mb-1.5">Seu cenário</p>
              <p className="line-clamp-3">{customDescription.trim()}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setSetupStep(mode === 'everyday' ? 'theme' : 'mode')}
              className="flex-1 rounded-2xl cursor-pointer"
            >
              <ChevronLeft size={18} />
              Voltar
            </Button>
            <Button
              variant="coral"
              size="lg"
              onClick={() => { void handleGenerate(); }}
              className="flex-1 text-lg font-bold py-4 rounded-2xl cursor-pointer"
            >
              {mode === 'skill' ? <Briefcase size={20} /> : <Sparkles size={20} />}
              {mode === 'skill' ? 'Iniciar Treino' : 'Entrar na Cena'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-2xl p-4 text-[var(--danger)] text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
