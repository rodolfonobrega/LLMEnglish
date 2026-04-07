export type Source = 'genai' | 'vertex' | 'openrouter' | 'openai' | 'groq';

export type ConversationTone = 'casual' | 'balanced' | 'formal';

/** Model option in the settings dropdowns. */
export interface ModelOption {
  value: string;
  label: string;
  source: Source;
}

/** Per-source credentials stored encrypted in Supabase. */
export interface SourceCredentials {
  genai?: string;
  openai?: string;
  groq?: string;
  openrouter?: string;
  vertex?: {
    projectId: string;
    region: string;
  };
}

/** All configurable model slots in the app. */
export interface ModelConfig {
  // --- Text generation (prompts, evaluation, scenario generation) ---
  chatModel: string;
  chatSource: Source;

  // --- Speech-to-text ---
  sttModel: string;
  sttSource: Source;

  // --- Text-to-speech ---
  ttsModel: string;
  ttsVoice: string;
  ttsSource: Source;

  // --- Image generation ---
  imageModel: string;
  imageSource: 'genai' | 'vertex' | 'openai' | 'openrouter';

  // --- Live Roleplay (real-time audio) ---
  liveModel: string;
  liveVoice: string;
  liveSource: 'genai' | 'openai';

  // --- Fallbacks (optional -- undefined means no fallback) ---
  chatFallbackModel?: string;
  chatFallbackSource?: Source;
  sttFallbackModel?: string;
  sttFallbackSource?: Source;
  ttsFallbackModel?: string;
  ttsFallbackSource?: Source;
  ttsFallbackVoice?: string;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  chatModel: 'gemini-3.1-flash-lite-preview',
  chatSource: 'genai',

  sttModel: 'gemini-3.1-flash-lite-preview',
  sttSource: 'genai',

  ttsModel: 'gemini-2.5-flash-preview-tts',
  ttsVoice: 'Kore',
  ttsSource: 'genai',

  imageModel: 'gemini-3.1-flash-image-preview',
  imageSource: 'genai',

  liveModel: 'gemini-3.1-flash-live-preview',
  liveVoice: 'Puck',
  liveSource: 'genai',
};

// --- Source display labels ---

export const SOURCE_LABELS: Record<Source, string> = {
  genai: 'Google AI Studio',
  vertex: 'Vertex AI',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
};

// --- Option lists for the Settings UI ---

export const CHAT_MODELS: ModelOption[] = [
  // Google AI Studio
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview, smartest)', source: 'genai' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', source: 'genai' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (fast & cheap)', source: 'genai' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (reasoning)', source: 'genai' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (stable)', source: 'genai' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', source: 'genai' },
  // Vertex AI
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)', source: 'vertex' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', source: 'vertex' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', source: 'vertex' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', source: 'vertex' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', source: 'vertex' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', source: 'vertex' },
  // OpenRouter
  { value: 'google/gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', source: 'openrouter' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', source: 'openrouter' },
  { value: 'anthropic/claude-opus-4', label: 'Claude Opus 4', source: 'openrouter' },
  { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', source: 'openrouter' },
  { value: 'google/gemma-3-27b-it', label: 'Gemma 3 27B', source: 'openrouter' },
  { value: 'mistralai/mistral-large', label: 'Mistral Large', source: 'openrouter' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', source: 'openrouter' },
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 (latest & best)', source: 'openrouter' },
  { value: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini', source: 'openrouter' },
  { value: 'openai/gpt-5.4-nano', label: 'GPT-5.4 Nano (cheapest)', source: 'openrouter' },
  { value: 'openai/gpt-5.2', label: 'GPT-5.2', source: 'openrouter' },
  { value: 'openai/gpt-5.1', label: 'GPT-5.1', source: 'openrouter' },
  { value: 'openai/gpt-5', label: 'GPT-5', source: 'openrouter' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (fast)', source: 'openrouter' },
  { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano', source: 'openrouter' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1', source: 'openrouter' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', source: 'openrouter' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano', source: 'openrouter' },
  // OpenAI Direct
  { value: 'gpt-5.4', label: 'GPT-5.4 (latest & best)', source: 'openai' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', source: 'openai' },
  { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (cheapest)', source: 'openai' },
  { value: 'gpt-5.2', label: 'GPT-5.2', source: 'openai' },
  { value: 'gpt-5.1', label: 'GPT-5.1', source: 'openai' },
  { value: 'gpt-5', label: 'GPT-5', source: 'openai' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (fast)', source: 'openai' },
  { value: 'gpt-5-nano', label: 'GPT-5 Nano', source: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1', source: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', source: 'openai' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', source: 'openai' },
  // Groq Direct
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (fast & smart)', source: 'groq' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)', source: 'groq' },
  { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', source: 'groq' },
  { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', source: 'groq' },
  { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', source: 'groq' },
  { value: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', source: 'groq' },
  { value: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', source: 'groq' },
];

export const STT_MODELS: ModelOption[] = [
  // Google AI Studio
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', source: 'genai' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)', source: 'genai' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (fast & cheap)', source: 'genai' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (reasoning)', source: 'genai' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (stable)', source: 'genai' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', source: 'genai' },
  // Vertex AI
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', source: 'vertex' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)', source: 'vertex' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', source: 'vertex' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', source: 'vertex' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', source: 'vertex' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', source: 'vertex' },
  // OpenAI
  { value: 'whisper-1', label: 'Whisper v1', source: 'openai' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe', source: 'openai' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe', source: 'openai' },
  // Groq
  { value: 'whisper-large-v3', label: 'Whisper Large V3', source: 'groq' },
  { value: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo', source: 'groq' },
  // OpenRouter
  { value: 'openai/whisper-1', label: 'Whisper v1', source: 'openrouter' },
  { value: 'openai/gpt-audio', label: 'GPT Audio', source: 'openrouter' },
  { value: 'openai/gpt-audio-mini', label: 'GPT Audio Mini', source: 'openrouter' },
  { value: 'openai/gpt-4o-audio-preview', label: 'GPT 4o Audio Preview', source: 'openrouter' },
];

export const TTS_MODELS: ModelOption[] = [
  // Google AI Studio
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', source: 'genai' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS (quality)', source: 'genai' },
  // Vertex AI
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', source: 'vertex' },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', source: 'vertex' },
  // OpenAI
  { value: 'tts-1', label: 'TTS-1 (fast)', source: 'openai' },
  { value: 'tts-1-hd', label: 'TTS-1 HD (quality)', source: 'openai' },
  { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS', source: 'openai' },
  // Groq
  { value: 'canopylabs/orpheus-v1-english', label: 'Orpheus English (Groq)', source: 'groq' },
];

export const OPENAI_TTS_VOICES = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'nova', label: 'Nova' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
];

export const GEMINI_TTS_VOICES = [
  { value: 'Aoede', label: 'Aoede (clear, professional)' },
  { value: 'Charon', label: 'Charon (deep, authoritative)' },
  { value: 'Fenrir', label: 'Fenrir (energetic)' },
  { value: 'Kore', label: 'Kore (warm, friendly)' },
  { value: 'Leda', label: 'Leda (soft, calming)' },
  { value: 'Orus', label: 'Orus (rich, resonant)' },
  { value: 'Puck', label: 'Puck (neutral, versatile)' },
];

export const GROQ_TTS_VOICES = [
  { value: 'autumn', label: 'Autumn (female)' },
  { value: 'diana', label: 'Diana (female)' },
  { value: 'hannah', label: 'Hannah (female)' },
  { value: 'austin', label: 'Austin (male)' },
  { value: 'daniel', label: 'Daniel (male)' },
  { value: 'troy', label: 'Troy (male)' },
];

export const IMAGE_MODELS: ModelOption[] = [
  // Google AI Studio
  { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (Gemini 3.1 Flash)', source: 'genai' },
  { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (Gemini 3 Pro)', source: 'genai' },
  { value: 'gemini-2.5-flash-image', label: 'Nano Banana (Gemini 2.5 Flash)', source: 'genai' },
  // Vertex AI
  { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (Gemini 3.1 Flash)', source: 'vertex' },
  { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (Gemini 3 Pro)', source: 'vertex' },
  { value: 'gemini-2.5-flash-image', label: 'Nano Banana (Gemini 2.5 Flash)', source: 'vertex' },
  // OpenAI
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5 (Best)', source: 'openai' },
  { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini (Fast & Affordable)', source: 'openai' },
  { value: 'gpt-image-1', label: 'GPT Image 1 (Balanced)', source: 'openai' },
  // OpenRouter (image generation via chat completions with modalities)
  { value: 'google/gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image', source: 'openrouter' },
  { value: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', source: 'openrouter' },
  { value: 'bytedance-seed/seedream-4.5', label: 'Seedream 4.5', source: 'openrouter' },
  { value: 'openai/gpt-5-image-mini', label: 'GPT 5 Image Mini (cheapest)', source: 'openrouter' },
  { value: 'openai/gpt-5-image', label: 'GPT 5 Image', source: 'openrouter' },
];

export const LIVE_MODELS: ModelOption[] = [
  // Google AI Studio
  { value: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (latest)', source: 'genai' },
  { value: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash Native Audio', source: 'genai' },
  // Vertex AI
  { value: 'gemini-live-2.5-flash-native-audio', label: 'Gemini Live 2.5 Flash Native Audio', source: 'vertex' },
  // OpenAI Realtime
  { value: 'gpt-realtime', label: 'GPT Realtime', source: 'openai' },
  { value: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5', source: 'openai' },
  { value: 'gpt-realtime-mini', label: 'GPT Realtime Mini', source: 'openai' },
];

export const OPENAI_LIVE_VOICES = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'marin', label: 'Marin (recommended)' },
  { value: 'cedar', label: 'Cedar (recommended)' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
];

export const GEMINI_LIVE_VOICES = [
  { value: 'Zephyr', label: 'Zephyr (bright)' },
  { value: 'Kore', label: 'Kore (firm)' },
  { value: 'Orus', label: 'Orus (firm)' },
  { value: 'Autonoe', label: 'Autonoe (bright)' },
  { value: 'Umbriel', label: 'Umbriel (easy-going)' },
  { value: 'Erinome', label: 'Erinome (clear)' },
  { value: 'Laomedeia', label: 'Laomedeia (upbeat)' },
  { value: 'Schedar', label: 'Schedar (even)' },
  { value: 'Achird', label: 'Achird (friendly)' },
  { value: 'Sadachbia', label: 'Sadachbia (lively)' },
  { value: 'Puck', label: 'Puck (upbeat)' },
  { value: 'Fenrir', label: 'Fenrir (excitable)' },
  { value: 'Aoede', label: 'Aoede (breezy)' },
  { value: 'Enceladus', label: 'Enceladus (breathy)' },
  { value: 'Algieba', label: 'Algieba (smooth)' },
  { value: 'Algenib', label: 'Algenib (gravelly)' },
  { value: 'Achernar', label: 'Achernar (soft)' },
  { value: 'Gacrux', label: 'Gacrux (mature)' },
  { value: 'Zubenelgenubi', label: 'Zubenelgenubi (casual)' },
  { value: 'Sadaltager', label: 'Sadaltager (knowledgeable)' },
  { value: 'Charon', label: 'Charon (informative)' },
  { value: 'Leda', label: 'Leda (youthful)' },
  { value: 'Callirrhoe', label: 'Callirrhoe (easy-going)' },
  { value: 'Iapetus', label: 'Iapetus (clear)' },
  { value: 'Despina', label: 'Despina (smooth)' },
  { value: 'Rasalgethi', label: 'Rasalgethi (informative)' },
  { value: 'Alnilam', label: 'Alnilam (firm)' },
  { value: 'Pulcherrima', label: 'Pulcherrima (forward)' },
  { value: 'Vindemiatrix', label: 'Vindemiatrix (gentle)' },
  { value: 'Sulafat', label: 'Sulafat (warm)' },
];

/** Extract unique sources from a model list, preserving insertion order. */
export function sourcesFromModels(models: readonly ModelOption[]): Source[] {
  const seen = new Set<Source>();
  return models.reduce<Source[]>((acc, m) => {
    if (!seen.has(m.source)) {
      seen.add(m.source);
      acc.push(m.source);
    }
    return acc;
  }, []);
}

/**
 * Migrate old Provider-based config to Source-based config.
 * Maps: 'gemini' -> 'genai', 'openai' -> 'openai', 'groq' -> 'groq'.
 */
export function migrateModelConfig(config: Record<string, unknown>): ModelConfig {
  const providerToSource = (p: string): Source => {
    if (p === 'gemini') return 'genai';
    return p as Source;
  };

  const migrated = { ...DEFAULT_MODEL_CONFIG } as ModelConfig;

  if (config.chatProvider && !config.chatSource) {
    migrated.chatModel = (config.chatModel as string) || DEFAULT_MODEL_CONFIG.chatModel;
    migrated.chatSource = providerToSource(config.chatProvider as string);
  }
  if (config.sttProvider && !config.sttSource) {
    migrated.sttModel = (config.sttModel as string) || DEFAULT_MODEL_CONFIG.sttModel;
    migrated.sttSource = providerToSource(config.sttProvider as string);
  }
  if (config.ttsProvider && !config.ttsSource) {
    migrated.ttsModel = (config.ttsModel as string) || DEFAULT_MODEL_CONFIG.ttsModel;
    migrated.ttsVoice = (config.ttsVoice as string) || DEFAULT_MODEL_CONFIG.ttsVoice;
    migrated.ttsSource = providerToSource(config.ttsProvider as string);
  }
  if (config.imageProvider && !config.imageSource) {
    migrated.imageModel = (config.imageModel as string) || DEFAULT_MODEL_CONFIG.imageModel;
    migrated.imageSource = providerToSource(config.imageProvider as string) as 'genai' | 'vertex' | 'openai' | 'openrouter';
  }
  if (config.liveProvider && !config.liveSource) {
    migrated.liveModel = (config.liveModel as string) || DEFAULT_MODEL_CONFIG.liveModel;
    migrated.liveVoice = (config.liveVoice as string) || DEFAULT_MODEL_CONFIG.liveVoice;
    migrated.liveSource = providerToSource(config.liveProvider as string) as 'genai' | 'openai';
  }
  // Fallbacks
  if (config.chatFallbackProvider && !config.chatFallbackSource) {
    migrated.chatFallbackModel = config.chatFallbackModel as string | undefined;
    migrated.chatFallbackSource = providerToSource(config.chatFallbackProvider as string);
  }
  if (config.sttFallbackProvider && !config.sttFallbackSource) {
    migrated.sttFallbackModel = config.sttFallbackModel as string | undefined;
    migrated.sttFallbackSource = providerToSource(config.sttFallbackProvider as string);
  }
  if (config.ttsFallbackProvider && !config.ttsFallbackSource) {
    migrated.ttsFallbackModel = config.ttsFallbackModel as string | undefined;
    migrated.ttsFallbackSource = providerToSource(config.ttsFallbackProvider as string);
    migrated.ttsFallbackVoice = config.ttsFallbackVoice as string | undefined;
  }

  return migrated;
}
