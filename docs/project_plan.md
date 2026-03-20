# QuizRoom Project Plan

This document reflects the current repository state and the implementation direction visible in the codebase today.

## 1. Product Summary

QuizRoom is a mobile quiz app focused on short, repeatable sessions and lightweight social play.

Current gameplay pillars:

- `Daily Quiz`
  - one daily quiz experience
  - short session length
  - category-aware copy and share-style reward framing
- `Swipe`
  - category-based question stream
  - low-friction restart loop
  - recent category shortcuts from home
- `Live Match`
  - room-based multiplayer sessions
  - room code create/join flow
  - deck selection and real-time room progression
- `Profile`
  - guest-to-auth upgrade path
  - XP, streak, level, and history
  - settings and account controls

## 2. Current Technical Direction

The active implementation is:

- Client: `React Native + Expo + TypeScript`
- Navigation: `Expo Router`
- Backend: `Supabase`
- Auth: `Supabase Auth`, `Google`, `Apple`, guest mode
- Realtime: `Supabase Realtime` plus Edge Function-driven room state
- Database: `Supabase Postgres`

This replaces the older exploratory `Convex + Gemini` planning direction. That older plan is not the live architecture of this repository.

## 3. Current App Surface

### Home

The home screen is the main launcher for the rest of the app.

Current responsibilities:

- show quick start actions based on recent usage
- load the daily quiz
- link into skill assessment
- allow room join by code
- refresh core homepage data

Primary file:

- `app/(tabs)/home.tsx`

### Swipe

Swipe mode is the repeatable single-player session loop.

Current responsibilities:

- choose a category
- persist the recent category
- render the swipe stack flow
- support completion/reset behavior

Primary files:

- `app/(tabs)/swipe.tsx`
- `components/swipe/swipe-stack.tsx`
- `components/swipe/swipe-card.tsx`
- `components/swipe/answer-sheet.tsx`

### Live Match

Live Match is the synchronous multiplayer mode.

Current responsibilities:

- fetch available live-match decks
- create room from a selected deck
- join room by code
- reconnect to room state
- handle room actions through Edge Functions

Primary files:

- `app/(tabs)/live-match.tsx`
- `app/room/[code].tsx`
- `hooks/use-live-match-room.ts`
- `hooks/use-live-game.ts`
- `hooks/use-live-lobby.ts`
- `lib/supabase-api.ts`

### Profile

Profile combines player identity, progress, settings, and account controls.

Current responsibilities:

- guest and authenticated views
- profile handle editing
- streak and XP display
- quiz history browsing
- theme preference
- sign-out and account deletion

Primary file:

- `app/(tabs)/profile.tsx`

## 4. Current Backend Responsibilities

### Auth Layer

The app currently supports:

- guest mode with local guest key persistence
- Google sign-in
- Apple sign-in
- profile creation/linking on first authenticated session
- realtime user row syncing

Primary files:

- `hooks/use-supabase-auth.tsx`
- `hooks/use-unified-auth.tsx`
- `lib/supabase.ts`

### Edge Functions

Implemented function areas include:

- quiz delivery
  - `daily-quiz`
  - `swipe-feed`
  - `deck-feed`
  - `live-match-decks`
- room lifecycle
  - `room-create`
  - `room-join`
  - `room-lobby`
  - `room-state`
  - `room-action`
- result/history logging
  - `quiz-history`
  - `log-daily-result`
  - `log-swipe-answer`
  - `log-swipe-result`
- account management
  - `account-delete`

Directory:

- `supabase/functions/`

### Database

The repository contains:

- initial schema migration
- follow-up migrations for cron jobs, activity days, and display name source
- seed SQL for local setup
- generated database TypeScript types

Primary paths:

- `supabase/migrations/`
- `supabase/seed/`
- `lib/database.types.ts`

## 5. Current User Flows

### Guest to Authenticated Upgrade

1. User enters as guest or unauthenticated.
2. Guest key is created and persisted locally.
3. User can still play core modes.
4. On Google/Apple sign-in, the app loads or creates a `users` row.
5. The profile and game loops then use the authenticated identity.

### Daily Quiz Loop

1. Home requests the current daily quiz.
2. User opens the daily screen.
3. Result is logged and reflected in XP/history.
4. Home/profile refresh paths can surface the updated state.

### Swipe Loop

1. User chooses a category.
2. Swipe stack serves questions for that category.
3. Completion state is shown in-session.
4. Recent category is persisted for quick start on home.

### Live Match Loop

1. User creates a room from a deck or joins by room code.
2. Lobby and room state are fetched from Supabase functions.
3. Room actions are submitted through `room-action`.
4. Room state and reconnect behavior support live progression.
5. Match results can flow into history/progress.

## 6. Current Engineering Priorities

These are the priorities implied by the current codebase:

- stabilize auth across guest, Google, Apple, and upgrade paths
- keep home/dashboard flows fast and restart-friendly
- improve live-match resilience, reconnect behavior, and room state handling
- maintain history/progress correctness for XP, streak, and recent activity
- keep category/deck shortcuts lightweight and persistent

## 7. Documentation Truth Sources

When documentation and code disagree, prefer these as the source of truth:

1. `app/` for screen behavior and navigation
2. `hooks/` for state and auth flows
3. `lib/supabase-api.ts` for backend integration shape
4. `supabase/functions/` for server behavior
5. `supabase/migrations/` for data model evolution

## 8. Local Development Checklist

### App

```bash
npm install
npm run start
```

### Native Targets

```bash
npm run android
npm run ios
```

### Web

```bash
npm run web
```

### Supabase

```bash
npm run supabase:start
npm run supabase:db:push
npm run supabase:gen:types
```

## 9. Environment Requirements

The current app expects these environment variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_API_KEY=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

## 10. Near-Term Doc Maintenance Notes

The following stale assumptions were removed from this document:

- default Expo starter positioning
- Convex as the active backend
- Gemini as the active server-side generation path

If those directions return later, they should be documented as future roadmap items, not current implementation facts.
