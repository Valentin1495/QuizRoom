## 0) 제품 콘셉트 & 핵심 루프
- 한 줄 요약: **12문항 런(run) + 점진 난이도 + 보너스 ‘더블다운’**
- 핵심 재미: 가벼운 지식 우월감 ↔ 갑툭튀 기본지식 함정, 스트릭·배지·소셜 랭킹으로 리텐션
- 세션 길이: 90~180초, 짧고 강렬 / 공유 UI로 자연 확산

---

## 1) 목표 & 원칙
- MVP를 6주 내 출시
- 최소 변경·기존 네이밍/컨벤션 유지
- 서버에서 점수 최종 산출
- 성능 기본값(Hermes, 프리로드), 접근성 준수(AA), 오프라인 보호

---

## 2) 타깃 & 톤 (Gen Z / Millennial)
- **비주얼**: 글래스모피즘 + 그라데이션(라벤더↔일렉트릭 블루), 노이즈/그레인, 네온 액센트
- **카피**: 짧고 위트있는 라벨 (“Streak Squad”, “Time’s Melting”, “Don’t Flop”)
- **피드백**: 스프링 이징, 햅틱, 파티클, 점수 카운트업

---

## 3) 아키텍처 개요
- **클라이언트**: Expo (React Native, TypeScript)
  - 라우팅: expo-router
  - 상태: Zustand(게임 진행) + React Query(서버 캐시)
  - 애니메이션/제스처: Reanimated 3 + RNGH
  - 기기 능력: expo-haptics, expo-av, expo-blur, expo-notifications
- **백엔드**: Convex
  - 실시간 스토리지/쿼리, 서버 액션으로 게임 루프·리더보드 구현
  - Row-level security + 서버 검증
- **AI**: Google Gemini
  - 문제 생성/리라이트, 난이도 태깅, 함정 포인트 생성
  - JSON only 출력: stem, choices[4], answerIndex, explanation, gradeBand, flags, difficulty(1~5)
- **분석/성장**: Amplitude/PostHog + Branch(리퍼럴)

---

## 4) 폴더 구조
```
app/
  index.tsx
  (tabs)/
  quiz/
components/
  QuestionCard.tsx
  RadialTimer.tsx
  Particles.tsx
  DoubleDownModal.tsx
  ShareSticker.tsx
  glass-card.tsx
context/
  quiz-setup-context.tsx
  gamification-HUD.tsx
  points-animation.tsx
store/
  gameStore.ts
hooks/
  useGame.ts
  useCountdown.ts
  use-auth.ts
  use-quiz-gamification.ts
utils/
  scoring.ts
  difficulty.ts
  포맷터/랜덤/로깅 유틸
convex/
  schema.ts
  sessions.ts
  questions.ts
  leaderboards.ts
  daily.ts
  reports.ts
  inventories.ts
  gamification.ts
theme/
  tokens.ts
  typography.ts
```

---

## 5) Convex 데이터 모델 요약
```ts
users: { id, authId, nickname, avatar, country, createdAt }
sessions: { userId, status, mode, category, difficultyCurve, questions[], answers[], score, streakDelta, startedAt, endedAt }
questions: { source, locale, category, gradeBand, stem, choices[], answerIndex, explanation, difficulty, flags[], quality, createdAt }
leaderboards: { period, userId, score, runs, updatedAt }
inventories: { userId, coins, boosts, premium, seasonPass }
purchases: { userId, sku, priceKRW, platform, receipt, createdAt }
reports: { userId, qid, reason, note, createdAt, resolved }
ai_prompts: { type, input, output, model, createdAt, traceId }
```

### 인덱스
- questions.by_category
- leaderboards.by_period_user
- sessions.by_user_status

### 핵심 서버 함수
- getDailySeed(query)
- startSession(action)
- submitAnswer(action)
- endSession(action)
- getWeeklyLeaderboard(query)
- reportQuestion(action)

---

## 6) 게임 루프 & 디자인
- 런(12Q) + 더블다운 (성공 x2 / 실패 x0.5)
- 난이도 곡선: 유치원 → 대학교
- Q 카드 전환 애니메이션, 라디얼 타이머
- **스코어링**: 기본 100점 + 시간 보너스(최대 +50), 스트릭 보너스(cap 1.5x)
- UI 피드백: 글래스 카드, 그라데이션, 스프링 이징, 파티클, 5초 이하 햅틱
- **더블다운 규칙**: 성공 시 최종 점수 x2, 실패 시 x0.5

---

## 7) 화면 플로우
1. Splash → 온보딩 → 기본 프로필
2. Home: 모드 카드(퀵 런 / 배틀(잠금) / 데일리), 이어하기
3. Category: 국어/수학/사회/과학/상식 + 난이도 표시
4. Play: Q 카드, 타이머, 도움카드(스킵/50:50/힌트)
5. DoubleDown: 배점 x2, 오답 시 절반
6. Result: 점수·배지·스트릭, 공유 스티커
7. Leaderboard: 주간/전체, 친구 탭
8. Profile: 업적, 구매, 설정, 신고/피드백

---

## 8) AI 파이프라인
- Gemini 기반 문제 생성/검증
- 단계:
  1) 스키마 검증(Zod)
  2) 지식 충돌 검사
  3) 난이도 휴리스틱(정답률 기반)
  4) 샘플링 플레이테스트
- 밸런싱: EWMA 정답률 기반 난이도 재라벨링, ELO 유사 품질 점수
- 필터: 안전/표절 룰, 신고 루프

---

## 9) 디자인 토큰
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

---

## 10) 이벤트 & 성장
- 이벤트: session_start, question_shown, answer_submit, double_down_open/confirm/result, streak_milestone, share_export, daily_claim, purchase_success, report_submit
- KPI: D1/D7, 세션 길이, 정답률, 이탈 위치, 공유 전환, ARPDAU

---

## 11) 빌드 & 성능
- 개발 실행: expo run:ios|android
- 최적화: 이미지/폰트 프리로드, expo-router chunk split, 느린 디바이스 모드
- 접근성: 폰트 스케일, 대비(AA), 보이스오버, 햅틱 최소화 토글
- 캐시 이슈 원라이너: `watchman watch-del-all && rm -rf node_modules && npm i && (cd ios && pod install && cd ..)`

---

## 12) QA & 보안
- 폰트 스케일 대응, 컬러 대비, 보이스오버 라벨
- 오탈자/모호문항 자동 검출
- 서버에서 점수 최종 산출
- 리더보드 쓰기 레이트리밋, IAP 영수증 검증
- AI 요청 traceId 샌드박싱

---

## 13) 마일스톤 (6주)
- **W1**: 프로젝트 셋업, 디자인 토큰, 네비게이션 기본
- **W2**: 플레이 루프(QuestionCard, Timer, Scoring, Result, Haptics/Particles)
- **W3**: Gemini 문제 생성 파이프라인, 초기 500문항 시드
- **W4**: 스트릭/배지/데일리, 주간 리더보드
- **W5**: 신고/운영 툴, 성능 최적화, 크래시/로그
- **W6**: 현지화(ko), 스토어 빌드, 소프트런치

---

## 14) 리스크 & 대응
- AI 품질 변동: 다중 검증 + 신고 루프
- 난이도 붕괴: 정답률 기반 리발런싱
- 성능: Hermes, 프리로드, 파티클/블러 다운스케일
- 안티치트: 서버 타임스탬프, 다중 제출 차단