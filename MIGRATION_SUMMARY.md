# Supabase Migration Summary

## Overview

This document summarizes the migration of SpeakLab from LocalStorage to Supabase for cloud sync, secure API key storage, OAuth authentication, and persisted error analytics, while keeping ephemeral TTS audio in browser cache.

## Files Created

### Type Definitions
- `src/types/supabase.ts` - Complete TypeScript types matching the database schema

### Supabase Services
- `src/services/supabase/client.ts` - Supabase client singleton
- `src/services/supabase/auth.ts` - OAuth authentication and profile management
- `src/services/supabase/storage.ts` - CRUD operations for all data
- `src/services/supabase/aiProxy.ts` - Edge Function client for AI API calls
- `src/services/supabase/index.ts` - Centralized exports
- `src/services/runtimeState.ts` - In-memory runtime state hydrated from Supabase for sync consumers

### Context
- `src/contexts/AuthContext.tsx` - Authentication context provider

### Components
- `src/components/auth/LoginPage.tsx` - OAuth login page (Google, GitHub)
- `src/components/auth/MigrationPage.tsx` - LocalStorage to Supabase migration UI

### Utilities
- `src/utils/encryption.ts` - AES-256-GCM encryption for API keys
- `src/utils/migrateToSupabase.ts` - Data migration logic
- `src/services/errorAnalysis.ts` - Error analytics persisted in Supabase

### Database
- `supabase/schema.sql` - Complete database schema with RLS policies
- `supabase/functions/ai-proxy/index.ts` - Edge Function for secure AI API calls
- `supabase/README.md` - Setup guide for Supabase

### Configuration
- `.env.local.example` - Environment variable template
- Updated `vite.config.ts` with Supabase env var documentation
- Updated `tsconfig.app.json` and `src/test/setup.ts` for the Supabase/Vitest runtime

## Files Modified

### Core
- `src/App.tsx` - Added auth routes and AuthProvider wrapper

### Settings
- `src/components/settings/SettingsPage.tsx` - Updated to use Supabase storage, added user profile display and logout button

### Runtime / Auth
- `src/contexts/AuthContext.tsx` - Hydrates runtime state after auth bootstrap
- `src/services/gamification.ts` - Persists XP/session data in Supabase and refreshes runtime gamification state

### Dependencies
- `package.json` - Added `@supabase/supabase-js`

## Database Schema

The following tables are created:

| Table | Purpose |
|-------|---------|
| `profiles` | User profile extending auth.users |
| `cards` | Flashcards with SM-2 data |
| `card_reviews` | Historical review data |
| `card_evaluations` | Latest evaluation per card |
| `gamification` | XP, level, streaks, stats |
| `badges` | User achievement badges |
| `live_sessions` | Real-time audio roleplay sessions |
| `conversation_turns` | Individual conversation turns |
| `conversation_analyses` | Post-session analysis |
| `session_reports` | Daily/session reports |
| `path_progress` | Trail completion progress |
| `model_config` | User's AI model configuration |
| `encrypted_api_keys` | Securely stored API keys |
| `error_patterns` | Persisted error pattern analytics |
| `error_snapshots` | Progress snapshots for the error dashboard |

## Security Features

1. **Row Level Security (RLS)**: All tables have RLS enabled
2. **API Key Encryption**: Keys are encrypted with AES-256-GCM
3. **Edge Function Proxy**: AI API calls go through a secure Edge Function
4. **OAuth Authentication**: Google and GitHub OAuth support

## Storage Buckets

- `card-audio` - User recordings
- `conversation-audio` - Live session audio
- `session-dialogues` - Analyzed dialogues
- `card-images` - Generated images

## Next Steps

1. **Set up Supabase project**: Follow `supabase/README.md`
2. **Deploy Edge Function**: Deploy `ai-proxy` function
3. **Test OAuth**: Configure Google and GitHub OAuth providers
4. **Test migration**: Run the app and migrate LocalStorage data
5. **Verify runtime hydration**: Ensure settings, keys, gamification, and sync consumers are hydrated after login

## Backward Compatibility

The legacy `src/services/storage.ts` file now survives mainly as a sync compatibility layer for runtime-backed reads used by some services/hooks (`getModelConfig`, API key getters, gamification snapshot) plus browser-local TTS cache. Active user data flows should use `src/services/supabase/*`.

## Migration Path for Users

1. User signs in with OAuth
2. App detects LocalStorage data
3. Migration page shows summary of data to migrate
4. User confirms migration
5. Data is synced to Supabase
6. LocalStorage data is kept as backup

## Testing

TypeScript compilation and ESLint pass. The current production build still emits a Vite chunk-size warning for the main bundle, but the build succeeds.
