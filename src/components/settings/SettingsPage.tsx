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
  defaultTtsVoice, normalizeTtsVoice, ttsVoicesForSource,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
  sourcesFromModels,
} from '../../types/settings';
import { KeyRound, Shield, Save, Check, Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio, ShieldAlert, MessagesSquare, Coffee, Briefcase, Scale, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip';
import { cn } from '../../utils/cn';
import { isKnownModel } from '../../services/modelCatalog';

function firstModelForSource(models: readonly ModelOption[], source: Source): string {
  return models.find(m => m.source === source)?.value ?? models[0].value;
}

/** Non-blocking warning badge for model+source combos not in the catalog. */
function ModelWarningBadge({ modelId, source }: { modelId: string; source: Source }) {
  if (isKnownModel(modelId, source)) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle size={14} className="text-amber-500 inline-block ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent>This model may not be recognized by the app.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Two-dropdown model selector: Provider → Model (filtered by provider). */
function ModelSelect({
  sources,
  models,
  currentSource,
  currentModel,
  onSourceChange,
  onModelChange,
  label,
}: {
  sources: readonly Source[];
  models: readonly ModelOption[];
  currentSource: Source;
  currentModel: string;
  onSourceChange: (source: Source) => void;
  onModelChange: (source: Source, model: string) => void;
  label: string;
}) {
  const filteredModels = models.filter(m => m.source === currentSource);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={`${label} - Provedor`}
          value={currentSource}
          options={sources.map(s => ({ value: s, label: SOURCE_LABELS[s] }))}
          onChange={v => onSourceChange(v as Source)}
        />
        <Select
          label={`${label} - Modelo`}
          value={currentModel}
          options={filteredModels.map(m => ({ value: m.value, label: m.label }))}
          onChange={v => onModelChange(currentSource, v)}
        />
      </div>
      <ModelWarningBadge modelId={currentModel} source={currentSource} />
    </div>
  );
}

const CHAT_SOURCES = sourcesFromModels(CHAT_MODELS);
const STT_SOURCES = sourcesFromModels(STT_MODELS);
const TTS_SOURCES = sourcesFromModels(TTS_MODELS);
const IMAGE_SOURCES = sourcesFromModels(IMAGE_MODELS);
const LIVE_SOURCES = sourcesFromModels(LIVE_MODELS);

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getModelConfig(),
      getConversationTone(),
    ]).then(([modelConfig, conversationTone]) => {
      setConfig({
        ...modelConfig,
        ttsVoice: normalizeTtsVoice(modelConfig.ttsSource, modelConfig.ttsModel, modelConfig.ttsVoice),
        ttsFallbackVoice: modelConfig.ttsFallbackSource && modelConfig.ttsFallbackModel
          ? normalizeTtsVoice(modelConfig.ttsFallbackSource, modelConfig.ttsFallbackModel, modelConfig.ttsFallbackVoice)
          : undefined,
      });
      setTone(conversationTone);
    });
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  // --- Chat handlers ---
  const handleChatSourceChange = (newSource: Source) => {
    updateConfig({ chatSource: newSource, chatModel: firstModelForSource(CHAT_MODELS, newSource) });
  };
  const handleChatModelChange = (source: Source, model: string) => {
    updateConfig({ chatSource: source, chatModel: model });
  };

  // --- STT handlers ---
  const handleSttSourceChange = (newSource: Source) => {
    updateConfig({ sttSource: newSource, sttModel: firstModelForSource(STT_MODELS, newSource) });
  };
  const handleSttModelChange = (source: Source, model: string) => {
    updateConfig({ sttSource: source, sttModel: model });
  };

  // --- TTS handlers ---
  const handleTtsSourceChange = (newSource: Source) => {
    const model = firstModelForSource(TTS_MODELS, newSource);
    updateConfig({ ttsSource: newSource, ttsModel: model, ttsVoice: defaultTtsVoice(newSource, model) });
  };
  const handleTtsModelChange = (source: Source, model: string) => {
    updateConfig({
      ttsSource: source,
      ttsModel: model,
      ttsVoice: normalizeTtsVoice(source, model, config.ttsVoice),
    });
  };

  // --- Image handlers ---
  const handleImageSourceChange = (newSource: Source) => {
    updateConfig({ imageSource: newSource as ModelConfig['imageSource'], imageModel: firstModelForSource(IMAGE_MODELS, newSource) });
  };
  const handleImageModelChange = (source: Source, model: string) => {
    updateConfig({ imageSource: source as ModelConfig['imageSource'], imageModel: model });
  };

  // --- Live handlers ---
  const handleLiveSourceChange = (newSource: Source) => {
    updateConfig({
      liveSource: newSource as ModelConfig['liveSource'],
      liveModel: firstModelForSource(LIVE_MODELS, newSource),
      liveVoice: newSource === 'openai' ? 'marin' : 'Aoede',
    });
  };
  const handleLiveModelChange = (source: Source, model: string) => {
    updateConfig({ liveSource: source as ModelConfig['liveSource'], liveModel: model });
  };

  // --- Fallback handlers ---
  const handleFallbackSourceChange = (
    field: 'chat' | 'stt' | 'tts',
    newSource: Source | '',
  ) => {
    if (!newSource) {
      const clears: Record<string, Partial<ModelConfig>> = {
        chat: { chatFallbackModel: undefined, chatFallbackSource: undefined },
        stt: { sttFallbackModel: undefined, sttFallbackSource: undefined },
        tts: { ttsFallbackModel: undefined, ttsFallbackSource: undefined, ttsFallbackVoice: undefined },
      };
      updateConfig(clears[field]);
      return;
    }
    const modelLists: Record<string, readonly ModelOption[]> = {
      chat: CHAT_MODELS,
      stt: STT_MODELS,
      tts: TTS_MODELS,
    };
    const model = firstModelForSource(modelLists[field], newSource);
    const updates: Record<string, Partial<ModelConfig>> = {
      chat: { chatFallbackSource: newSource, chatFallbackModel: model },
      stt: { sttFallbackSource: newSource, sttFallbackModel: model },
      tts: {
        ttsFallbackSource: newSource,
        ttsFallbackModel: model,
        ttsFallbackVoice: defaultTtsVoice(newSource, model),
      },
    };
    updateConfig(updates[field]);
  };

  const handleFallbackModelChange = (
    field: 'chat' | 'stt' | 'tts',
    source: Source,
    model: string,
  ) => {
    const updates: Record<string, Partial<ModelConfig>> = {
      chat: { chatFallbackSource: source, chatFallbackModel: model },
      stt: { sttFallbackSource: source, sttFallbackModel: model },
      tts: {
        ttsFallbackSource: source,
        ttsFallbackModel: model,
        ttsFallbackVoice: normalizeTtsVoice(source, model, config.ttsFallbackVoice),
      },
    };
    updateConfig(updates[field]);
  };

  const ttsVoiceOptions = ttsVoicesForSource(config.ttsSource, config.ttsModel);
  const liveVoiceOptions = config.liveSource === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;
  const ttsFallbackVoiceOptions = config.ttsFallbackSource
    ? ttsVoicesForSource(config.ttsFallbackSource, config.ttsFallbackModel)
    : [];

  const handleSave = async () => {
    if (isDevMode) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (openaiKey || geminiKey || groqKey || openrouterKey) {
        await saveApiKeys({
          openai: openaiKey || undefined,
          genai: geminiKey || undefined,
          groq: groqKey || undefined,
          openrouter: openrouterKey || undefined,
        });
      }
      await saveModelConfig(config);
      await saveConversationTone(tone);
      setRuntimeModelConfig(config);
      setRuntimeConversationTone(tone);
      await hydrateRuntimeState();
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError('Erro ao salvar configuracoes. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await authSignOut();
    window.location.href = '/login';
  };

  const handleReset = () => setConfig({ ...DEFAULT_MODEL_CONFIG });

  function FallbackSection({
    label,
    modelSources,
    modelOptions,
    currentModel,
    currentSource,
    onSourceChange,
    onModelChange,
    voiceOptions,
    currentVoice,
    onVoiceChange,
  }: {
    label: string;
    modelSources: readonly Source[];
    modelOptions: readonly ModelOption[];
    currentModel: string | undefined;
    currentSource: Source | undefined;
    onSourceChange: (source: Source | '') => void;
    onModelChange: (source: Source, model: string) => void;
    voiceOptions?: { value: string; label: string }[];
    currentVoice?: string;
    onVoiceChange?: (voice: string) => void;
  }) {
    const filteredModels = currentSource
      ? modelOptions.filter(m => m.source === currentSource)
      : [];
    return (
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Fallback - Provedor"
            value={currentSource ?? ''}
            options={[
              { value: '', label: 'Nenhum (sem fallback)' },
              ...modelSources.map(s => ({ value: s, label: SOURCE_LABELS[s] })),
            ]}
            onChange={v => onSourceChange(v as Source | '')}
          />
          <Select
            label="Fallback - Modelo"
            value={currentModel ?? ''}
            options={filteredModels.map(m => ({ value: m.value, label: m.label }))}
            onChange={v => currentSource && onModelChange(currentSource, v)}
            disabled={!currentSource}
          />
        </div>
        {currentSource && currentModel && (
          <ModelWarningBadge modelId={currentModel} source={currentSource} />
        )}
        {voiceOptions && currentModel && onVoiceChange && (
          <Select
            label="Voz Fallback"
            value={currentVoice || ''}
            options={voiceOptions}
            onChange={onVoiceChange}
          />
        )}
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
            hint={import.meta.env.VITE_OPENROUTER_API_KEY && !localStorage.getItem('el_openrouter_key')
              ? 'Carregada do arquivo .env'
              : 'Obtenha em openrouter.ai/keys'}
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
                <ModelSelect
                  label="Chat"
                  sources={CHAT_SOURCES}
                  models={CHAT_MODELS}
                  currentSource={config.chatSource}
                  currentModel={config.chatModel}
                  onSourceChange={handleChatSourceChange}
                  onModelChange={handleChatModelChange}
                />
                <FallbackSection
                  label="Fallback"
                  modelSources={CHAT_SOURCES}
                  modelOptions={CHAT_MODELS}
                  currentModel={config.chatFallbackModel}
                  currentSource={config.chatFallbackSource}
                  onSourceChange={s => handleFallbackSourceChange('chat', s)}
                  onModelChange={(s, m) => handleFallbackModelChange('chat', s, m)}
                />
              </>
            ),
          },
          {
            icon: Mic, color: 'coral' as const, title: 'Fala para Texto (STT)',
            desc: `Transcreve seu áudio falado. Requer key do ${SOURCE_LABELS[config.sttSource]}.`,
            content: (
              <>
                <ModelSelect
                  label="STT"
                  sources={STT_SOURCES}
                  models={STT_MODELS}
                  currentSource={config.sttSource}
                  currentModel={config.sttModel}
                  onSourceChange={handleSttSourceChange}
                  onModelChange={handleSttModelChange}
                />
                <FallbackSection
                  label="Fallback"
                  modelSources={STT_SOURCES}
                  modelOptions={STT_MODELS}
                  currentModel={config.sttFallbackModel}
                  currentSource={config.sttFallbackSource}
                  onSourceChange={s => handleFallbackSourceChange('stt', s)}
                  onModelChange={(s, m) => handleFallbackModelChange('stt', s, m)}
                />
              </>
            ),
          },
          {
            icon: Volume2, color: 'leaf' as const, title: 'Texto para Fala (TTS)',
            desc: `Áudio para frases e correções. Requer key do ${SOURCE_LABELS[config.ttsSource]}.`,
            content: (
              <>
                <ModelSelect
                  label="TTS"
                  sources={TTS_SOURCES}
                  models={TTS_MODELS}
                  currentSource={config.ttsSource}
                  currentModel={config.ttsModel}
                  onSourceChange={handleTtsSourceChange}
                  onModelChange={handleTtsModelChange}
                />
                <Select label="Voz" value={config.ttsVoice} options={ttsVoiceOptions} onChange={v => updateConfig({ ttsVoice: v })} />
                <FallbackSection
                  label="Fallback"
                  modelSources={TTS_SOURCES}
                  modelOptions={TTS_MODELS}
                  currentModel={config.ttsFallbackModel}
                  currentSource={config.ttsFallbackSource}
                  onSourceChange={s => handleFallbackSourceChange('tts', s)}
                  onModelChange={(s, m) => handleFallbackModelChange('tts', s, m)}
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
              <ModelSelect
                label="Imagem"
                sources={IMAGE_SOURCES}
                models={IMAGE_MODELS}
                currentSource={config.imageSource}
                currentModel={config.imageModel}
                onSourceChange={handleImageSourceChange}
                onModelChange={handleImageModelChange}
              />
            ),
          },
          {
            icon: Radio, color: 'coral' as const, title: 'Simulação ao Vivo',
            desc: `Conversa de áudio em tempo real. Requer key do ${SOURCE_LABELS[config.liveSource]}.`,
            content: (
              <>
                <ModelSelect
                  label="Live"
                  sources={LIVE_SOURCES}
                  models={LIVE_MODELS}
                  currentSource={config.liveSource}
                  currentModel={config.liveModel}
                  onSourceChange={handleLiveSourceChange}
                  onModelChange={handleLiveModelChange}
                />
                <Select label="Voz" value={config.liveVoice} options={liveVoiceOptions} onChange={v => updateConfig({ liveVoice: v })} />
              </>
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
      <div className="space-y-3">
        <Button
          variant={saved ? 'primary' : 'coral'}
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className={cn('w-full text-lg font-bold py-4 rounded-2xl cursor-pointer', saved && 'bg-leaf hover:bg-leaf')}
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : saved ? <Check size={20} /> : <Save size={20} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
        </Button>
        {saved && !saving && (
          <div className="rounded-xl border border-leaf/30 bg-leaf-soft px-4 py-3 text-sm font-medium text-leaf">
            Configurações salvas com sucesso.
          </div>
        )}
        {saveError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}
