# Supabase 마이그레이션 가이드

이 문서는 Convex에서 Supabase로의 마이그레이션 과정을 설명합니다.

## 마이그레이션 완료 항목

### 1. 프로젝트 설정
- [x] Supabase 프로젝트 설정 (`supabase/config.toml`)
- [x] 환경 변수 템플릿 (`supabase/README.md`)
- [x] `.gitignore` 업데이트

### 2. 데이터베이스 스키마
- [x] PostgreSQL 스키마 마이그레이션 (`supabase/migrations/00001_initial_schema.sql`)
- [x] TypeScript 타입 정의 (`lib/database.types.ts`)
- [x] Row Level Security (RLS) 정책
- [x] Realtime 구독 설정
- [x] 시드 데이터 (`supabase/seed.sql`)

### 3. 인증
- [x] Supabase Auth 설정
- [x] 새 인증 훅 (`hooks/use-supabase-auth.tsx`)
- [x] Provider 컴포넌트 (`providers/supabase-provider.tsx`)

### 4. API 레이어
- [x] Supabase 클라이언트 (`lib/supabase.ts`)
- [x] API 훅 (`lib/supabase-api.ts`)

### 5. Edge Functions
- [x] `daily-quiz` - 오늘의 퀴즈 조회
- [x] `deck-feed` - 덱 피드 조회
- [x] `live-match-decks` - 라이브 매치 덱 목록
- [x] `quiz-history` - 퀴즈 히스토리 조회/저장
- [x] `room-create` - 방 생성
- [x] `room-join` - 방 참가
- [x] `room-action` - 방 액션 (heartbeat, setReady, leave, start, progress, submitAnswer, sendReaction, rematch)

### 6. 실시간 기능
- [x] 라이브 매치 훅 (`hooks/use-live-lobby.ts`, `hooks/use-live-game.ts`)
- [x] Presence 통합
- [x] Realtime 구독

### 7. Cron Jobs
- [x] pg_cron 마이그레이션 (`supabase/migrations/00002_cron_jobs.sql`)
  - 만료된 방 정리 (10분마다)
  - 비활성 참가자 정리 (2분마다)

## 마이그레이션 단계

### Step 1: 환경 설정

1. Supabase 프로젝트 생성 (https://supabase.com/dashboard)
2. `.env.local` 파일 생성:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. 패키지 설치:
```bash
npm install @supabase/supabase-js
```

### Step 2: 데이터베이스 마이그레이션

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

### Step 3: Edge Functions 배포

```bash
# 모든 Edge Functions 배포
supabase functions deploy daily-quiz
supabase functions deploy deck-feed
supabase functions deploy live-match-decks
supabase functions deploy quiz-history
supabase functions deploy room-create
supabase functions deploy room-join
supabase functions deploy room-action
```

### Step 4: OAuth 설정

1. **Google OAuth**:
   - Google Cloud Console에서 OAuth 2.0 클라이언트 생성
   - Redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Supabase Dashboard > Authentication > Providers > Google에서 설정

2. **Apple OAuth**:
   - Apple Developer Console에서 Services ID 생성
   - Supabase Dashboard > Authentication > Providers > Apple에서 설정

### Step 5: 앱 코드 변경

#### Provider 교체

```tsx
// app/_layout.tsx
import { SupabaseProvider } from '@/providers/supabase-provider';

export default function RootLayout() {
  return (
    <SupabaseProvider>
      {/* 기존 내용 */}
    </SupabaseProvider>
  );
}
```

#### 인증 훅 교체

```tsx
// Before (Convex + Firebase)
import { useAuth } from '@/hooks/use-auth';
const { user, signInWithGoogle, signOut } = useAuth();

// After (Supabase)
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
const { user, signInWithGoogle, signOut } = useSupabaseAuth();
```

#### API 훅 교체

```tsx
// Before (Convex)
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

const decks = useQuery(api.rooms.listDecks);
const createRoom = useMutation(api.rooms.create);

// After (Supabase)
import { useLiveMatchDecks } from '@/hooks/use-live-match-decks';
import { useCreateLiveMatchRoom } from '@/hooks/use-live-match-room';
import { useDeckFeed } from '@/lib/supabase-api';

const { decks } = useLiveMatchDecks();
const createRoom = useCreateLiveMatchRoom();
```

#### 라이브 매치 훅 교체

```tsx
// Before (Convex)
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const roomState = useQuery(api.rooms.getRoomState, { roomId, guestKey });
const submitAnswer = useMutation(api.rooms.submitAnswer);

// After (Supabase)
import { useLiveGame, useGameActions } from '@/hooks/use-live-game';

const { gameState } = useLiveGame(roomId, participantId, { enabled: true, guestKey });
const roomData = gameState.status === 'ok' ? gameState : null;
const { room, participants, me, currentRound } = roomData ?? {};
const gameActions = useGameActions();

// Submit answer
await gameActions.submitAnswer({ roomId, participantId, guestKey, choiceIndex });
```

## 병행 운영 가이드

마이그레이션 중 Convex와 Supabase를 병행 운영할 수 있습니다:

1. **Feature Flag 사용**:
```tsx
const USE_SUPABASE = process.env.EXPO_PUBLIC_USE_SUPABASE === 'true';

const auth = USE_SUPABASE ? useSupabaseAuth() : useAuth();
```

2. **점진적 전환**:
   - Phase 1: 읽기 전용 기능 (daily, decks, history)
   - Phase 2: 인증
   - Phase 3: 실시간 라이브 매치
   - Phase 4: 전체 전환

## Convex 제거

마이그레이션 완료 후:

1. `convex/` 디렉토리 삭제
2. `package.json`에서 의존성 제거:
```bash
npm uninstall convex
```

3. Firebase 패키지 제거 (선택적):
```bash
npm uninstall @react-native-firebase/app @react-native-firebase/auth
```

4. 환경 변수 정리

## 데이터 마이그레이션

기존 Convex 데이터를 Supabase로 마이그레이션하려면:

```bash
# 1. Convex에서 데이터 내보내기
npx convex export --path ./backup

# 2. JSON을 SQL로 변환 (스크립트 필요)
node scripts/convert-convex-to-sql.js

# 3. Supabase에 데이터 삽입
supabase db push
```

## 문제 해결

### 실시간 구독이 작동하지 않음
- Supabase Dashboard > Database > Replication에서 테이블이 활성화되어 있는지 확인
- RLS 정책이 SELECT를 허용하는지 확인

### Edge Function 오류
```bash
# 로그 확인
supabase functions logs <function-name>
```

### 인증 리다이렉트 문제
- Supabase Dashboard > Authentication > URL Configuration에서 Redirect URLs 확인
- `exp://localhost:8081` 및 `quizroom://auth/callback` 추가

## 참고 자료

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
