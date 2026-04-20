import { Cpu, RotateCcw, MessageSquare, Mic, Volume2, ImageIcon, Radio } from 'lucide-react';
import type { ModelConfig, Source, ModelOption } from '../../../types/settings';
import {
  SOURCE_LABELS,
  CHAT_MODELS, STT_MODELS, TTS_MODELS,
  defaultTtsVoice, normalizeTtsVoice, ttsVoicesForSource,
  IMAGE_MODELS, LIVE_MODELS, OPENAI_LIVE_VOICES, GEMINI_LIVE_VOICES,
  sourcesFromModels,
} from '../../../types/settings';
import { Select } from '../../ui/Select';
import { cn } from '../../../utils/cn';
import { ModelSelect } from '../ModelSelect';
import { FallbackSection } from './FallbackSection';

const CHAT_SOURCES = sourcesFromModels(CHAT_MODELS);
const STT_SOURCES = sourcesFromModels(STT_MODELS);
const TTS_SOURCES = sourcesFromModels(TTS_MODELS);
const IMAGE_SOURCES = sourcesFromModels(IMAGE_MODELS);
const LIVE_SOURCES = sourcesFromModels(LIVE_MODELS);

function firstModelForSource(models: readonly ModelOption[], source: Source): string {
  return models.find(m => m.source === source)?.value ?? models[0].value;
}

export interface ModelConfigSectionProps {
  config: ModelConfig;
  onConfigChange: (partial: Partial<ModelConfig>) => void;
  onReset: () => void;
}

export function ModelConfigSection({ config, onConfigChange, onReset }: ModelConfigSectionProps) {
  const handleChatSourceChange = (newSource: Source) => {
    onConfigChange({ chatSource: newSource, chatModel: firstModelForSource(CHAT_MODELS, newSource) });
  };
  const handleChatModelChange = (source: Source, model: string) => {
    onConfigChange({ chatSource: source, chatModel: model });
  };
  const handleSttSourceChange = (newSource: Source) => {
    onConfigChange({ sttSource: newSource, sttModel: firstModelForSource(STT_MODELS, newSource) });
  };
  const handleSttModelChange = (source: Source, model: string) => {
    onConfigChange({ sttSource: source, sttModel: model });
  };
  const handleTtsSourceChange = (newSource: Source) => {
    const model = firstModelForSource(TTS_MODELS, newSource);
    onConfigChange({ ttsSource: newSource, ttsModel: model, ttsVoice: defaultTtsVoice(newSource, model) });
  };
  const handleTtsModelChange = (source: Source, model: string) => {
    onConfigChange({
      ttsSource: source,
      ttsModel: model,
      ttsVoice: normalizeTtsVoice(source, model, config.ttsVoice),
    });
  };
  const handleImageSourceChange = (newSource: Source) => {
    onConfigChange({ imageSource: newSource as ModelConfig['imageSource'], imageModel: firstModelForSource(IMAGE_MODELS, newSource) });
  };
  const handleImageModelChange = (source: Source, model: string) => {
    onConfigChange({ imageSource: source as ModelConfig['imageSource'], imageModel: model });
  };
  const handleLiveSourceChange = (newSource: Source) => {
    onConfigChange({
      liveSource: newSource as ModelConfig['liveSource'],
      liveModel: firstModelForSource(LIVE_MODELS, newSource),
      liveVoice: newSource === 'openai' ? 'marin' : 'Aoede',
    });
  };
  const handleLiveModelChange = (source: Source, model: string) => {
    onConfigChange({ liveSource: source as ModelConfig['liveSource'], liveModel: model });
  };

  const handleFallbackSourceChange = (
    field: 'chat' | 'stt' | 'tts' | 'image',
    newSource: Source | '',
  ) => {
    if (!newSource) {
      const clears: Record<string, Partial<ModelConfig>> = {
        chat: { chatFallbackModel: undefined, chatFallbackSource: undefined },
        stt: { sttFallbackModel: undefined, sttFallbackSource: undefined },
        tts: { ttsFallbackModel: undefined, ttsFallbackSource: undefined, ttsFallbackVoice: undefined },
        image: { imageFallbackModel: undefined, imageFallbackSource: undefined },
      };
      onConfigChange(clears[field]);
      return;
    }
    const modelLists: Record<string, readonly ModelOption[]> = {
      chat: CHAT_MODELS, stt: STT_MODELS, tts: TTS_MODELS, image: IMAGE_MODELS,
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
      image: { imageFallbackSource: newSource as ModelConfig['imageFallbackSource'], imageFallbackModel: model },
    };
    onConfigChange(updates[field]);
  };

  const handleFallbackModelChange = (
    field: 'chat' | 'stt' | 'tts' | 'image',
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
      image: { imageFallbackSource: source as ModelConfig['imageFallbackSource'], imageFallbackModel: model },
    };
    onConfigChange(updates[field]);
  };

  const ttsVoiceOptions = ttsVoicesForSource(config.ttsSource, config.ttsModel);
  const liveVoiceOptions = config.liveSource === 'openai' ? OPENAI_LIVE_VOICES : GEMINI_LIVE_VOICES;
  const ttsFallbackVoiceOptions = config.ttsFallbackSource
    ? ttsVoicesForSource(config.ttsFallbackSource, config.ttsFallbackModel)
    : [];

  const colorMap = {
    sky: { bg: 'bg-primary-soft', text: 'text-primary' },
    coral: { bg: 'bg-primary-soft', text: 'text-primary' },
    leaf: { bg: 'bg-leaf-soft', text: 'text-leaf' },
    amber: { bg: 'bg-[var(--amber-soft)]', text: 'text-[var(--amber)]' },
  };

  const sections = [
    {
      icon: MessageSquare, color: 'sky' as const, title: 'Geração de Texto',
      desc: 'Gera prompts, avalia fala, cria cenários.',
      content: (
        <>
          <ModelSelect label="Chat" sources={CHAT_SOURCES} models={CHAT_MODELS}
            currentSource={config.chatSource} currentModel={config.chatModel}
            onSourceChange={handleChatSourceChange} onModelChange={handleChatModelChange} />
          <FallbackSection label="Fallback" modelSources={CHAT_SOURCES} modelOptions={CHAT_MODELS}
            currentModel={config.chatFallbackModel} currentSource={config.chatFallbackSource}
            onSourceChange={s => handleFallbackSourceChange('chat', s)}
            onModelChange={(s, m) => handleFallbackModelChange('chat', s, m)} />
        </>
      ),
    },
    {
      icon: Mic, color: 'coral' as const, title: 'Fala para Texto (STT)',
      desc: `Transcreve seu áudio falado. Requer key do ${SOURCE_LABELS[config.sttSource]}.`,
      content: (
        <>
          <ModelSelect label="STT" sources={STT_SOURCES} models={STT_MODELS}
            currentSource={config.sttSource} currentModel={config.sttModel}
            onSourceChange={handleSttSourceChange} onModelChange={handleSttModelChange} />
          <FallbackSection label="Fallback" modelSources={STT_SOURCES} modelOptions={STT_MODELS}
            currentModel={config.sttFallbackModel} currentSource={config.sttFallbackSource}
            onSourceChange={s => handleFallbackSourceChange('stt', s)}
            onModelChange={(s, m) => handleFallbackModelChange('stt', s, m)} />
        </>
      ),
    },
    {
      icon: Volume2, color: 'leaf' as const, title: 'Texto para Fala (TTS)',
      desc: `Áudio para frases e correções. Requer key do ${SOURCE_LABELS[config.ttsSource]}.`,
      content: (
        <>
          <ModelSelect label="TTS" sources={TTS_SOURCES} models={TTS_MODELS}
            currentSource={config.ttsSource} currentModel={config.ttsModel}
            onSourceChange={handleTtsSourceChange} onModelChange={handleTtsModelChange} />
          <Select label="Voz" value={config.ttsVoice} options={ttsVoiceOptions}
            onChange={v => onConfigChange({ ttsVoice: v })} />
          <FallbackSection label="Fallback" modelSources={TTS_SOURCES} modelOptions={TTS_MODELS}
            currentModel={config.ttsFallbackModel} currentSource={config.ttsFallbackSource}
            onSourceChange={s => handleFallbackSourceChange('tts', s)}
            onModelChange={(s, m) => handleFallbackModelChange('tts', s, m)}
            voiceOptions={ttsFallbackVoiceOptions} currentVoice={config.ttsFallbackVoice}
            onVoiceChange={v => onConfigChange({ ttsFallbackVoice: v })} />
        </>
      ),
    },
    {
      icon: ImageIcon, color: 'amber' as const, title: 'Geração de Imagem',
      desc: 'Gera imagens para o modo de Desafio Visual.',
      content: (
        <>
          <ModelSelect label="Imagem" sources={IMAGE_SOURCES} models={IMAGE_MODELS}
            currentSource={config.imageSource} currentModel={config.imageModel}
            onSourceChange={handleImageSourceChange} onModelChange={handleImageModelChange} />
          <FallbackSection label="Fallback" modelSources={IMAGE_SOURCES} modelOptions={IMAGE_MODELS}
            currentModel={config.imageFallbackModel} currentSource={config.imageFallbackSource}
            onSourceChange={s => handleFallbackSourceChange('image', s)}
            onModelChange={(s, m) => handleFallbackModelChange('image', s, m)} />
        </>
      ),
    },
    {
      icon: Radio, color: 'coral' as const, title: 'Simulação ao Vivo',
      desc: `Conversa de áudio em tempo real. Requer key do ${SOURCE_LABELS[config.liveSource]}.`,
      content: (
        <>
          <ModelSelect label="Live" sources={LIVE_SOURCES} models={LIVE_MODELS}
            currentSource={config.liveSource} currentModel={config.liveModel}
            onSourceChange={handleLiveSourceChange} onModelChange={handleLiveModelChange} />
          <Select label="Voz" value={config.liveVoice} options={liveVoiceOptions}
            onChange={v => onConfigChange({ liveVoice: v })} />
        </>
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary-soft flex items-center justify-center">
            <Cpu size={14} className="text-primary" />
          </div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wide">Configuração de Modelos</h3>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-semibold cursor-pointer"
        >
          <RotateCcw size={12} />
          Resetar
        </button>
      </div>

      {sections.map(section => {
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
  );
}
