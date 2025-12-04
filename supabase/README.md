# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details:
   - Name: `quizroom`
   - Database Password: (save this securely)
   - Region: Choose closest to your users (e.g., `ap-northeast-2` for Korea)

## 2. Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# From Supabase Dashboard > Settings > API
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_API_KEY=your-api-key

# From Supabase Dashboard > Settings > API > Service Role Key (keep secret!)
SUPABASE_SECRET_API_KEY=your-secret-api-key

# For Supabase CLI
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_PROJECT_ID=your-project-id
```

## 3. OAuth Setup

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Add credentials to Supabase Dashboard > Authentication > Providers > Google

### Apple OAuth
1. Go to [Apple Developer Console](https://developer.apple.com)
2. Create a Services ID for Sign in with Apple
3. Configure redirect URL: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Add credentials to Supabase Dashboard > Authentication > Providers > Apple

## 4. Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## 5. Local Development

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop
```

## Directory Structure

```
supabase/
├── config.toml          # Local dev configuration
├── migrations/          # Database migrations
│   └── 00001_initial_schema.sql
├── functions/           # Edge Functions
│   ├── daily-quiz/
│   ├── swipe-feed/
│   ├── submit-answer/
│   └── room-*
└── seed.sql            # Initial seed data
```
