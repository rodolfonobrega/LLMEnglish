import { useState, useEffect } from 'react';
import {
  getModelConfig, saveModelConfig,
  getConversationTone, saveConversationTone,
  saveApiKeys,
} from '../../services/storage';
import { useAuth } from '../../contexts/AuthContext';
import {
  hydrateRuntimeState,
  setRuntimeConversationTone,
  setRuntimeModelConfig,
} from '../../services/runtimeState';
import type { ModelConfig, Source, ModelOption, ConversationTone } from '../../types/settings';
import {
  DEFAULT_MODEL_CONFIG, SOURCE_LABELS,
  CHAT_MODELS, STT_MODELS, TTS_MODELS,
  OPENAI_TTS_VOICES, GEMINI_TTS_VOICES, GROQ_TTS_VOICES,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
} from '../../types/settings';
import { KeyRound, Shield, Save, Check, Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio, ShieldAlert, MessagesSquare, Coffee, Briefcase, Scale, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';

function sourceLabel(source: Source): string {
  return SOURCE_LABELS[source];
}

function ttsVoicesForSource(source: Source) {
  if (source === 'genai' || source === 'vertex') return GEMINI_TTS_VOICES;
  if (source === 'groq') return GROQ_TTS_VOICES;
  return OPENAI_TTS_VOICES;
}

function defaultTtsVoice(source: Source): string {
  if (source === 'genai' || source === 'vertex') return 'Kore';
  if (source === 'groq') return 'hannah';
  return 'alloy';
}

/** Parse composite "source:model" select value. */
function parseComposite(composite: string): { source: Source; model: string } {
  const [source, ...rest] = composite.split(':');
  return { source: source as Source, model: rest.join(':') };
}

/** Build composite "source:model" select value. */
function compositeValue(model: string, source: Source): string {
  return `${source}:${model}`;
}

/** Transform ModelOption[] into flat { value, label } for the Select component. */
function toSelectOptions(models: readonly ModelOption[]) {
  return models.map(m => ({ value: compositeValue(m.value, m.source), label: m.label }));
}

const NONE_OPTION = { value: '', label: 'Nenhum (sem fallback)' };

export function SettingsPage() {
  const { user, profile, signOut: authSignOut, refreshProfile } = useAuth();
  const isDevMode = !import.meta.env.VITE_SUPABASE_URL;
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [geminiKey, setGeminiKeyState] = useState('');
  const [groqKey, setGroqKeyState] = useState('');
  const [openrouterKey, setOpenrouterKeyState] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexRegion, setVertexRegion] = useState('us-central1');
  const [config, setConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [tone, setTone] = useState<ConversationTone>('balanced');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load data from Supabase
    Promise.all([
      getModelConfig(),
      getConversationTone(),
    ]).then(([modelConfig, conversationTone]) => {
      setConfig(modelConfig);
      setTone(conversationTone);
    });
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  const handleChatModelChange = (composite: string) => {
    const { source, model } = parseComposite(composite);
    updateConfig({ chatModel: model, chatSource: source });
  };

  const handleSttModelChange = (composite: string) => {
    const { source, model } = parseComposite(composite);
    updateConfig({ sttModel: model, sttSource: source });
  };

  const handleTtsModelChange = (composite: string) => {
    const { source, model } = parseComposite(composite);
    updateConfig({ ttsModel: model, ttsSource: source, ttsVoice: defaultTtsVoice(source) });
  };

  const handleImageModelChange = (composite: string) => {
    const { source, model } = parseComposite(composite);
    updateConfig({ imageModel: model, imageSource: source as ModelConfig['imageSource'] });
  };

  const handleLiveModelChange = (composite: string) => {
    const { source, model } = parseComposite(composite);
    updateConfig({
      liveModel: model,
      liveSource: source as ModelConfig['liveSource'],
      liveVoice: source === 'openai' ? 'marin' : 'Aoede',
    });
  };

  const handleChatFallbackChange = (composite: string) => {
    if (!composite) {
      updateConfig({ chatFallbackModel: undefined, chatFallbackSource: undefined });
      return;
    }
    const { source, model } = parseComposite(composite);
    updateConfig({ chatFallbackModel: model, chatFallbackSource: source });
  };

  const handleSttFallbackChange = (composite: string) => {
    if (!composite) {
      updateConfig({ sttFallbackModel: undefined, sttFallbackSource: undefined });
      return;
    }
    const { source, model } = parseComposite(composite);
    updateConfig({ sttFallbackModel: model, sttFallbackSource: source });
  };

  const handleTtsFallbackChange = (composite: string) => {
    if (!composite) {
      updateConfig({ ttsFallbackModel: undefined, ttsFallbackSource: undefined, ttsFallbackVoice: undefined });
      return;
    }
    const { source, model } = parseComposite(composite);
    updateConfig({
      ttsFallbackModel: model,
      ttsFallbackSource: source,
      ttsFallbackVoice: defaultTtsVoice(source),
    });
  };

  const ttsVoiceOptions = ttsVoicesForSource(config.ttsSource);
  const liveVoiceOptions = config.liveSource === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;
  const ttsFallbackVoiceOptions = config.ttsFallbackSource
    ? ttsVoicesForSource(config.ttsFallbackSource)
    : [];

  const handleSave = async () => {
    if (isDevMode) return;
    try {
      // Save API keys to Supabase (encrypted via Edge Function)
      if (openaiKey || geminiKey || groqKey || openrouterKey) {
        await saveApiKeys({
          openai: openaiKey || undefined,
          gemini: geminiKey || undefined,
          groq: groqKey || undefined,
          openrouter: openrouterKey || undefined,
        });
      }
      await saveModelConfig(config);
      await saveConversationTone(tone);
      setRuntimeModelConfig(config);
      setRuntimeConversationTone(tone);
      await hydrateRuntimeState();
      await refreshProfile(); // Update profile in auth context
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      // Show error to user
      alert('Erro ao salvar configurações. Tente novamente.');
    }
  };

  const handleLogout = async () => {
    await authSignOut();
    window.location.href = '/login';
  };

  const handleReset = () => setConfig({ ...DEFAULT_MODEL_CONFIG });

  function FallbackSection({
    label,
    modelOptions,
    currentModel,
    currentSource,
    onModelChange,
    voiceOptions,
    currentVoice,
    onVoiceChange,
  }: {
    label: string;
    modelOptions: readonly ModelOption[];
    currentModel: string | undefined;
    currentSource: Source | undefined;
    onModelChange: (composite: string) => void;
    voiceOptions?: { value: string; label: string }[];
    currentVoice?: string;
    onVoiceChange?: (voice: string) => void;
  }) {
    const selectOptions = [NONE_OPTION, ...toSelectOptions(modelOptions)];
    return (
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className={cn('grid gap-3', voiceOptions && currentModel ? 'grid-cols-2' : 'grid-cols-1')}>
          <Select
            label="Modelo Fallback"
            value={currentModel && currentSource ? compositeValue(currentModel, currentSource) : ''}
            options={selectOptions}
            onChange={onModelChange}
            hint={currentSource ? `Source: ${sourceLabel(currentSource)}` : undefined}
          />
          {voiceOptions && currentModel && onVoiceChange && (
            <Select
              label="Voz Fallback"
              value={currentVoice || ''}
              options={voiceOptions}
              onChange={onVoiceChange}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      {/* Header with User Profile */}
      <div className="flex items-center justify-between">
        <div className="text-center space-y-2 flex-1">
          <h2 className="text-3xl font-extrabold text-foreground text-balance">Configurações</h2>
          <p className="text-muted-foreground text-pretty">Configure suas API keys, perfil e modelos de IA.</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>

      {/* User Info Card */}
      <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
        <div className="size-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
          {profile?.email?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{profile?.email || user?.email}</p>
          <p className="text-sm text-muted-foreground">SpeakLab sincronizado na nuvem</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 bg-primary-soft rounded-2xl p-4">
        <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield size={16} className="text-primary" />
        </div>
        <div>
          <h4 className="text-primary font-bold text-sm">Dados Sincronizados</h4>
          <p className="text-muted-foreground text-sm mt-1 text-pretty">
            Suas API keys são armazenadas de forma criptografada na nuvem. Seus dados sincronizam entre dispositivos.
          </p>
        </div>
      </div>

      {/* API Keys */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <KeyRound size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">API Keys</h3>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          {isDevMode && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                API keys loaded from environment variables. Sign in to manage your own keys.
              </p>
            </div>
          )}
          <Input
            label="OpenAI API Key"
            type="password"
            value={openaiKey}
            onChange={e => setOpenaiKeyState(e.target.value)}
            placeholder="sk-..."
            disabled={isDevMode}
            className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
            hint={import.meta.env.VITE_OPENAI_API_KEY && !localStorage.getItem('el_openai_key')
              ? 'Carregada do arquivo .env'
              : 'Obtenha em platform.openai.com/api-keys'}
          />
          <Input
            label="Google Gemini API Key"
            type="password"
            value={geminiKey}
            onChange={e => setGeminiKeyState(e.target.value)}
            placeholder="AI..."
            disabled={isDevMode}
            className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
            hint={import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('el_gemini_key')
              ? 'Carregada do arquivo .env'
              : 'Obtenha em aistudio.google.com/apikey'}
          />
          <Input
            label="Groq API Key"
            type="password"
            value={groqKey}
            onChange={e => setGroqKeyState(e.target.value)}
            placeholder="gsk_..."
            disabled={isDevMode}
            className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
            hint={import.meta.env.VITE_GROQ_API_KEY && !localStorage.getItem('el_groq_key')
              ? 'Carregada do arquivo .env'
              : 'Obtenha em console.groq.com'}
          />
          <Input
            label="OpenRouter API Key"
            type="password"
            value={openrouterKey}
            onChange={e => setOpenrouterKeyState(e.target.value)}
            placeholder="sk-or-..."
            disabled={isDevMode}
            className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
            hint="Obtenha em openrouter.ai/keys"
          />
          <div className="pt-3 border-t border-border/50 space-y-3">
            <p className="text-sm font-medium text-foreground">Vertex AI (Google Cloud)</p>
            <p className="text-xs text-muted-foreground">No API key needed. Uses your Google Cloud project credentials.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Project ID"
                type="text"
                value={vertexProjectId}
                onChange={e => setVertexProjectId(e.target.value)}
                placeholder="my-gcp-project"
                disabled={isDevMode}
                className={cn(isDevMode && 'opacity-50 cursor-not-allowed')}
                hint="Google Cloud project ID"
              />
              <Select
                label="Region"
                value={vertexRegion}
                onChange={v => setVertexRegion(v)}
                options={[
                  { value: 'us-central1', label: 'us-central1 (Iowa)' },
                  { value: 'us-east1', label: 'us-east1 (South Carolina)' },
                  { value: 'europe-west1', label: 'europe-west1 (Belgium)' },
                  { value: 'europe-west4', label: 'europe-west4 (Netherlands)' },
                  { value: 'asia-east1', label: 'asia-east1 (Taiwan)' },
                  { value: 'asia-southeast1', label: 'asia-southeast1 (Singapore)' },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Conversation Tone */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <MessagesSquare size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Tom da Conversa</h3>
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Escolha o tom geral para conversas, exercícios e avaliações da IA no app.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {
              id: 'casual' as const,
              icon: Coffee,
              label: 'Casual',
              desc: 'Inglês do dia a dia. Contrações, gírias, ritmo relaxado. Como conversar com um amigo.',
            },
            {
              id: 'balanced' as const,
              icon: Scale,
              label: 'Equilibrado',
              desc: 'Natural e claro. Conversacional mas bem estruturado. O padrão.',
            },
            {
              id: 'formal' as const,
              icon: Briefcase,
              label: 'Formal',
              desc: 'Profissional e polido. Business English, reuniões, apresentações.',
            },
          ]).map(option => (
            <button
              key={option.id}
              onClick={() => setTone(option.id)}
              className={cn(
                'flex flex-col items-start gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left cursor-pointer',
                tone === option.id
                  ? 'border-primary bg-primary-soft shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className={cn(
                'size-9 rounded-xl flex items-center justify-center',
                tone === option.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              )}>
                <option.icon size={18} />
              </div>
              <div>
                <p className={cn(
                  'font-bold text-sm',
                  tone === option.id ? 'text-primary' : 'text-foreground'
                )}>
                  {option.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.desc}</p>
              </div>
              {tone === option.id && (
                <div className="self-end size-5 bg-primary rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Model Configuration */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
              <Cpu size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Configuração de Modelos</h3>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-semibold cursor-pointer"
          >
            <RotateCcw size={12} />
            Resetar
          </button>
        </div>

        {[
          {
            icon: MessageSquare, color: 'sky' as const, title: 'Geração de Texto',
            desc: 'Gera prompts, avalia fala, cria cenários.',
            content: (
              <>
                <Select label="Modelo" value={compositeValue(config.chatModel, config.chatSource)} options={toSelectOptions(CHAT_MODELS)} onChange={handleChatModelChange}
                  hint={`Source: ${sourceLabel(config.chatSource)}`} />
                <FallbackSection
                  label="Fallback"
                  modelOptions={CHAT_MODELS}
                  currentModel={config.chatFallbackModel}
                  currentSource={config.chatFallbackSource}
                  onModelChange={handleChatFallbackChange}
                />
              </>
            ),
          },
          {
            icon: Mic, color: 'coral' as const, title: 'Fala para Texto (STT)',
            desc: `Transcreve seu áudio falado. Requer key do ${sourceLabel(config.sttSource)}.`,
            content: (
              <>
                <Select label="Modelo" value={compositeValue(config.sttModel, config.sttSource)} options={toSelectOptions(STT_MODELS)} onChange={handleSttModelChange}
                  hint={`Source: ${sourceLabel(config.sttSource)}${config.sttSource === 'genai' || config.sttSource === 'vertex' ? ' (multimodal)' : ''}`} />
                <FallbackSection
                  label="Fallback"
                  modelOptions={STT_MODELS}
                  currentModel={config.sttFallbackModel}
                  currentSource={config.sttFallbackSource}
                  onModelChange={handleSttFallbackChange}
                />
              </>
            ),
          },
          {
            icon: Volume2, color: 'leaf' as const, title: 'Texto para Fala (TTS)',
            desc: `Áudio para frases e correções. Requer key do ${sourceLabel(config.ttsSource)}.`,
            content: (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Modelo" value={compositeValue(config.ttsModel, config.ttsSource)} options={toSelectOptions(TTS_MODELS)} onChange={handleTtsModelChange}
                    hint={`Source: ${sourceLabel(config.ttsSource)}`} />
                  <Select label="Voz" value={config.ttsVoice} options={ttsVoiceOptions} onChange={v => updateConfig({ ttsVoice: v })} />
                </div>
                <FallbackSection
                  label="Fallback"
                  modelOptions={TTS_MODELS}
                  currentModel={config.ttsFallbackModel}
                  currentSource={config.ttsFallbackSource}
                  onModelChange={handleTtsFallbackChange}
                  voiceOptions={ttsFallbackVoiceOptions}
                  currentVoice={config.ttsFallbackVoice}
                  onVoiceChange={v => updateConfig({ ttsFallbackVoice: v })}
                />
              </>
            ),
          },
          {
            icon: ImageIcon, color: 'amber' as const, title: 'Geração de Imagem',
            desc: 'Gera imagens para o modo de Desafio Visual.',
            content: (
              <Select label="Modelo" value={compositeValue(config.imageModel, config.imageSource)} options={toSelectOptions(IMAGE_MODELS)} onChange={handleImageModelChange}
                hint={`Source: ${sourceLabel(config.imageSource)}`} />
            ),
          },
          {
            icon: Radio, color: 'coral' as const, title: 'Simulação ao Vivo',
            desc: `Conversa de áudio em tempo real. Requer key do ${sourceLabel(config.liveSource)}.`,
            content: (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Modelo" value={compositeValue(config.liveModel, config.liveSource)} options={toSelectOptions(LIVE_MODELS)} onChange={handleLiveModelChange}
                  hint={`Source: ${config.liveSource === 'openai' ? 'OpenAI Realtime' : 'Gemini Live'}`} />
                <Select label="Voz" value={config.liveVoice} options={liveVoiceOptions} onChange={v => updateConfig({ liveVoice: v })} />
              </div>
            ),
          },
        ].map(section => {
          const colorMap = {
            sky: { bg: 'bg-primary-soft', text: 'text-primary' },
            coral: { bg: 'bg-primary-soft', text: 'text-primary' },
            leaf: { bg: 'bg-leaf-soft', text: 'text-leaf' },
            amber: { bg: 'bg-[var(--amber-soft)]', text: 'text-[var(--amber)]' },
          };
          const colors = colorMap[section.color];
          return (
            <div key={section.title} className="bg-card rounded-2xl p-5 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('size-7 rounded-full flex items-center justify-center', colors.bg)}>
                  <section.icon size={14} className={colors.text} />
                </div>
                <h4 className={cn('text-sm font-bold uppercase tracking-wide', colors.text)}>{section.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground text-pretty">{section.desc}</p>
              {section.content}
            </div>
          );
        })}
      </section>

      {/* Save */}
      <Button
        variant={saved ? 'primary' : 'coral'}
        size="lg"
        onClick={handleSave}
        className={cn('w-full text-lg font-bold py-4 rounded-2xl cursor-pointer', saved && 'bg-leaf hover:bg-leaf')}
      >
        {saved ? <Check size={20} /> : <Save size={20} />}
        {saved ? 'Salvo!' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
