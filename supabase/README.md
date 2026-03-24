# Supabase Setup Guide for SpeakLab

This guide covers setting up Supabase for SpeakLab's cloud sync, authentication, and secure API key storage.

## Prerequisites

- A Supabase account (free tier works)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Set project name (e.g., `speaklab`)
5. Set a secure database password
6. Choose a region close to your users
7. Click "Create new project"

## Step 2: Get Your API Credentials

1. Go to Project Settings → API
2. Copy your project URL and anon key
3. Add them to your `.env.local` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 3: Run the Database Schema

1. Go to the SQL Editor in Supabase
2. Copy the contents of `supabase/schema.sql`
3. Paste and run the script

This creates:
- All tables (profiles, cards, gamification, etc.)
- Row Level Security (RLS) policies
- Indexes for performance
- Helper functions

## Step 4: Enable OAuth Providers

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth client ID
5. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
6. Copy Client ID and Secret

In Supabase:
1. Go to Authentication → Providers
2. Enable Google provider
3. Paste Client ID and Secret
4. Save

### GitHub OAuth

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Homepage URL: `http://localhost:5173` (for dev)
4. Set Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
5. Copy Client ID and generate Client Secret

In Supabase:
1. Go to Authentication → Providers
2. Enable GitHub provider
3. Paste Client ID and Secret
4. Save

## Step 5: Create Storage Buckets

1. Go to Storage in Supabase
2. Create these buckets (all public):
   - `card-audio` - User recordings
   - `tts-cache` - TTS audio cache
   - `conversation-audio` - Live session audio
   - `session-dialogues` - Analyzed dialogues
   - `card-images` - Generated images

For each bucket:
1. Enable public bucket
2. Add RLS policy:
   ```sql
   CREATE POLICY "Users can upload"
     ON storage.objects FOR INSERT
     WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

   CREATE POLICY "Users can view own files"
     ON storage.objects FOR SELECT
     USING (auth.uid()::text = (storage.foldername(name))[1]);
   ```

## Step 6: Deploy Edge Function

The `ai-proxy` Edge Function handles AI API calls securely.

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Deploy the Edge Function:
   ```bash
   supabase functions deploy ai-proxy
   ```

4. Set the encryption key secret:
   ```bash
   supabase secrets set ENCRYPTION_KEY=your-32-byte-hex-string
   ```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 7: Test the Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:5173
3. Click "Sign in with Google" or "Sign in with GitHub"
4. After login, you'll be redirected to the migration page (if you have LocalStorage data)

## Troubleshooting

### OAuth callback errors

Make sure the redirect URL in your OAuth provider settings matches:
```
https://your-project.supabase.co/auth/v1/callback
```

### Edge Function errors

Check the Edge Function logs in Supabase Dashboard → Edge Functions.

### RLS policy errors

Make sure you've run the schema SQL which creates all RLS policies.

## Migration from LocalStorage

After logging in:
1. The app will detect LocalStorage data
2. You'll see a migration page with data summary
3. Click "Migrate Data" to sync everything to Supabase
4. Your data will be available on all devices

## Security Notes

- API keys are encrypted before storage (AES-256-GCM)
- Direct SELECT on `encrypted_api_keys` is blocked by RLS
- Only the Edge Function can decrypt keys (using server-side secret)
- Users can only access their own data (RLS enforces `auth.uid() = user_id`)
