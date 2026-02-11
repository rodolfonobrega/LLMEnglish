import { useState, useEffect } from 'react';
import {
  getOpenAIKey, setOpenAIKey,
  getGeminiKey, setGeminiKey,
  getGroqKey, setGroqKey,
  getModelConfig, saveModelConfig,
  getConversationTone, saveConversationTone,
} from '../../services/storage';
import type { ModelConfig, Provider, ConversationTone } from '../../types/settings';
import {
  DEFAULT_MODEL_CONFIG,
  CHAT_MODELS, STT_MODELS, TTS_MODELS,
  OPENAI_TTS_VOICES, GEMINI_TTS_VOICES, GROQ_TTS_VOICES,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
} from '../../types/settings';
import { KeyRound, Shield, Save, Check, Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio, ShieldAlert, MessagesSquare, Coffee, Briefcase, Scale } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';

// --- Helpers ---

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

const NONE_OPTION = { value: '', label: 'None (no fallback)' };

export function SettingsPage() {
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [geminiKey, setGeminiKeyState] = useState('');
  const [groqKey, setGroqKeyState] = useState('');
  const [config, setConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [tone, setTone] = useState<ConversationTone>('balanced');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOpenaiKeyState(getOpenAIKey());
    setGeminiKeyState(getGeminiKey());
    setGroqKeyState(getGroqKey());
    setConfig(getModelConfig());
    setTone(getConversationTone());
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  // --- Primary model change handlers ---

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

  // --- Fallback model change handlers ---

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

  // --- Computed voice lists ---

  const ttsVoiceOptions = ttsVoicesForProvider(config.ttsProvider);
  const liveVoiceOptions = config.liveProvider === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;
  const ttsFallbackVoiceOptions = config.ttsFallbackProvider
    ? ttsVoicesForProvider(config.ttsFallbackProvider)
    : [];

  // --- Save / Reset ---

  const handleSave = () => {
    setOpenAIKey(openaiKey);
    setGeminiKey(geminiKey);
    setGroqKey(groqKey);
    saveModelConfig(config);
    saveConversationTone(tone);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => setConfig({ ...DEFAULT_MODEL_CONFIG });

  // --- Fallback sub-component ---

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
            label="Fallback Model"
            value={currentModel || ''}
            options={options}
            onChange={onModelChange}
            hint={currentProvider ? `Provider: ${providerLabel(currentProvider)}` : undefined}
          />
          {voiceOptions && currentModel && onVoiceChange && (
            <Select
              label="Fallback Voice"
              value={currentVoice || ''}
              options={voiceOptions}
              onChange={onVoiceChange}
            />
          )}
        </div>
      </div>
    );
  }

  // --- Render ---

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-foreground text-balance">Settings</h2>
        <p className="text-muted-foreground text-pretty">Configure your API keys and choose which models to use.</p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 bg-[var(--amber-soft)] rounded-2xl p-4">
        <div className="size-8 rounded-full bg-[var(--amber)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield size={16} className="text-[var(--amber)]" />
        </div>
        <div>
          <h4 className="text-[var(--amber)] font-bold text-sm">Security Notice</h4>
          <p className="text-muted-foreground text-sm mt-1 text-pretty">
            API keys are stored in your browser's local storage. This is suitable for personal use only.
          </p>
        </div>
      </div>

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
              ? 'Loaded from .env file'
              : 'Get your key at platform.openai.com/api-keys'}
          />
          <Input
            label="Google Gemini API Key"
            type="password"
            value={geminiKey}
            onChange={e => setGeminiKeyState(e.target.value)}
            placeholder="AI..."
            hint={import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('el_gemini_key')
              ? 'Loaded from .env file'
              : 'Get your key at aistudio.google.com/apikey'}
          />
          <Input
            label="Groq API Key"
            type="password"
            value={groqKey}
            onChange={e => setGroqKeyState(e.target.value)}
            placeholder="gsk_..."
            hint={import.meta.env.VITE_GROQ_API_KEY && !localStorage.getItem('el_groq_key')
              ? 'Loaded from .env file'
              : 'Get your key at console.groq.com'}
          />
        </div>
      </section>

      {/* Conversation Tone */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-[var(--sky-soft)] flex items-center justify-center">
            <MessagesSquare size={14} className="text-[var(--sky)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--sky)] uppercase tracking-wide">Conversation Tone</h3>
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          Choose the overall tone for AI conversations, exercises, and evaluations across the app.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {
              id: 'casual' as const,
              icon: Coffee,
              label: 'Casual',
              desc: 'Everyday English. Contractions, slang, relaxed rhythm. Like chatting with a friend.',
            },
            {
              id: 'balanced' as const,
              icon: Scale,
              label: 'Balanced',
              desc: 'Natural and clear. Conversational but well-structured. The default.',
            },
            {
              id: 'formal' as const,
              icon: Briefcase,
              label: 'Formal',
              desc: 'Professional and polished. Business English, meetings, presentations.',
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
            <h3 className="text-sm font-bold text-[var(--sky)] uppercase tracking-wide">Model Configuration</h3>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-semibold cursor-pointer"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>

        {/* Model sections */}
        {[
          {
            icon: MessageSquare, color: 'sky' as const, title: 'Text Generation',
            desc: 'Generating prompts, evaluating speech, creating scenarios.',
            content: (
              <>
                <Select label="Model" value={config.chatModel} options={CHAT_MODELS} onChange={handleChatModelChange}
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
            icon: Mic, color: 'coral' as const, title: 'Speech-to-Text',
            desc: `Transcribes your spoken audio. Requires ${providerLabel(config.sttProvider)} key.`,
            content: (
              <>
                <Select label="Model" value={config.sttModel} options={STT_MODELS} onChange={handleSttModelChange}
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
            icon: Volume2, color: 'leaf' as const, title: 'Text-to-Speech',
            desc: `Audio for phrases and corrections. Requires ${providerLabel(config.ttsProvider)} key.`,
            content: (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Model" value={config.ttsModel} options={TTS_MODELS} onChange={handleTtsModelChange}
                    hint={`Provider: ${providerLabel(config.ttsProvider)}`} />
                  <Select label="Voice" value={config.ttsVoice} options={ttsVoiceOptions} onChange={v => updateConfig({ ttsVoice: v })} />
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
            icon: ImageIcon, color: 'amber' as const, title: 'Image Generation',
            desc: 'Generates images for the Image Description mode.',
            content: (
              <Select label="Model" value={config.imageModel} options={IMAGE_MODELS} onChange={handleImageModelChange}
                hint={`Provider: ${providerLabel(config.imageProvider)}`} />
            ),
          },
          {
            icon: Radio, color: 'coral' as const, title: 'Live Roleplay',
            desc: `Real-time audio conversation. Requires ${providerLabel(config.liveProvider)} key.`,
            content: (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Model" value={config.liveModel} options={LIVE_MODELS} onChange={handleLiveModelChange}
                  hint={`Provider: ${config.liveProvider === 'openai' ? 'OpenAI Realtime' : 'Gemini Live'}`} />
                <Select label="Voice" value={config.liveVoice} options={liveVoiceOptions} onChange={v => updateConfig({ liveVoice: v })} />
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
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}
