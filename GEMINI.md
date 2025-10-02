퀴즈 게임 플랜

0) 제품 콘셉트 & 핵심 루프
- 한 줄 요약: 10문항 내외의 런(run)에서 점진 난이도 + 보너스 ‘더블다운’으로 심리전.
- 핵심 재미: 가벼운 지식 우월감 ↔ 갑툭튀 기본지식 함정. 스트릭·배지·소셜 랭킹으로 리텐션.
- 세션 길이: 90~180초(짧고 강렬), 공유 유도 UI로 자연 확산.

1) 타깃 & 톤 (Gen Z / Millennial)
- 비주얼: 글래스모피즘 + 그라데이션(라벤더↔일렉트릭 블루), 살짝 노이즈/그레인, 또렷한 네온 액센트.
- 카피: 짧고 위트있는 라벨 (“Streak Squad”, “Time’s Melting”, “Don’t Flop”).
- 피드백: 스프링 이징, 미세 진동(햅틱), 파티클 스파클, 점수 카운트업.

2) 기능 스코프 (MVP → v1.1)
MVP
- 싱글 플레이 런(10Q) + 최종 더블다운
- 난이도 곡선(유치원~대학교 레벨), 카테고리 선택
- 스트릭/점수/배지, 데일리 퀘스트
- 기본 리더보드(주간/전체)
- 문제 신고/품질 관리
- 소셜 공유(이미지 스티커)
- 온보딩(2~3 스와이프), 게스트 → 소셜 로그인
v1.1+
- 1:1 배틀(비동기 고스트), 라이브 룸(초기 50명 제한)
- 시즌 패스/테마 팩(유료)
- 커뮤니티 문제 제안 + 검수
- 협업 모드(친구 도움 카드)

3) 아키텍처 개요
클라이언트: Expo (React Native, TypeScript)
- 상태: Zustand(게임 진행) + React Query(서버 캐시)
- 애니메이션/제스처: Reanimated 3 + RNGH
- 기기 능력: expo-haptics, expo-av, expo-blur, expo-notifications
백엔드: Convex
- 실시간 스토리지/쿼리, 서버 액션으로 게임 룹·리더보드 구현
- Row-level security(유저 스코프) + 서버 검증
AI: Google Gemini
- 문제 생성/리라이트, 난이도 태깅, 함정 포인트 생성, 부적절성 필터
- 컨텍스트: 내부 카테고리 지식카드 + 포맷 스펙
분석/성장: Amplitude(또는 PostHog) + Branch(초대/리퍼럴)

4) 화면 플로우
1. Splash → 온보딩(라이트) → 기본 프로필
2. Home: 모드 카드(퀵 런 / 배틀(잠금) / 데일리), 진행 중 런 이어하기
3. Category: 국어/수학/사회/과학/일반상식 등 + 난이도 표시(이모지/색)
4. Play: Q 카드, 타이머(라디얼), 선택지, 도움카드(스킵/50:50/힌트)
5. DoubleDown: 배점 x2, 오답 시 절반 몰수
6. Result: 점수·배지·스트릭, 공유 스티커, 리트라이/다음 모드
7. Leaderboard: 주간/전체, 친구 탭
8. Profile: 업적, 구매, 설정, 신고/피드백

5) 데이터 모델 (Convex schema 초안)
파일 내 코드는 참고용이며 일반 텍스트로 포함됩니다.

convex/schema.ts (요약)
import { v, defineSchema } from "convex/server";

export default defineSchema({
  users: {
    _id: v.id("users"),
    authId: v.string(),
    nickname: v.string(),
    avatar: v.string(),
    country: v.string(),
    createdAt: v.number(),
  },
  sessions: {
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("ended")),
    mode: v.string(),            // "quick", "daily", "battle_ghost"
    category: v.string(),        // "math", "korean", ...
    difficultyCurve: v.array(v.number()), // [1,2,2,3,...]
    questions: v.array(v.id("questions")),
    answers: v.array(v.object({ qid: v.id("questions"), choice: v.number(), correct: v.boolean(), ms: v.number() })),
    score: v.number(),
    streakDelta: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  },
  questions: {
    source: v.union(v.literal("curated"), v.literal("ai")),
    locale: v.string(),           // "ko-KR"
    category: v.string(),
    gradeBand: v.string(),        // "K-2","3-5","6-8","9-12"
    stem: v.string(),
    choices: v.array(v.string()), // 4지선다
    answerIndex: v.number(),
    explanation: v.string(),
    difficulty: v.number(),       // 1~5 (IRT-like proxy)
    flags: v.array(v.string()),   // ["calc","trick","diagram"]
    quality: v.number(),          // ELO-style 품질
    createdAt: v.number(),
  },
  leaderboards: {
    period: v.string(),           // "weekly:2025-40"
    userId: v.id("users"),
    score: v.number(),
    runs: v.number(),
    updatedAt: v.number(),
  },
  inventories: {
    userId: v.id("users"),
    coins: v.number(),
    boosts: v.object({
      skip: v.number(), fifty: v.number(), hint: v.number()
    }),
    premium: v.boolean(),
    seasonPass: v.optional(v.string())
  },
  purchases: {
    userId: v.id("users"),
    sku: v.string(),
    priceKRW: v.number(),
    platform: v.string(),          // ios/android
    receipt: v.string(),
    createdAt: v.number(),
  },
  reports: {
    userId: v.id("users"),
    qid: v.id("questions"),
    reason: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    resolved: v.boolean(),
  },
  ai_prompts: {
    type: v.string(),             // "generate_question", "moderate"
    input: v.string(),
    output: v.string(),
    model: v.string(),
    createdAt: v.number(),
    traceId: v.string(),
  }
});

핵심 서버 함수(Convex)
queries/actions 요약
export const getDailySeed = query({ args:{}, handler: ... });
export const startSession = action({ args:{category: v.string()}, handler: ... });
export const submitAnswer = action({ args:{sessionId, qid, choice, ms}, handler: ... });
export const endSession = action({ args:{sessionId}, handler: ... });
export const getWeeklyLeaderboard = query({ args:{}, handler: ... });
export const reportQuestion = action({ args:{qid, reason, note}, handler: ... });

6) AI 파이프라인 (Gemini)
목표: 학교 교과 기반 퀄리티 + 모바일 난이도 적합성 + 함정 포인트.
프롬프트 설계(요약)
- 규격: JSON only, stem, choices[4], answerIndex, explanation, gradeBand, flags, difficulty(1~5).
- 지식카드(카테고리별 핵심 개념/예시/오답유도 금칙) 주입.
- 금칙: 역사·정치 민감 표현, 저작권 있는 지문, 모호한 다의어, 계산기 없이는 30초 내 풀기 어려운 수치.
검증 단계
1) 스키마 검증(Zod) → 2) 지식 충돌 검사(룰베이스) → 3) 휴리스틱 난이도 재측정(과거 정답률 기반) → 4) 샘플링 플레이테스트(내부)
밸런싱
- 정답률 이동 평균(EWMA)로 difficulty 재라벨링, ELO 유사 품질 점수로 노출 가중치 튜닝.
부적절/표절 필터
- Gemini Safety + 금칙어 룰 + 사용자 신고 루프 연결.

7) 게임 디자인 디테일
- 스코어링: 기본 100점/문항, 남은 시간 보너스(최대 +50), 연속정답 스트릭 보너스(1.1x, 1.2x… cap 1.5x). 더블다운 성공: 최종합계 x1.3, 실패: 최종합계 x0.7.
- 도움카드: 스킵(무득점), 50:50(두 선택지 제거), 힌트(설명 일부 노출·보너스 감소).
- 경제: 코인으로 도움카드 충전, 데일리 출석/미션, 광고 리워드(옵셔널).
- 안티치트: 서버 타임스탬프 기준 응답, 지연·다중 제출 차단, jailbreak 프롬프트 감지 로그.

8) 프런트엔드 구조
apps/mobile
  app/(tabs)/home.tsx
  app/play/[sessionId].tsx
  app/result/[sessionId].tsx
  app/category.tsx
  app/leaderboard.tsx
components
  QuestionCard.tsx
  RadialTimer.tsx
  Particles.tsx
  DoubleDownModal.tsx
  ShareSticker.tsx
hooks
  useGame.ts
  useCountdown.ts
store
  gameStore.ts (Zustand)
lib
  convexClient.ts
  analytics.ts
theme
  tokens.ts
  typography.ts
utils
  scoring.ts
  difficulty.ts

핵심 UI 컴포넌트 스펙
- QuestionCard: 글래스 카드 + expo-blur, 선택 시 스프링 스케일, 정답 시 파티클
- RadialTimer: react-native-svg 아크 스윕, 남은 5초부터 진동
- ShareSticker: 점수/배지/이모지 오버레이 → PNG 저장 후 공유

예시 타입
export type Question = {
  id: string; stem: string; choices: string[]; answerIndex: number;
  explanation?: string; category: string; gradeBand: "K-2"|"3-5"|"6-8"|"9-12";
  difficulty: 1|2|3|4|5; flags?: string[];
};
export type SessionAnswer = { qid:string; choice:number; correct:boolean; ms:number };

9) 디자인 토큰(초안)
- Primary: #6C4CF5
- Accent(Neon): #64FBD2
- BG (Dark): #0B0B14
- Card (Glass): rgba(255,255,255,0.08)
- Text: #F5F7FF
- Sub: #A4A8BA
- Gradients: ['#9C7FFF','#5CC8FF'], ['#FF9AE8','#FFD1A3']
- Radius: 24–28
- Shadow: soft-y 12
- Noise: 2–3%

10) 애널리틱스 이벤트
- session_start
- question_shown
- answer_submit(correct, ms_left)
- double_down_open
- double_down_confirm
- double_down_result
- streak_milestone
- share_export
- daily_claim
- purchase_success
- report_submit
핵심 KPI
- D1/D7, 세션 길이, 정답률 분포, 이탈 위치(문항), 공유 전환, ARPDAU.

11) QA & 접근성
- 폰트 사이즈 스케일 대응, 컬러 대비(AA), 보이스오버 라벨, 햅틱 최소화 토글.
- 오탈자/모호문항 자동 검출(룰+AI), 숫자/단위 표준화.

12) 성능 & 안정성
- 이미지/폰트 프리로드, expo-router chunk split, Hermes + Proguard/R8.
- 느린 디바이스 모드(파티클 밀도/블러 강도 감소).
- 오프라인 보호: 진행 중 세션 로컬 큐잉 → 재접속 시 syncSession.

13) 보안/프라이버시
- Convex 서버에서 점수 최종 산출(클라 신뢰 금지).
- 리더보드 쓰기 레이트리밋, 영수증(receipt) 서버 검증(IAP).
- AI 요청 로그 traceId로 샌드박싱, PII 최소 수집.

14) 출시/운영
- 현지화: ko → en(미국) 순차 지원, 숫자·단위 로컬라이즈.
- 콘텐츠 운영: AI 70% + 큐레이션 30%, 신고 SLA(48h), 품질 점수 하한선.
- A/B: 더블다운 배수(1.2 vs 1.3), 타이머 20/25초, 공유 스티커 프리셋.

15) 마일스톤 (6주 MVP)
- W1 기초: 프로젝트 셋업(Expo, Convex, Router, Zustand/Query), 디자인 토큰, 기본 네비.
- W2 플레이 루프: Session state, Timer, Scoring, Result 화면, Haptics/Particles.
- W3 콘텐츠: Gemini 문제 생성 파이프라인, Zod 검증, 초기 500문항 시드.
- W4 메타게임: 스트릭/배지/데일리, 리더보드(주간).
- W5 품질/운영: 신고/관리 툴(간단 웹), 성능 최적화, 크래시/로그.
- W6 마감: 현지화(ko), 스토어 빌드, 촬영·스토어 크리에이티브, 소프트런치(한국/테스트 국가 1).

16) 의존성 리스트(핵심)
expo, react-native-reanimated, react-native-gesture-handler,
@tanstack/react-query, zustand, react-native-svg, expo-haptics, expo-av,
expo-blur, expo-notifications, convex, zod, dayjs, react-native-view-shot

17) 예시 코드 스니펫
점수 계산 (utils/scoring.ts)
export const calcScore = (base=100, msLeft:number, streak:number) => {
  const timeBonus = Math.round(Math.min(50, msLeft/200)); // 최대 50
  const streakMul = Math.min(1.5, 1 + 0.1 * Math.max(0, streak-1));
  return Math.round((base + timeBonus) * streakMul);
};

Convex: 세션 시작 (convex/actions/startSession.ts, 요약)
export const startSession = action({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const pool = await ctx.db
      .query("questions")
      .withIndex("by_category", q => q.eq("category", category))
      .take(40);
    const pick10 = pool.sort(()=>Math.random()-0.5).slice(0,10).map(q=>q._id);
    const session = await ctx.db.insert("sessions", {
      userId: authUserId(ctx),
      status: "active",
      mode: "quick",
      category,
      difficultyCurve: [1,1,2,2,3,3,3,4,4,5],
      questions: pick10,
      answers: [],
      score: 0,
      streakDelta: 0,
      startedAt: Date.now(),
    });
    return { sessionId: session };
  }
});

RN: 라디얼 타이머 (components/RadialTimer.tsx, 개념)
export function RadialTimer({ msTotal, msLeft }:{msTotal:number;msLeft:number}) {
  const pct = Math.max(0, msLeft/msTotal);
  const sweep = 2*Math.PI*pct;
  // react-native-svg Path 계산…(생략)
  return <Svg>{/* Arc */}</Svg>;
}

18) 리스크 & 대응
- AI 문항 신뢰성: 다중 검증 + 신고 루프 + 품질 하한.
- 난이도 붕괴: 정답률 기반 리발런싱 + 개인화 큐레이션(후속).
- 저작권/민감 주제: 지문 생성 가이드라인·필터 강화.


빌드 플랜 (Expo + Convex · TypeScript)

0) 목표 & 원칙
- MVP를 6주 내 출시. 플랜 참조 문서: 퀴즈 게임 플랜
- 최소 변경·기존 네이밍/컨벤션 유지. 서버가 점수 최종 산출.
- 성능 기본값(Hermes, 프리로드), 접근성 준수(AA), 오프라인 보호.

1) 프로젝트 부트스트랩
- 템플릿 생성: npx create-expo-app
- 라우팅: expo-router
- 의존성: react-native-reanimated, react-native-gesture-handler, react-native-svg, expo-blur, expo-haptics, expo-av, expo-notifications, react-native-view-shot, zustand, @tanstack/react-query, convex, zod, dayjs
- Reanimated/Hermes 설정: babel plugins, iOS Hermes on, Android Proguard/R8
- Convex 초기화: npx convex init → schema 작성 후 npx convex dev
- 앱 설정: app.json 권한, 딥링크 스킴, GoogleService-Info.plist / google-services.json 배치
- EAS: eas.json 채널(dev/preview/prod) 및 프로필 구성

2) 폴더 구조(스캐폴드)
app/
  index.tsx
  (tabs)/
  quiz/
components/
  QuestionCard.tsx, RadialTimer.tsx, Particles.tsx, DoubleDownModal.tsx, ShareSticker.tsx, glass-card.tsx
context/
  quiz-setup-context.tsx, gamification-HUD.tsx, points-animation.tsx
store/
  gameStore.ts (Zustand)
hooks/
  useGame.ts, useCountdown.ts, use-auth.ts, use-quiz-gamification.ts
utils/
  scoring.ts, difficulty.ts, 포맷터/랜덤/로깅 유틸
theme/
  tokens.ts, typography.ts
lib/
  convexClient.ts, analytics.ts
convex/
  schema.ts, sessions.ts, questions.ts, leaderboards.ts, daily.ts, reports.ts, inventories.ts, gamification.ts

3) 데이터/서버(Convex)
- 스키마: users, sessions, questions, leaderboards, inventories, purchases, reports, ai_prompts
- 인덱스: questions.by_category, leaderboards.by_period_user, sessions.by_user_status
- 핵심 함수
  getDailySeed(query)
  startSession(action)
  submitAnswer(action)
  endSession(action)
  getWeeklyLeaderboard(query)
  reportQuestion(action)
- 보안/무결성: 유저 스코프 RLS, 리더보드 쓰기 레이트리밋, 서버에서 점수/스트릭 계산

4) 게임 루프(MVP)
- 런(10Q) + 더블다운(성공 x1.3 / 실패 x0.7)
- 난이도 곡선 적용, Q 카드 전환 애니메이션, 라디얼 타이머
- 스코어링: calcScore(base=100, msLeft, streak), 스트릭 멀티플라이어 cap 1.5x
- UI 피드백: 글래스 카드, 그라데이션, 스프링 이징, 파티클, 5초 이하 햅틱
- 오프라인: 답안 로컬 큐잉 → 재접속 시 syncSession

5) AI 파이프라인(Gemini)
- 출력 규격(JSON only): stem, choices[4], answerIndex, explanation, gradeBand, flags, difficulty(1~5)
- 검증: Zod 스키마 → 지식 충돌 룰 → 난이도 휴리스틱(정답률 기반) → 샘플링 플레이테스트
- 노출 튜닝: EWMA 정답률로 difficulty 재라벨링, 품질(ELO 유사)로 가중치
- 안전/표절: Safety + 금칙어 룰 + 신고 루프 연계

6) 분석/성장
- 이벤트: session_start, question_shown, answer_submit(correct, ms_left), double_down_open/confirm/result, streak_milestone, share_export, daily_claim, purchase_success, report_submit
- 도구: Amplitude(PostHog 대체 가능), Branch(리퍼럴)

7) 빌드/릴리스 & 성능
- 개발 실행: expo run:ios|android
- 프리로드/최적화: 이미지/폰트 프리로드, expo-router chunk split, 느린 디바이스 모드(파티클/블러 감소)
- 접근성: 폰트 스케일 대응, 대비(AA), 보이스오버 라벨, 햅틱 최소화 토글
- 캐시 이슈 원라이너: watchman watch-del-all && rm -rf node_modules && npm i && (cd ios && pod install && cd ..)

8) 주차별 마일스톤(6주)
- W1: 셋업(Expo/Convex/Router/Zustand/Query), 디자인 토큰, 기본 네비
- W2: 플레이 루프(RadialTimer, QuestionCard, 스코어/결과, 햅틱/파티클)
- W3: Gemini 생성/검증, 초기 500문항 시드 및 업로드 유틸
- W4: 스트릭/배지/데일리, 주간 리더보드
- W5: 신고/운영 툴, 성능 최적화, 크래시/로그
- W6: 현지화(ko), 스토어 빌드, 크리에이티브, 소프트런치

9) 리스크 & 대응
- AI 품질 변동: 다중 검증 + 신고 루프 + 품질 하한
- 난이도 붕괴: 정답률 기반 리발런싱(EWMA)
- 성능: Hermes, 프리로드, 파티클/블러 다운스케일
- 안티치트: 서버 타임스탬프, 지연/다중 제출 차단

10) 초기 실행 커맨드(레퍼런스)
npx create-expo-app@latest qzy --template
cd qzy
npm i zustand @tanstack/react-query convex zod dayjs react-native-svg react-native-reanimated react-native-gesture-handler expo-blur expo-haptics expo-av expo-notifications react-native-view-shot
npx convex init && npx convex dev
npx expo run:ios
npx expo run:android