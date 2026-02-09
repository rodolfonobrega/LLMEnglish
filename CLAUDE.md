# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
make dev            # Start dev server with hot-reload at http://localhost:5173
make build          # Production build (TypeScript check + Vite build)
make preview        # Build and serve locally at http://localhost:5173
make lint           # Run ESLint
```

### Docker Deployment
```bash
make docker-build   # Build Docker image
make docker-run     # Run container at http://localhost:8888
make docker-stop    # Stop and remove container
make docker-logs    # Tail container logs
```

### Dependencies
```bash
make install        # Install dependencies (npm ci)
make clean          # Remove dist/ and node_modules/
```

## Architecture Overview

**SpeakLab** is a client-side-only React application for English learning, targeting Portuguese speakers. All data persistence is via LocalStorage - no backend server required.

### Tech Stack
- React 19 + TypeScript + Vite 6
- Tailwind CSS 4 with Base UI components
- React Router 7 for navigation
- Multi-provider AI support: OpenAI API and Google Gemini API

### Directory Structure

```
src/
├── components/
│   ├── discovery/       # 4 exercise types: Phrase, Text, RolePlay, Image
│   ├── review/          # Spaced repetition (SM-2 algorithm)
│   ├── live-roleplay/   # Real-time audio via Gemini Live/OpenAI Realtime WebSocket
│   ├── library/         # Card management interface
│   ├── settings/        # API keys + model configuration UI
│   ├── layout/          # Header, Navigation, Layout wrapper
│   ├── shared/          # AudioRecorder, ScoreDisplay, EvaluationResults, ThemeSelector
│   └── ui/              # Base UI components from @base-ui/react
├── hooks/               # useAudioRecorder, useTTS, useLocalStorage
├── services/
│   ├── openai.ts        # OpenAI + Gemini REST API calls (chat, TTS, STT, images)
│   ├── openaiRealtime.ts # OpenAI Realtime WebSocket for STT
│   ├── geminiLive.ts    # Gemini Live WebSocket (bidirectional audio)
│   ├── spacedRepetition.ts # SM-2 algorithm implementation
│   ├── storage.ts       # LocalStorage CRUD operations
│   └── gamification.ts  # XP, streaks, badges system
├── types/               # TypeScript interfaces (Card, ModelConfig, etc.)
└── utils/               # Audio helpers, AI prompts
```

### Routes (App.tsx)

- `/` - DiscoveryPage (main practice area with 4 exercise types)
- `/review` - ReviewPage (spaced repetition review)
- `/live` - LiveRoleplayPage (real-time audio conversation)
- `/library` - LibraryPage (card management)
- `/settings` - SettingsPage (API keys + model configuration)

## Key Architecture Patterns

### Service Layer Pattern
All AI API interactions are abstracted into `src/services/`. The main service is `openai.ts` which handles:
- Chat completions (OpenAI and Gemini)
- Text-to-speech (both providers)
- Speech-to-text (both providers)
- Image generation (both providers)

Provider selection is controlled by `ModelConfig` from `src/services/storage.ts`. The `chatCompletion()` function automatically routes to the correct provider based on the configured model.

### Multi-Provider Support
Each AI capability has 5 slots in `ModelConfig`:
1. `chatModel`/`chatProvider` - Text generation, evaluation prompts
2. `sttModel`/`sttProvider` - Speech-to-text transcription
3. `ttsModel`/`ttsVoice`/`ttsProvider` - Text-to-speech
4. `imageModel`/`imageProvider` - Image generation
5. `liveModel`/`liveVoice`/`liveProvider` - Real-time audio conversation

Default configuration uses Gemini for all slots.

### Data Persistence
All data stored in browser LocalStorage via `src/services/storage.ts`:
- `el_cards` - Flashcard deck with SM-2 scheduling data
- `el_gamification` - XP, streaks, badges, level progression
- `el_live_sessions` - Live roleplay conversation history
- `el_openai_key` / `el_gemini_key` - User-entered API keys
- `el_model_config` - Model configuration overrides
- `el_audio_cache` - Cached TTS audio

API keys priority: localStorage (user-entered in Settings) → `.env` file (`VITE_OPENAI_API_KEY` / `VITE_GEMINI_API_KEY`)

### Card Structure (src/types/card.ts)
- `CardType`: `'phrase'` | `'text'` | `'roleplay'` | `'image'`
- SM-2 fields: `easeFactor`, `interval`, `repetitions`, `nextReviewAt`
- `EvaluationResult`: score, corrections, pronunciation feedback, alternatives
- Cards store their latest evaluation and review history

### Spaced Repetition (src/services/spacedRepetition.ts)
Implements the SM-2 algorithm:
- `updateCardSchedule(card, score)` - Updates scheduling based on performance
- `createDefaultCard(partial)` - Factory for new cards with default SM-2 values

### Real-Time Audio (src/services/geminiLive.ts)
Uses `@google/genai` SDK's `live.connect()` for bidirectional WebSocket audio:
- Handles PCM16 audio encoding/decoding
- Schedules audio playback to prevent gaps
- Accumulates transcriptions (user and AI) per turn
- `onTurnComplete` callback signals end of AI response

### Gamification (src/services/gamification.ts)
- XP awarded per exercise completion
- Daily streak tracking via `lastPracticeDate`
- Achievement badges based on milestones
- Level progression with XP thresholds

## Important Notes

### Client-Side Only
This is a personal-use application with no backend. All API keys are stored in LocalStorage. Not suitable for multi-user deployment without authentication.

### Audio Handling
- Recording uses browser's MediaRecorder API
- Gemini returns raw PCM16 at 24kHz - wrapped in WAV via `pcm16Base64ToWavBase64()`
- TTS audio is cached in LocalStorage to reduce API calls
- Microphone access requires HTTPS (or localhost)

### Portuguese Context
The app is designed for Portuguese speakers learning English:
- Exercise prompts are in Portuguese
- Live roleplay scenarios are described in Portuguese (to avoid giving English hints)
- Settings and UI are in Portuguese

### Model Configuration Changes
When adding new model options, update:
- `src/types/settings.ts` - Add to the appropriate `MODELS` array
- Default values in `DEFAULT_MODEL_CONFIG`
- Provider detection logic checks `model.startsWith('gemini')`

### Docker Deployment
- Multi-stage build: Node.js build → nginx serve
- nginx configured for SPA routing (all routes → index.html)
- Default port: 8888 (exposed from container port 80)
- For production, place behind reverse proxy with TLS (microphone requires HTTPS)
