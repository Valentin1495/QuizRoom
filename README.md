# QuizRoom

QuizRoom is an Expo/React Native quiz app built around three core play loops:

- `Daily Quiz`: a short daily O/X-style quiz
- `Swipe`: category-based rapid quiz sessions
- `Live Match`: real-time room-based multiplayer quiz matches

The current app uses `Expo Router` for navigation and `Supabase` for auth, data, realtime sync, and Edge Functions.

## Current Stack

- Client: `Expo`, `React Native`, `TypeScript`, `expo-router`
- Auth: `Supabase Auth`, `Google Sign-In`, `Apple Sign-In`, guest mode
- Backend: `Supabase Postgres`, `Supabase Realtime`, `Supabase Edge Functions`
- UI: `react-native-reanimated`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`

## Main Product Areas

- `Home`
  - quick start shortcuts for recent swipe/live-match activity
  - daily quiz entry and countdown
  - skill assessment entry
  - room-code join flow
- `Swipe`
  - category picker
  - swipe-style question flow
  - recent category persistence
- `Live Match`
  - create room from a deck
  - join room by code
  - room/lobby/game state driven by Supabase functions
- `Profile`
  - authenticated and guest variants
  - XP, streak, level, history
  - profile handle editing
  - theme preference
  - sign-out and account deletion

## Repo Structure

```text
app/                     Expo Router screens
components/              Reusable UI and feature components
hooks/                   Auth, quiz, room, theme, and data hooks
lib/                     Supabase client, API wrappers, helpers
constants/               Theme, categories, decks, challenges
supabase/
  migrations/            Database schema changes
  functions/             Edge Functions used by the app
  seed/                  Local seed SQL
assets/                  Images and local quiz data
docs/                    Product and implementation notes
```

## Important Routes

- `app/_layout.tsx`: app root, auth gate, theme provider, toast host
- `app/(tabs)/home.tsx`: home dashboard
- `app/(tabs)/swipe.tsx`: swipe quiz mode
- `app/(tabs)/live-match.tsx`: live match lobby/create screen
- `app/(tabs)/profile.tsx`: profile, history, settings
- `app/daily/index.tsx`: daily quiz play screen
- `app/room/[code].tsx`: live room experience
- `app/skill-assessment/index.tsx`: skill assessment flow

## Supabase Functions In Use

The app currently relies on these Edge Functions:

- `daily-quiz`
- `deck-feed`
- `live-match-decks`
- `swipe-feed`
- `room-create`
- `room-join`
- `room-lobby`
- `room-state`
- `room-action`
- `quiz-history`
- `log-daily-result`
- `log-swipe-answer`
- `log-swipe-result`
- `account-delete`

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

Create a local env file with the values used by the app:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_API_KEY=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

3. Start the app

```bash
npm run start
```

Useful alternatives:

```bash
npm run android
npm run ios
npm run web
```

## Supabase Development

Start local Supabase services:

```bash
npm run supabase:start
```

Apply schema changes:

```bash
npm run supabase:db:push
```

Reset local database:

```bash
npm run supabase:db:reset
```

Generate TypeScript database types:

```bash
npm run supabase:gen:types
```

Stop local Supabase services:

```bash
npm run supabase:stop
```

## Notes

- This repository is no longer a default Expo starter, even though older docs previously suggested that.
- Older planning docs also referenced a `Convex + Gemini` backend direction. The implemented app in this repo is now centered on `Supabase`.
- Some product and design notes in `docs/` are exploratory. For implementation truth, prefer the code under `app/`, `hooks/`, `lib/`, and `supabase/`.
