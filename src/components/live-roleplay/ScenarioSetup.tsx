import { useState, useEffect } from 'react';
import { chatCompletion, generateImage } from '../../services/openai';
import { getImageConfigAuto } from '../../config/images';
import { getScenarioGenerationPrompt, getLiveRoleplaySystemPrompt, getSkillScenarioPrompt } from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import type { LiveScenario, ScenarioIntensity } from '../../types/scenario';
import { getUserContext } from '../../services/supabase/storage';
import type { UserContext } from '../../types/settings';
import { Sparkles, Briefcase, Coffee, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { Link } from 'react-router-dom';
import { liveSetupScenarios } from '../../config/practice';

interface ScenarioSetupProps {
  onScenarioReady: (scenario: LiveScenario) => void;
}

const THEMES = [
  { id: 'food', label: 'Comida & Restaurantes', icon: '🍽️' },
  { id: 'travel', label: 'Viagem & Hotéis', icon: '✈️' },
  { id: 'shopping', label: 'Compras', icon: '🛍️' },
  { id: 'work', label: 'Trabalho & Negócios', icon: '💼' },
  { id: 'health', label: 'Saúde', icon: '🏥' },
  { id: 'social', label: 'Social & Amigos', icon: '👋' },
  { id: 'transport', label: 'Transporte', icon: '🚕' },
  { id: 'entertainment', label: 'Entretenimento', icon: '🎬' },
  { id: 'education', label: 'Educação', icon: '📖' },
  { id: 'random', label: 'Surpreenda-me!', icon: '🎲' },
  { id: 'custom', label: 'Tópico Livre', icon: '✨' },
];

function getSceneImagePrompt(brandName: string, location: string, aiRole: string, isSkill: boolean): string {
  const style = isSkill
    ? 'Professional, clean, corporate illustration, well-lit modern office or professional setting.'
    : 'Cozy, warm, inviting interior.';
  return `A ${style} illustration of ${brandName} in ${location}. The scene shows a ${aiRole} at work. Anime/cartoon style, soft lighting, vibrant colors, wide shot, no text overlays, suitable as a background for an app.`;
}

const INTENSITIES: { id: ScenarioIntensity; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Situações do dia a dia' },
  { id: 'adventurous', label: 'Aventureiro', desc: 'Únicas e coloridas' },
  { id: 'wild', label: 'Insano', desc: 'Bizarras e inesquecíveis' },
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

const MODE_ICONS: Record<SimulationMode, React.ReactNode> = {
  everyday: <Coffee size={16} />,
  skill: <Briefcase size={16} />,
};

const MODE_LABELS: Record<SimulationMode, string> = {
  everyday: 'Cenários do Dia a Dia',
  skill: 'Entrevista & Profissional',
};

export function ScenarioSetup({ onScenarioReady }: ScenarioSetupProps) {
  const [mode, setMode] = useState<SimulationMode>('everyday');
  const [theme, setTheme] = useState('random');
  const [intensity, setIntensity] = useState<ScenarioIntensity>('adventurous');
  const [customDescription, setCustomDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  useEffect(() => {
    void (async () => {
      setUserContext(await getUserContext())
    })()
  }, [mode]);

  const isCustom = theme === 'custom';

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleGenerate = async () => {
    // Validation:
    if (mode === 'everyday' && isCustom && !customDescription.trim()) {
      setError('Descreva o cenário que você quer praticar.');
      return;
    }
    if (mode === 'skill' && !customDescription.trim()) {
      setError('Descreva a entrevista ou cenário profissional que quer praticar.');
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

  const selectedTheme = THEMES.find(t => t.id === theme);
  const displayLabel = isCustom ? (customDescription.trim() || 'Custom scenario') : selectedTheme?.label || 'Random';

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-8">
        <div className="relative">
          <div className="size-24 bg-[hsl(var(--sky-soft))] rounded-full flex items-center justify-center">
            <Sparkles size={40} className="text-[hsl(var(--sky))] animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-foreground font-bold text-xl">Montando a Cena...</p>
          <p className="text-muted-foreground text-sm">{displayLabel}</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="h-2 bg-muted rounded-full w-full overflow-hidden">
            <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
          </div>
          <p className="text-center text-muted-foreground text-xs">
            Gerando ilustração e personagem
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stage 1: Mode ─────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
        <SectionLabel>Modo</SectionLabel>
        <div className="flex bg-muted p-1 rounded-xl w-full">
          {liveSetupScenarios.map(m => {
            const mId = m.id as SimulationMode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(mId)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                  mode === mId ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {MODE_ICONS[mId]}
                {MODE_LABELS[mId]}
              </button>
            );
          })}
        </div>

        {mode === 'skill' && (
          <div className="bg-[hsl(var(--sky-soft))] border border-[hsl(var(--sky))]/20 rounded-xl p-4 flex gap-3 text-sm text-[var(--sky-dark)]">
            <UserIcon size={20} className="shrink-0 text-[hsl(var(--sky))]" />
            <p>
              <strong>Simulador Profissional</strong> vai usar seu Perfil salvo (Nível: {userContext?.currentLevel || 'Intermediate'}) para gerar uma entrevista ou simulação profissional realista. Atualize seu perfil em <Link to="/settings" className="underline font-bold">Configurações</Link>.
            </p>
          </div>
        )}
      </section>

      {/* ── Stage 2: Theme (everyday only) ────────────────────────── */}
      {mode === 'everyday' && (
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <SectionLabel>Cena / Tema</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer',
                  theme === t.id
                    ? 'bg-[hsl(var(--sky))] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Stage 3: Custom description / intensity ───────────────── */}
      {(isCustom || mode === 'skill') && (
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <SectionLabel>{mode === 'skill' ? 'Descreva a Entrevista / Cenário Profissional' : 'Descreva Seu Cenário'}</SectionLabel>
          <textarea
            value={customDescription}
            onChange={e => setCustomDescription(e.target.value)}
            placeholder={mode === 'skill'
              ? "ex: Entrevista técnica com um recrutador do Google para vaga de Front-End. Me pergunte sobre React."
              : "ex: Devolver um liquidificador com defeito numa loja, pechinchar num mercado de rua em Bangkok..."}
            rows={4}
            className={cn(
              'w-full px-4 py-3 bg-muted/30 border border-input rounded-xl text-foreground placeholder:text-muted-foreground/60 resize-none',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sky))]/50 focus:border-[hsl(var(--sky))]',
              'transition-colors text-sm leading-relaxed',
            )}
          />
          <p className="text-xs text-muted-foreground">
            {mode === 'skill'
              ? "A IA vai atuar como entrevistador ou especialista e vai te pressionar baseado no seu perfil."
              : "Seja tão específico ou vago quanto quiser. A IA vai montar uma cena completa em cima da sua ideia."}
          </p>
        </section>
      )}

      {/* Intensity selector - only for everyday mode */}
      {mode === 'everyday' && (
        <section className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <SectionLabel>Intensidade</SectionLabel>
          <div className="flex gap-2">
            {INTENSITIES.map(i => (
              <button
                key={i.id}
                onClick={() => setIntensity(i.id)}
                className={cn(
                  'flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer text-center',
                  intensity === i.id
                    ? 'bg-[hsl(var(--sky))] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span className="block">{i.label}</span>
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">{i.desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Stage 4: CTA ──────────────────────────────────────────── */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={(mode === 'everyday' && isCustom && !customDescription.trim()) || (mode === 'skill' && !customDescription.trim())}
        className="w-full text-lg font-bold py-4 rounded-2xl"
      >
        {mode === 'skill' ? <Briefcase size={20} /> : <Sparkles size={20} />}
        {mode === 'skill' ? 'Iniciar Treino' : 'Entrar na Cena'}
      </Button>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm text-center">{error}</div>
      )}
    </div>
  );
}
