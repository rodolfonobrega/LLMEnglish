# Complete API Smoke Tests

Testes abrangentes para TODAS as APIs de IA integradas no projeto, usando modelos baratos.

## O que é testado

### ✅ OpenAI API
- **Chat**: gpt-4o-mini (modelo barato)
- **TTS (Text-to-Speech)**: gpt-4o-mini-tts
- **STT (Speech-to-Text)**: whisper-1
- **Image Generation**: gpt-image-1-mini (modelo mais econômico)

### ✅ Gemini API (Google AI Studio)
- **Chat**: gemini-2.5-flash (modelo rápido e barato)
- **TTS**: gemini-2.5-flash-preview-tts
- **STT**: gemini-2.5-flash (multimodal)
- **Image Generation**: gemini-2.5-flash-image
- **Live API**: ⚠️ Testado separadamente (requer WebSocket)

### ✅ Groq API
- **Chat**: llama-3.1-8b-instant (super rápido e barato)
- **TTS**: canopylabs/orpheus-v1-english
- **STT**: whisper-large-v3-turbo

### ✅ OpenRouter API (Multi-Provider)
- **Chat**: google/gemma-3-27b-it (gratuito/barato)
- **Chat**: meta-llama/llama-3.1-8b-instruct
- **Image**: bytedance-seed/seedream-4.5
- **Image**: google/gemini-3.1-flash-image-preview

### ✅ Testes Cruzados
- **Cross-Provider Comparison**: Mesmo prompt para todos os providers
- **Configuration Report**: Status de todas as chaves de API

## Pré-requisitos

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.local.example .env.local
   ```

2. Preencha com suas chaves de API:
   ```env
   VITE_OPENAI_API_KEY=sk-...
   VITE_GEMINI_API_KEY=AIza...
   VITE_GROQ_API_KEY=gsk_...
   VITE_OPENROUTER_API_KEY=sk-or-...
   ```

   **Onde conseguir as chaves:**
   - OpenAI: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/app/apikey
   - Groq: https://console.groq.com/keys
   - OpenRouter: https://openrouter.ai/keys

## Como executar

### Executar todos os testes completos:
```bash
RUN_PAID_SMOKE_TESTS=true npm run test:api:complete
```

### Executar apenas testes de um provider específico:
Os testes pulam automaticamente providers sem chave configurada.

### Ver resultados detalhados:
```bash
RUN_PAID_SMOKE_TESTS=true npm run test:api:complete -- --reporter=verbose
```

## Saída esperada

Você verá algo como:

```
✅ OpenAI Chat: Hello from OpenAI
✅ OpenAI TTS: Generated 45230 bytes
✅ OpenAI STT transcription: 
✅ OpenAI Image generated successfully

✅ Gemini Chat: Hello from Gemini
✅ Gemini TTS: Generated audio data
✅ Gemini STT transcription: 
✅ Gemini Image generated successfully

✅ Groq Chat: Hello from Groq
✅ Groq TTS: Generated 32100 bytes
✅ Groq STT transcription: 

✅ OpenRouter Chat (Gemma): Hello from OpenRouter
✅ OpenRouter Chat (Llama): Hello from Llama
✅ OpenRouter Image (Seedream) generated successfully
✅ OpenRouter Image (Gemini) generated successfully

📊 Cross-Provider Comparison:
Prompt: What is 2+2? Answer with just the number.
  openai: 4
  genai: 4
  groq: 4
  openrouter: 4

🔧 API Key Configuration:
  openai: ✅ Configured
  gemini: ✅ Configured
  groq: ✅ Configured
  openrouter: ✅ Configured

📈 4/4 providers configured
```

## Custos estimados

Todos os testes usam modelos baratos:

| Provider | Capability | Modelo | Custo estimado |
|----------|-----------|--------|----------------|
| OpenAI | Chat | gpt-4o-mini | ~$0.0001 |
| OpenAI | TTS | gpt-4o-mini-tts | ~$0.002 |
| OpenAI | STT | whisper-1 | ~$0.006 |
| OpenAI | Image | gpt-image-1-mini | ~$0.025 |
| Gemini | Chat | gemini-2.5-flash | Gratuito (tier free) |
| Gemini | TTS | gemini-2.5-flash-preview-tts | Gratuito |
| Gemini | STT | gemini-2.5-flash | Gratuito |
| Gemini | Image | gemini-2.5-flash-image | Gratuito |
| Groq | Chat | llama-3.1-8b-instant | Gratuito |
| Groq | TTS | orpheus-v1-english | Gratuito |
| Groq | STT | whisper-large-v3-turbo | Gratuito |
| OpenRouter | Chat | gemma-3-27b-it | ~$0.0001 |
| OpenRouter | Image | seedream-4.5 | ~$0.01 |

**Custo total por execução: ~$0.05-0.10 USD** (dependendo dos providers configurados)

## Troubleshooting

### "No key" errors
- Verifique se o arquivo `.env.local` existe e tem as chaves
- Execute com `RUN_PAID_SMOKE_TESTS=true`

### Timeout errors
- Os testes têm timeout de 60-120 segundos
- Verifique sua conexão de internet
- Alguns providers podem estar lentos

### 401 Unauthorized
- Chave de API inválida ou expirada
- Verifique se a chave está correta no `.env.local`

### 429 Too Many Requests
- Limite de rate limit atingido
- Aguarde alguns segundos e tente novamente

## Estrutura de arquivos

```
src/
├── services/
│   ├── completeApiSmoke.test.ts    ← NOVO: Teste completo de todas as APIs
│   ├── providerCapabilities.smoke.test.ts  ← Teste original
│   └── modelCatalog.smoke.test.ts          ← Teste de matriz de modelos
└── test/
    └── smoke/
        └── smokeTestUtils.ts               ← Utilitários compartilhados
```

## Notas técnicas

- **Arquivos de áudio**: Gerados programaticamente como WAV silencioso (1 segundo, 16kHz)
- **Paralelismo**: Desabilitado (`fileParallelism: false`) para evitar rate limits
- **Timeout**: 120 segundos por teste
- **Environment**: Node (não browser)
- **Config**: `vitest.smoke.config.ts`

## Links úteis

- [OpenAI Models](https://platform.openai.com/docs/models)
- [Google AI Studio](https://aistudio.google.com/)
- [Groq Console](https://console.groq.com/)
- [OpenRouter Models](https://openrouter.ai/models)
