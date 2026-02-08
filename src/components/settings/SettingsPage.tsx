import { useState, useEffect } from 'react';
import {
  getOpenAIKey, setOpenAIKey,
  getGeminiKey, setGeminiKey,
  getModelConfig, saveModelConfig,
} from '../../services/storage';
import type { ModelConfig } from '../../types/settings';
import {
  DEFAULT_MODEL_CONFIG,
  CHAT_MODELS, STT_MODELS, TTS_MODELS, OPENAI_TTS_VOICES, GEMINI_TTS_VOICES,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
} from '../../types/settings';
import { KeyRound, Shield, Save, Check, Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';

export function SettingsPage() {
  const [openaiKey, setOpenaiKeyState] = useState('');
  const [geminiKey, setGeminiKeyState] = useState('');
  const [config, setConfig] = useState<ModelConfig>({ ...DEFAULT_MODEL_CONFIG });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setOpenaiKeyState(getOpenAIKey());
    setGeminiKeyState(getGeminiKey());
    setConfig(getModelConfig());
  }, []);

  const updateConfig = (partial: Partial<ModelConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
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
    const defaultVoice = newProvider === 'gemini' ? 'Kore' : 'nova';
    updateConfig({ ttsModel: model, ttsProvider: newProvider, ttsVoice: defaultVoice });
  };

  const ttsVoiceOptions = config.ttsProvider === 'gemini' ? GEMINI_TTS_VOICES : OPENAI_TTS_VOICES;

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

  const liveVoiceOptions = config.liveProvider === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;

  const handleSave = () => {
    setOpenAIKey(openaiKey);
    setGeminiKey(geminiKey);
    saveModelConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => setConfig({ ...DEFAULT_MODEL_CONFIG });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-ink text-balance">Settings</h2>
        <p className="text-ink-muted text-pretty">Configure your API keys and choose which models to use.</p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 bg-amber-soft rounded-2xl p-4">
        <div className="size-8 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield size={16} className="text-amber" />
        </div>
        <div>
          <h4 className="text-amber font-bold text-sm">Security Notice</h4>
          <p className="text-ink-muted text-sm mt-1 text-pretty">
            API keys are stored in your browser's local storage. This is suitable for personal use only.
          </p>
        </div>
      </div>

      {/* API Keys */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-coral-soft flex items-center justify-center">
            <KeyRound size={14} className="text-coral" />
          </div>
          <h3 className="text-sm font-bold text-coral uppercase tracking-wide">API Keys</h3>
        </div>

        <div className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-sm)] space-y-4">
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
        </div>
      </section>

      {/* Model Configuration */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-sky-soft flex items-center justify-center">
              <Cpu size={14} className="text-sky" />
            </div>
            <h3 className="text-sm font-bold text-sky uppercase tracking-wide">Model Configuration</h3>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary transition-colors font-semibold"
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
              <Select label="Model" value={config.chatModel} options={CHAT_MODELS} onChange={handleChatModelChange}
                hint={`Provider: ${config.chatProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}`} />
            ),
          },
          {
            icon: Mic, color: 'coral' as const, title: 'Speech-to-Text',
            desc: `Transcribes your spoken audio. Requires ${config.sttProvider === 'openai' ? 'OpenAI' : 'Gemini'} key.`,
            content: (
              <Select label="Model" value={config.sttModel} options={STT_MODELS} onChange={handleSttModelChange}
                hint={`Provider: ${config.sttProvider === 'openai' ? 'OpenAI' : 'Gemini (multimodal)'}`} />
            ),
          },
          {
            icon: Volume2, color: 'leaf' as const, title: 'Text-to-Speech',
            desc: `Audio for phrases and corrections. Requires ${config.ttsProvider === 'openai' ? 'OpenAI' : 'Gemini'} key.`,
            content: (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Model" value={config.ttsModel} options={TTS_MODELS} onChange={handleTtsModelChange}
                  hint={`Provider: ${config.ttsProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}`} />
                <Select label="Voice" value={config.ttsVoice} options={ttsVoiceOptions} onChange={v => updateConfig({ ttsVoice: v })} />
              </div>
            ),
          },
          {
            icon: ImageIcon, color: 'amber' as const, title: 'Image Generation',
            desc: 'Generates images for the Image Description mode.',
            content: (
              <Select label="Model" value={config.imageModel} options={IMAGE_MODELS} onChange={handleImageModelChange}
                hint={`Provider: ${config.imageProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}`} />
            ),
          },
          {
            icon: Radio, color: 'coral' as const, title: 'Live Roleplay',
            desc: `Real-time audio conversation. Requires ${config.liveProvider === 'openai' ? 'OpenAI' : 'Gemini'} key.`,
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
            sky: { bg: 'bg-sky-soft', text: 'text-sky' },
            coral: { bg: 'bg-coral-soft', text: 'text-coral' },
            leaf: { bg: 'bg-leaf-soft', text: 'text-leaf' },
            amber: { bg: 'bg-amber-soft', text: 'text-amber' },
          };
          const colors = colorMap[section.color];
          return (
            <div key={section.title} className="bg-card rounded-[20px] p-5 shadow-[var(--shadow-sm)] space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('size-7 rounded-full flex items-center justify-center', colors.bg)}>
                  <section.icon size={14} className={colors.text} />
                </div>
                <h4 className={cn('text-sm font-bold uppercase tracking-wide', colors.text)}>{section.title}</h4>
              </div>
              <p className="text-xs text-ink-faint text-pretty">{section.desc}</p>
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
        className={cn('w-full text-lg font-bold py-4 rounded-2xl', saved && 'bg-leaf hover:bg-leaf')}
      >
        {saved ? <Check size={20} /> : <Save size={20} />}
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}
