# Supabase Migration Summary

## Overview

This document summarizes the migration of SpeakLab from LocalStorage to Supabase for cloud sync, secure API key storage, and OAuth authentication.

## Files Created

### Type Definitions
- `src/types/supabase.ts` - Complete TypeScript types matching the database schema

### Supabase Services
- `src/services/supabase/client.ts` - Supabase client singleton
- `src/services/supabase/auth.ts` - OAuth authentication and profile management
- `src/services/supabase/storage.ts` - CRUD operations for all data
- `src/services/supabase/aiProxy.ts` - Edge Function client for AI API calls
- `src/services/supabase/index.ts` - Centralized exports

### Context
- `src/contexts/AuthContext.tsx` - Authentication context provider

### Components
- `src/components/auth/LoginPage.tsx` - OAuth login page (Google, GitHub)
- `src/components/auth/MigrationPage.tsx` - LocalStorage to Supabase migration UI

### Utilities
- `src/utils/encryption.ts` - AES-256-GCM encryption for API keys
- `src/utils/migrateToSupabase.ts` - Data migration logic

### Database
- `supabase/schema.sql` - Complete database schema with RLS policies
- `supabase/functions/ai-proxy/index.ts` - Edge Function for secure AI API calls
- `supabase/README.md` - Setup guide for Supabase

### Configuration
- `.env.local.example` - Environment variable template
- Updated `vite.config.ts` with Supabase env var documentation

## Files Modified

### Core
- `src/App.tsx` - Added auth routes and AuthProvider wrapper

### Settings
- `src/components/settings/SettingsPage.tsx` - Updated to use Supabase storage, added user profile display and logout button

### Dependencies
- `package.json` - Added `@supabase/supabase-js` and `@supabase/ssr`

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

## Security Features

1. **Row Level Security (RLS)**: All tables have RLS enabled
2. **API Key Encryption**: Keys are encrypted with AES-256-GCM
3. **Edge Function Proxy**: AI API calls go through a secure Edge Function
4. **OAuth Authentication**: Google and GitHub OAuth support

## Storage Buckets

- `card-audio` - User recordings
- `tts-cache` - TTS audio cache
- `conversation-audio` - Live session audio
- `session-dialogues` - Analyzed dialogues
- `card-images` - Generated images

## Next Steps

1. **Set up Supabase project**: Follow `supabase/README.md`
2. **Deploy Edge Function**: Deploy `ai-proxy` function
3. **Test OAuth**: Configure Google and GitHub OAuth providers
4. **Test migration**: Run the app and migrate LocalStorage data
5. **Update remaining components**: Update other pages to use Supabase if needed

## Backward Compatibility

The LocalStorage functions remain in `src/services/storage.ts` for:
- Development without Supabase
- Fallback during migration
- Offline capability (if needed in the future)

## Migration Path for Users

1. User signs in with OAuth
2. App detects LocalStorage data
3. Migration page shows summary of data to migrate
4. User confirms migration
5. Data is synced to Supabase
6. LocalStorage data is kept as backup

## Testing

All TypeScript compilation passes with no errors.
