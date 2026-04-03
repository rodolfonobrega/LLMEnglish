export type Provider = 'openai' | 'gemini' | 'groq';

export type ConversationTone = 'casual' | 'balanced' | 'formal';

/** All configurable model slots in the app. */
export interface ModelConfig {
  // --- Text generation (prompts, evaluation, scenario generation) ---
  chatModel: string;
  chatProvider: Provider;

  // --- Speech-to-text ---
  sttModel: string;
  sttProvider: Provider;

  // --- Text-to-speech ---
  ttsModel: string;
  ttsVoice: string;
  ttsProvider: Provider;

  // --- Image generation (no Groq support) ---
  imageModel: string;
  imageProvider: 'openai' | 'gemini';

  // --- Live Roleplay (real-time audio, no Groq support) ---
  liveModel: string;
  liveVoice: string;
  liveProvider: 'openai' | 'gemini';

  // --- Fallbacks (optional -- undefined means no fallback) ---
  chatFallbackModel?: string;
  chatFallbackProvider?: Provider;
  sttFallbackModel?: string;
  sttFallbackProvider?: Provider;
  ttsFallbackModel?: string;
  ttsFallbackProvider?: Provider;
  ttsFallbackVoice?: string;
}

export interface UserContext {
  profile: string;
  interests: string;
  goals: string;
  currentLevel: string;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  chatModel: 'gemini-3.1-flash-lite-preview',
  chatProvider: 'gemini',

  sttModel: 'gemini-3.1-flash-lite-preview',
  sttProvider: 'gemini',

  ttsModel: 'gemini-2.5-flash-preview-tts',
  ttsVoice: 'Kore',
  ttsProvider: 'gemini',

  imageModel: 'gemini-3.1-flash-image-preview', // Nano Banana 2
  imageProvider: 'gemini',

  liveModel: 'gemini-3.1-flash-live-preview',
  liveVoice: 'Puck',
  liveProvider: 'gemini',
};

// --- Option lists for the Settings UI ---

export const CHAT_MODELS = [
  // Gemini 3.1
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (smartest)', provider: 'gemini' as const },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (fast & cheap)', provider: 'gemini' as const },
  // Gemini 3.0
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'gemini' as const },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'gemini' as const },
  // Gemini 2.x
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (stable)', provider: 'gemini' as const },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', provider: 'gemini' as const },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (reasoning)', provider: 'gemini' as const },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' as const },
  // OpenAI
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (cheapest)', provider: 'openai' as const },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' as const },
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' as const },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' as const },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' as const },
  { value: 'o4-mini', label: 'o4-mini (reasoning)', provider: 'openai' as const },
  // Groq
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (fast & smart)', provider: 'groq' as const },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)', provider: 'groq' as const },
  { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick', provider: 'groq' as const },
  { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', provider: 'groq' as const },
];

export const STT_MODELS = [
  // Gemini (multimodal: audio sent inline, model transcribes)
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (fast & cheap)', provider: 'gemini' as const },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'gemini' as const },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'gemini' as const },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (stable)', provider: 'gemini' as const },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' as const },
  // OpenAI
  { value: 'whisper-1', label: 'Whisper v1', provider: 'openai' as const },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe', provider: 'openai' as const },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe', provider: 'openai' as const },
  // Groq (Whisper on Groq hardware -- very fast)
  { value: 'whisper-large-v3', label: 'Whisper Large V3 (Groq)', provider: 'groq' as const },
  { value: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo (Groq)', provider: 'groq' as const },
];

export const TTS_MODELS = [
  // Gemini
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', provider: 'gemini' as const },
  { value: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS (quality)', provider: 'gemini' as const },
  // OpenAI
  { value: 'tts-1', label: 'TTS-1 (fast)', provider: 'openai' as const },
  { value: 'tts-1-hd', label: 'TTS-1 HD (quality)', provider: 'openai' as const },
  { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS', provider: 'openai' as const },
  // Groq (Orpheus -- max 200 chars per request, WAV only)
  { value: 'canopylabs/orpheus-v1-english', label: 'Orpheus English (Groq)', provider: 'groq' as const },
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

export const IMAGE_MODELS = [
  // === Nano Banana 2 (Gemini 3.1 Multimodal) ===
  { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (Gemini 3.1 Flash)', provider: 'gemini' as const },
  // === Nano Banana (Gemini Multimodal) ===
  { value: 'gemini-2.5-flash-image', label: 'Nano Banana (Gemini 2.5 Flash)', provider: 'gemini' as const },
  { value: 'gemini-3-pro-image', label: 'Nano Banana Pro (Gemini 3 Pro)', provider: 'gemini' as const },

  // === Imagen (requires Google Cloud billing account) ===
  // Dedicated image generation models via Vertex AI or Generative Language API
  { value: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4.0 Ultra (Best Quality)', provider: 'gemini' as const },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0 (Balanced)', provider: 'gemini' as const },
  { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast (Fastest)', provider: 'gemini' as const },

  // === OpenAI GPT Image (works with API key - no billing required) ===
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5 (Best)', provider: 'openai' as const },
  { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini (Fast & Affordable)', provider: 'openai' as const },
  { value: 'gpt-image-1', label: 'GPT Image 1 (Balanced)', provider: 'openai' as const },
];

export const LIVE_MODELS = [
  // Gemini Live
  { value: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (latest)', provider: 'gemini' as const },
  { value: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash Native Audio', provider: 'gemini' as const },
  // OpenAI Realtime
  { value: 'gpt-realtime', label: 'GPT Realtime', provider: 'openai' as const },
  { value: 'gpt-realtime-1.5', label: 'GPT Realtime 1.5', provider: 'openai' as const },
  { value: 'gpt-realtime-mini', label: 'GPT Realtime Mini', provider: 'openai' as const },
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
