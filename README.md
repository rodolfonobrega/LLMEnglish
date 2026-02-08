# SpeakLab — English Speaking Practice App

A flashcard-style English speaking practice app powered by AI. Record yourself speaking, get instant evaluation with pronunciation feedback, and practice real-time conversations with an AI partner.

---

## Quick Start

### 1. Get your API keys

You need **at least one** of these (both recommended for full functionality):

| Provider | What it powers | Get a key |
|---|---|---|
| **OpenAI** | Text generation, speech-to-text, text-to-speech, image generation | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Google Gemini** | Live Roleplay (real-time audio conversations), optionally text generation | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

### 2. Run the app

**Option A — Docker (recommended):**

```bash
make docker-build    # build the image
make docker-run      # run at http://localhost:8888
```

**Option B — Local development:**

```bash
make install         # install dependencies
make dev             # start dev server at http://localhost:5173
```

### 3. Configure the app

1. Open the app in your browser
2. Go to **Settings** (gear icon in the bottom navigation bar)
3. Paste your **OpenAI API Key** and/or **Gemini API Key**
4. Choose your preferred models (or keep the defaults)
5. Click **Save Settings**

You're ready to go!

---

## Features

### Discovery Mode
Practice new content with four exercise types:

- **Phrase Translation** — AI gives you a short phrase in Portuguese, you speak it in English
- **Text Translation** — Longer passages (spoken language: ordering food, telling stories, presentations)
- **Role-Play** — AI describes a situation, you speak how you'd handle it
- **Image Description** — AI generates an image, you describe what you see

Each exercise includes:
- Target vocabulary input (comma-separated words you want to practice)
- Context/topic field (e.g., "job interview", "pyspark")
- Theme selector (food, travel, work, etc.)
- Audio recording with playback before submitting
- Discard and re-record option
- AI evaluation: score, corrections, better alternatives, pronunciation feedback

### Review Mode
Spaced repetition (SM-2 algorithm) for saved cards:
- Only shows the prompt — never the answer
- Tracks review history, correct count, average score
- Adjusts scheduling based on your performance

### Live Roleplay
Real-time audio conversation with an AI partner via Gemini Live API:
- AI creates a scenario (description in Portuguese to avoid giving you English hints)
- You're always the customer/tourist/client
- Natural back-and-forth conversation
- Post-conversation analysis with clean dialogue transcript
- Shadowing Lab: generate full dialogue audio with two different voices

### Library
Manage all your saved cards:
- View review stats per card
- Listen to AI audio for any card
- Edit, delete, or manually add cards
- View detailed evaluation results
- Schedule cards for review

### Gamification
- XP for every exercise
- Daily streak tracking
- Level progression
- Achievement badges

---

## Model Configuration

All models are configurable from the **Settings** page. Here's what each slot does:

| Slot | Default | Options | Needs |
|---|---|---|---|
| **Text Generation** | `gpt-4o-mini` (OpenAI) | GPT-4o, GPT-4.1, o4-mini, Gemini Flash/Pro | OpenAI or Gemini key |
| **Speech-to-Text** | `whisper-1` | GPT-4o Transcribe variants | OpenAI key |
| **Text-to-Speech** | `tts-1` / `nova` | TTS-1 HD, GPT-4o Mini TTS / 10 voice options | OpenAI key |
| **Image Generation** | `dall-e-3` | DALL-E 2, GPT Image 1 | OpenAI key |
| **Live Roleplay** | `gemini-2.0-flash-exp` / `Aoede` | Gemini Live models / 5 voice options | Gemini key |

If you pick a Gemini model for text generation, it will use your Gemini key automatically.

---

## Project Structure

```
src/
├── components/
│   ├── discovery/       Phrase, Text, RolePlay, Image modes
│   ├── review/          Spaced repetition review session
│   ├── live-roleplay/   Real-time audio conversation
│   ├── library/         Card management
│   ├── settings/        API keys + model configuration
│   ├── layout/          Header, Navigation, Layout
│   └── shared/          AudioRecorder, ScoreDisplay, EvaluationResults, ThemeSelector
├── hooks/               useAudioRecorder, useTTS, useLocalStorage
├── services/
│   ├── openai.ts        OpenAI + Gemini REST API calls
│   ├── openaiRealtime.ts  OpenAI Realtime WebSocket (STT)
│   ├── geminiLive.ts    Gemini Live WebSocket (audio conversation)
│   ├── spacedRepetition.ts  SM-2 algorithm
│   ├── storage.ts       LocalStorage CRUD
│   └── gamification.ts  XP, streaks, badges
├── types/               TypeScript interfaces
└── utils/               Audio helpers, AI prompts
```

---

## Available Commands

```bash
make help            # show all commands

# Local
make install         # npm ci
make dev             # dev server with hot-reload
make build           # production build
make preview         # build + serve locally
make clean           # remove dist/ and node_modules/

# Docker
make docker-build    # build image
make docker-run      # run container (port 8888)
make docker-stop     # stop container
make docker-restart  # stop + run
make docker-logs     # tail container logs
```

---

## Tech Stack

- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS 4** for styling
- **React Router 7** for navigation
- **Lucide React** for icons
- **OpenAI API** — GPT, Whisper, TTS, DALL-E
- **Gemini Live API** — real-time audio via WebSocket
- **LocalStorage** for all data persistence
- **Docker** + **nginx** for production deployment

---

## Notes

- **API keys are stored in your browser's LocalStorage.** This is a client-side-only app with no backend server. Suitable for personal use.
- **Microphone access is required** for audio recording. Your browser will ask for permission on first use.
- **HTTPS is required** for microphone access in production. The Docker setup uses nginx on port 80 — put it behind a reverse proxy with TLS for production use.
