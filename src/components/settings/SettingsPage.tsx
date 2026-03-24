import { useState, useEffect } from 'react';
import {
  getModelConfig, saveModelConfig,
  getConversationTone, saveConversationTone,
  getUserContext, saveUserContext,
  saveApiKeys,
  type UserContext,
} from '../../services/supabase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/supabase/auth';
import type { ModelConfig, Provider, ConversationTone } from '../../types/settings';
import {
  DEFAULT_MODEL_CONFIG,
  CHAT_MODELS, STT_MODELS, TTS_MODELS,
  OPENAI_TTS_VOICES, GEMINI_TTS_VOICES, GROQ_TTS_VOICES,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
} from '../../types/settings';
import { KeyRound, Shield, Save, Check, Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio, ShieldAlert, MessagesSquare, Coffee, Briefcase, Scale, User as UserIcon, LogOut, Mail } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';

function providerLabel(provider: Provider | 'openai' | 'gemini'): string {
  if (provider === 'groq') return 'Groq';
  if (provider === 'gemini') return 'Google Gemini';
  return 'OpenAI';
}

function ttsVoicesForProvider(provider: Provider) {
  if (provider === 'gemini') return GEMINI_TTS_VOICES;
  if (provider === 'groq') return GROQ_TTS_VOICES;
  return OPENAI_TTS_VOICES;
}

function defaultTtsVoice(provider: Provider): string {
  if (provider === 'gemini') return 'Kore';
  if (provider === 'groq') return 'hannah';
  return 'nova';
}

const NONE_OPTION = { value: '', label: 'Nenhum (sem fallback)' };

export function SettingsPage() {
  const { user, profile, signOut: authSignOut, refreshProfile } = useAuth();
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [geminiKey, setGeminiKeyState] = useState('');
  const [groqKey, setGroqKeyState] = useState('');
  const [config, setConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [tone, setTone] = useState<ConversationTone>('balanced');
  const [saved, setSaved] = useState(false);
  const [userCtx, setUserCtx] = useState<UserContext>({
    profile: '',
    interests: '',
    goals: '',
    currentLevel: 'Intermediate',
  });

  useEffect(() => {
    // Load data from Supabase
    Promise.all([
      getModelConfig(),
      getConversationTone(),
      getUserContext(),
    ]).then(([modelConfig, conversationTone, userContext]) => {
      setConfig(modelConfig);
      setTone(conversationTone);
      setUserCtx(userContext);
    });
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  const handleUserCtxChange = (field: keyof UserContext, value: string) => {
    setUserCtx(prev => {
      const next = { ...prev, [field]: value };
      saveUserContext(next);
      return next;
    });
  };

  const handleChatModelChange = (model: string) => {
    const entry = CHAT_MODELS.find(m => m.value === model);
    updateConfig({ chatModel: model, chatProvider: entry?.provider || 'openai' });
  };

  const handleSttModelChange = (model: string) => {
    const entry = STT_MODELS.find(m => m.value === model);
    updateConfig({ sttModel: model, sttProvider: entry?.provider || 'openai' });
  };

  const handleTtsModelChange = (model: string) => {
    const entry = TTS_MODELS.find(m => m.value === model);
    const newProvider = entry?.provider || 'openai';
    updateConfig({ ttsModel: model, ttsProvider: newProvider, ttsVoice: defaultTtsVoice(newProvider) });
  };

  const handleImageModelChange = (model: string) => {
    const entry = IMAGE_MODELS.find(m => m.value === model);
    updateConfig({ imageModel: model, imageProvider: entry?.provider || 'openai' });
  };

  const handleLiveModelChange = (model: string) => {
    const entry = LIVE_MODELS.find(m => m.value === model);
    const newProvider = entry?.provider || 'gemini';
    updateConfig({
      liveModel: model,
      liveProvider: newProvider,
      liveVoice: newProvider === 'openai' ? 'marin' : 'Aoede',
    });
  };

  const handleChatFallbackChange = (model: string) => {
    if (!model) {
      updateConfig({ chatFallbackModel: undefined, chatFallbackProvider: undefined });
      return;
    }
    const entry = CHAT_MODELS.find(m => m.value === model);
    updateConfig({ chatFallbackModel: model, chatFallbackProvider: entry?.provider || 'openai' });
  };

  const handleSttFallbackChange = (model: string) => {
    if (!model) {
      updateConfig({ sttFallbackModel: undefined, sttFallbackProvider: undefined });
      return;
    }
    const entry = STT_MODELS.find(m => m.value === model);
    updateConfig({ sttFallbackModel: model, sttFallbackProvider: entry?.provider || 'openai' });
  };

  const handleTtsFallbackChange = (model: string) => {
    if (!model) {
      updateConfig({ ttsFallbackModel: undefined, ttsFallbackProvider: undefined, ttsFallbackVoice: undefined });
      return;
    }
    const entry = TTS_MODELS.find(m => m.value === model);
    const newProvider = entry?.provider || 'openai';
    updateConfig({
      ttsFallbackModel: model,
      ttsFallbackProvider: newProvider,
      ttsFallbackVoice: defaultTtsVoice(newProvider),
    });
  };

  const ttsVoiceOptions = ttsVoicesForProvider(config.ttsProvider);
  const liveVoiceOptions = config.liveProvider === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;
  const ttsFallbackVoiceOptions = config.ttsFallbackProvider
    ? ttsVoicesForProvider(config.ttsFallbackProvider)
    : [];

  const handleSave = async () => {
    try {
      // Save API keys to Supabase (encrypted via Edge Function)
      if (openaiKey || geminiKey || groqKey) {
        await saveApiKeys({
          openai: openaiKey || undefined,
          gemini: geminiKey || undefined,
          groq: groqKey || undefined,
        });
      }
      await saveModelConfig(config);
      await saveConversationTone(tone);
      await saveUserContext(userCtx);
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
    currentProvider,
    onModelChange,
    voiceOptions,
    currentVoice,
    onVoiceChange,
  }: {
    label: string;
    modelOptions: { value: string; label: string; provider: Provider }[];
    currentModel: string | undefined;
    currentProvider: Provider | undefined;
    onModelChange: (model: string) => void;
    voiceOptions?: { value: string; label: string }[];
    currentVoice?: string;
    onVoiceChange?: (voice: string) => void;
  }) {
    const options = [NONE_OPTION, ...modelOptions];
    return (
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={12} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <div className={cn('grid gap-3', voiceOptions && currentModel ? 'grid-cols-2' : 'grid-cols-1')}>
          <Select
            label="Modelo Fallback"
            value={currentModel || ''}
            options={options}
            onChange={onModelChange}
            hint={currentProvider ? `Provider: ${providerLabel(currentProvider)}` : undefined}
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
        <div className="size-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          {profile?.email?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{profile?.email || user?.email}</p>
          <p className="text-sm text-muted-foreground">SpeakLab sincronizado na nuvem</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 bg-[var(--sky-soft)] rounded-2xl p-4">
        <div className="size-8 rounded-full bg-[var(--sky)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield size={16} className="text-[var(--sky)]" />
        </div>
        <div>
          <h4 className="text-[var(--sky)] font-bold text-sm">Dados Sincronizados</h4>
          <p className="text-muted-foreground text-sm mt-1 text-pretty">
            Suas API keys são armazenadas de forma criptografada no Supabase. Seus dados sincronizam entre dispositivos.
          </p>
        </div>
      </div>

      {/* User Profile */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
            <UserIcon size={14} className="text-[var(--sky)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--sky)] uppercase tracking-wide">Seu Perfil</h3>
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Este contexto é salvo automaticamente e usado para personalizar seus exercícios e scripts.
        </p>

        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nível Atual</label>
            <select
              value={userCtx.currentLevel}
              onChange={(e) => handleUserCtxChange('currentLevel', e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          <Input
            label="Perfil / Background"
            value={userCtx.profile}
            onChange={e => handleUserCtxChange('profile', e.target.value)}
            placeholder="ex: Engenheiro de Software buscando vagas no Canadá"
          />
          <Input
            label="Interesses"
            value={userCtx.interests}
            onChange={e => handleUserCtxChange('interests', e.target.value)}
            placeholder="ex: Tecnologia, Games, Culinária, Viagem"
          />
          <Input
            label="Objetivos de Aprendizado"
            value={userCtx.goals}
            onChange={e => handleUserCtxChange('goals', e.target.value)}
            placeholder="ex: Falar com mais fluência em reuniões, passar em entrevistas"
          />
        </div>
      </section>

      {/* API Keys */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-[var(--coral-soft)] flex items-center justify-center">
            <KeyRound size={14} className="text-[var(--coral)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--coral)] uppercase tracking-wide">API Keys</h3>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border space-y-4">
          <Input
            label="OpenAI API Key"
            type="password"
            value={openaiKey}
            onChange={e => setOpenaiKeyState(e.target.value)}
            placeholder="sk-..."
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
            hint={import.meta.env.VITE_GROQ_API_KEY && !localStorage.getItem('el_groq_key')
              ? 'Carregada do arquivo .env'
              : 'Obtenha em console.groq.com'}
          />
        </div>
      </section>

      {/* Conversation Tone */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
            <MessagesSquare size={14} className="text-[var(--sky)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--sky)] uppercase tracking-wide">Tom da Conversa</h3>
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
                  ? 'border-[var(--sky)] bg-[var(--sky-soft)] shadow-sm'
                  : 'border-border bg-card hover:border-[var(--sky)]/40 hover:bg-muted/30'
              )}
            >
              <div className={cn(
                'size-9 rounded-xl flex items-center justify-center',
                tone === option.id ? 'bg-[var(--sky)] text-white' : 'bg-muted text-muted-foreground'
              )}>
                <option.icon size={18} />
              </div>
              <div>
                <p className={cn(
                  'font-bold text-sm',
                  tone === option.id ? 'text-[var(--sky)]' : 'text-foreground'
                )}>
                  {option.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.desc}</p>
              </div>
              {tone === option.id && (
                <div className="self-end size-5 bg-[var(--sky)] rounded-full flex items-center justify-center">
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
            <div className="size-7 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
              <Cpu size={14} className="text-[var(--sky)]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--sky)] uppercase tracking-wide">Configuração de Modelos</h3>
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
                <Select label="Modelo" value={config.chatModel} options={CHAT_MODELS} onChange={handleChatModelChange}
                  hint={`Provider: ${providerLabel(config.chatProvider)}`} />
                <FallbackSection
                  label="Fallback"
                  modelOptions={CHAT_MODELS}
                  currentModel={config.chatFallbackModel}
                  currentProvider={config.chatFallbackProvider}
                  onModelChange={handleChatFallbackChange}
                />
              </>
            ),
          },
          {
            icon: Mic, color: 'coral' as const, title: 'Fala para Texto (STT)',
            desc: `Transcreve seu áudio falado. Requer key do ${providerLabel(config.sttProvider)}.`,
            content: (
              <>
                <Select label="Modelo" value={config.sttModel} options={STT_MODELS} onChange={handleSttModelChange}
                  hint={`Provider: ${providerLabel(config.sttProvider)}${config.sttProvider === 'gemini' ? ' (multimodal)' : ''}`} />
                <FallbackSection
                  label="Fallback"
                  modelOptions={STT_MODELS}
                  currentModel={config.sttFallbackModel}
                  currentProvider={config.sttFallbackProvider}
                  onModelChange={handleSttFallbackChange}
                />
              </>
            ),
          },
          {
            icon: Volume2, color: 'leaf' as const, title: 'Texto para Fala (TTS)',
            desc: `Áudio para frases e correções. Requer key do ${providerLabel(config.ttsProvider)}.`,
            content: (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Modelo" value={config.ttsModel} options={TTS_MODELS} onChange={handleTtsModelChange}
                    hint={`Provider: ${providerLabel(config.ttsProvider)}`} />
                  <Select label="Voz" value={config.ttsVoice} options={ttsVoiceOptions} onChange={v => updateConfig({ ttsVoice: v })} />
                </div>
                <FallbackSection
                  label="Fallback"
                  modelOptions={TTS_MODELS}
                  currentModel={config.ttsFallbackModel}
                  currentProvider={config.ttsFallbackProvider}
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
              <Select label="Modelo" value={config.imageModel} options={IMAGE_MODELS} onChange={handleImageModelChange}
                hint={`Provider: ${providerLabel(config.imageProvider)}`} />
            ),
          },
          {
            icon: Radio, color: 'coral' as const, title: 'Simulação ao Vivo',
            desc: `Conversa de áudio em tempo real. Requer key do ${providerLabel(config.liveProvider)}.`,
            content: (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Modelo" value={config.liveModel} options={LIVE_MODELS} onChange={handleLiveModelChange}
                  hint={`Provider: ${config.liveProvider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live'}`} />
                <Select label="Voz" value={config.liveVoice} options={liveVoiceOptions} onChange={v => updateConfig({ liveVoice: v })} />
              </div>
            ),
          },
        ].map(section => {
          const colorMap = {
            sky: { bg: 'bg-[var(--sky-soft)]', text: 'text-[var(--sky)]' },
            coral: { bg: 'bg-[var(--coral-soft)]', text: 'text-[var(--coral)]' },
            leaf: { bg: 'bg-[var(--leaf-soft)]', text: 'text-[var(--leaf)]' },
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
        className={cn('w-full text-lg font-bold py-4 rounded-2xl cursor-pointer', saved && 'bg-[var(--leaf)] hover:bg-[var(--leaf)]')}
      >
        {saved ? <Check size={20} /> : <Save size={20} />}
        {saved ? 'Salvo!' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
