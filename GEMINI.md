You can add instructions here to customize my behavior.

For example, you can add rules about how I should generate code, or you can provide me with information about your project that I should be aware of.

아래 플랜은 “Are You Smarter Than a 5th Grader?”의 핵심 재미(초등 교과 지식으로 성인 능멸(?)하기)를 MZ 감성으로 재해석해, 모바일에서 빠르게 소비·공유되는 **지식 심리전 파티 퀴즈**로 정제한 기획안입니다.
스택은 **React Native(Expo, TS)** + **Convex** + **Gemini**를 전제로, 바로 집행 가능한 수준의 정보 구조·데이터 모델·개발 로드맵까지 포함했어요.

# 1) 콘셉트 & 핵심 경험 (Core Loop)

**한 줄 요약:** “초딩 문제에 쫄지 말자.” 초등~중등 레벨 문제를 **점진 난이도**로, **한 번의 런(run)**에 10문항 내외로 풀고, **마지막 ‘더블다운’**에서 점수 배가/몰수로 손에 땀을 쥐게 만드는 짧고 강렬한 세션.

* **세션 구조(10~12분)**

  1. 난이도 스펙트럼: Lv1(쉬움)→Lv4(어려움)로 8문항
  2. **동급생 카드(“5th helper”) 2장**: 힌트/패스 역할. 소셜·광고·구독으로 회복 가능
  3. **최종 문제(더블다운)**: 성공 시 점수 2x, 실패 시 이번 세션 점수 0
  4. 결과 공유(스티커/밈 형식) → 리매치/팔로우 유도
* **톤앤매너:** 젠지 감성, 간결한 모션, 미세한 햅틱.
* **윤리/법적 주의:** 쇼의 **상표/로고/고유 포맷**은 라이선스 대상. 이름·자산·UI는 **직접 창작**으로 재해석(예: 앱명 ‘QZY’)하되, “미국 퀴즈 쇼에서 영감” 정도로만 커뮤니케이션.

# 2) 타깃 적합 UX 디테일 (미니멀 클린 기반)

* **속도감:**

  * 문항당 제한 시간 20초, 전체 세션 10분 이내 유지.
  * 로딩은 **심플 스켈레톤** 또는 **프로그레스 바**로 처리 → 불필요한 시각적 장식 최소화.
  * 프리페치로 다음 문항 미리 준비.

* **감성 디자인 (Minimal Clean):**

  * **색상:** 흰색/밝은 중립 배경(`#fafbfc`, `#ffffff`)에 블루(`#2b7de9`), 그레이(`#64748b`) 포인트.
  * **카드:** 단순한 흰 배경 + 얇은 라운드(12~16px) + 미세한 그림자.
  * **타이포그래피:** 시스템 폰트 중심, 굵기와 크기로만 위계 표현.
  * **애니메이션:** 최소한의 전환(fade/slide-in). 정답 시 **컬러 하이라이트(초록 테두리/체크)**, 오답 시 **진동 애니메이션** 정도만.

* **소셜 내장:**

  * 복잡한 카메라/이펙트 대신 **결과 공유 카드**에 집중.
  * 점수, 랭킹, “오늘의 도전” 배지를 스티커화 → 바로 인스타/틱톡 공유.
  * 추가 모션은 시즌 2차 업데이트에 고려.

* **접근성:**

  * WCAG 대비율 4.5:1 이상 유지.
  * **다크 모드** 완전 대응 (라이트/다크에서 동일한 심플 구조).
  * 시스템 TTS 지원, **폰트 크기/모션 감소**는 OS 설정과 연동.
  * 햅틱 on/off 옵션 제공.

👉 이렇게 하면 **가볍고 직관적인 UX**를 유지하면서, 초기 런칭 시 **빠른 신뢰·사용성 확보**가 가능합니다.

# 3) 게임 모드

* **솔로 러시:** 데일리 세트(8+1문항), 리더보드.
* **듀오 배틀(동기/비동기):** 1:1 같은 문제 세트, 이모지 리액션, 최종 스코어 카드 자동 공유.
* **파티(3~5인):** 호스트가 룸 생성 → 실시간 순차 퀴즈, 관전 채팅 이모티콘.
* **테마 시즌:** “공룡·우주·올림픽·K-POP 수학” 등 테마팩. 시즌 패스/아바타 보상.

# 4) AI(GenAI: Google Gemini) 활용 설계

* **문항 생성 파이프라인(하이브리드)**

  * 1차: 큐레이트된 정답 데이터셋(오픈 교육 커리큘럼+자체 DB)에서 **정답·근거** 보장
  * 2차: Gemini로 **보기 난이도 튜닝·말맛** 개선, 오답 선택지(근접 오답/오개념) 생성
  * 3차: 자동 검수(금칙어/편향/사실검증 룰) → 휴먼 샘플 리뷰
* **개인화:** 사용자의 정답 로그로 **IRT/베이즈 적응 난이도** 근사. “약점 리커버리 팩” 추천.
* **설명·힌트:** 정답 후 **한 줄 뇌확장(Why it’s right?)** 생성, 힌트는 “개념 키워드만” 간결하게.
* **안전/품질:** 유해·저작권·정치 민감 토픽 필터링, 모델 응답 로그 샘플링 QC.

# 5) 수익화 & 성장

* **F2P 기본 + 코스메틱/시즌패스 + 광고(리워드 기반)**

  * 리워드 광고: 힌트/재도전/동급생 카드 충전
  * 시즌 패스: 고급 테마, 프로필 프레임, ‘더블다운’ 추가권
  * 코스메틱: 아바타·애니메 이펙트·프로필 뱃지
* **UGC 확장:** 크리에이터 문제팩(큐레이션/검수 후 출판, 수익 쉐어)

# 6) 정보 구조(IA) & 주요 화면

* **Onboarding** → 홈(데일리, 배틀, 파티, 시즌) → 퀴즈 플레이(상단 진행·중앙 카드·하단 선택지) → 결과(점수/하이라이트/공유) → 프로필(기록/약점·칭호) → 상점
* **UI 키 컴포넌트**

  * **QuizCard**(문항·보기·타이머·힌트)
  * **ResultBadge**(정답/오답, 작은 아이콘 가독성↑)
  * **SeasonHeader**(그라데이션, 글래스 블러 배지)
  * **ShareSheet**(스티커, 캡션 프리셋)

# 7) 기술 아키텍처

## 프론트엔드 (React Native | Expo | TS)

* **Navigation:** expo-router + stack/tab 혼합
* **상태:** Zustand or Jotai(단순/예측가능), React Query(서버 캐시)
* **애니메이션:** Reanimated + Moti(핵심 제스처와 피드백)
* **미디어:** expo-av(리액션), lottie-react-native(이펙트)
* **A/B·분석:** Segment/Amplitude SDK
* **푸시:** Expo Notifications(토큰→Convex에 저장)

## 백엔드 (Convex)

* **핵심 강점:** 실시간(문제 배포/배틀 스코어), 스키마 안전, 파일 스토리지, 권한 모델
* **테이블(예시)**

  * `users`: profile, tier, streak, region, createdAt
  * `questionBank`: stem, choices[4], answerIndex, subject, grade, difficulty(0~1), locale, sourceRef, reviewed
  * `dailySets`: date, questionIds[], seed, locale
  * `sessions`: userId, setId, answers[], score, usedHints, startedAt, finishedAt
  * `pvpRooms`: hostId, memberIds[], status, setId, currentIndex, scores{}
  * `aiTasks`: type(‘generate/validate/explain’), payload, status, resultRef
  * `leaderboards`: seasonId, userId, score, updatedAt
* **권한:** 읽기 캐시 가능한 public 세트는 read-optimized, 개인 데이터/룸은 auth 필수
* **실시간 동기화:** `pvpRooms` doc 구독 → 진행/스코어 동기

## AI(Gemini) 연동

* **서버 액션:** Convex actions에서 Vertex/Gemini 호출(토큰 관리)
* **프롬프트 템플릿:**

  * 입력: `topic, difficulty, locale, correct_answer, distractor_style`
  * 출력: JSON `{stem, choices[4], answerIndex, rationale, tags}`
* **후처리:** 금지어 필터, 중복/정답 유일성 검사, 난이도 스코어 예측

# 8) 예시 타입/스키마/엔드포인트

## TypeScript 인터페이스 (앱 공용)

```ts
export type Choice = { id: string; text: string };
export type Question = {
  id: string;
  stem: string;
  choices: Choice[];
  answerId: string;
  subject: "math" | "science" | "history" | "language" | "etc";
  gradeBand: "elem" | "middle";
  difficulty: number; // 0(easy)~1(hard)
  rationale?: string; // 정답 해설
  locale: "ko" | "en";
  sourceRef?: string;
};
```

## Convex 스키마(개략)

```ts
// convex/schema.ts
import { defineSchema, defineTable, v } from "convex/server";

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    streak: v.number(),
    tier: v.string(), // free|plus|season
    locale: v.string(),
    createdAt: v.number(),
  }).index("by_handle", ["handle"]),

  questionBank: defineTable({
    stem: v.string(),
    choices: v.array(v.object({ id: v.string(), text: v.string() })),
    answerId: v.string(),
    subject: v.string(),
    gradeBand: v.string(),
    difficulty: v.number(),
    rationale: v.optional(v.string()),
    locale: v.string(),
    sourceRef: v.optional(v.string()),
    reviewed: v.boolean(),
  }).index("by_locale_diff", ["locale", "difficulty"]),
  
  dailySets: defineTable({
    date: v.string(), // YYYY-MM-DD
    questionIds: v.array(v.id("questionBank")),
    locale: v.string(),
    seed: v.string(),
  }).index("by_date_locale", ["date", "locale"]),

  sessions: defineTable({
    userId: v.id("users"),
    setId: v.id("dailySets"),
    answers: v.array(v.object({
      qid: v.id("questionBank"),
      choiceId: v.string(),
      correct: v.boolean(),
      elapsedMs: v.number(),
    })),
    score: v.number(),
    usedHints: v.number(),
    startedAt: v.number(),
    finishedAt: v.number(),
  }).index("by_user", ["userId"]),

  pvpRooms: defineTable({
    hostId: v.id("users"),
    memberIds: v.array(v.id("users")),
    status: v.string(), // waiting|playing|done
    setId: v.id("dailySets"),
    currentIndex: v.number(),
    scores: v.record(v.string(), v.number()), // userId->score
  }).index("by_status", ["status"]),

  leaderboards: defineTable({
    seasonId: v.string(),
    userId: v.id("users"),
    score: v.number(),
    updatedAt: v.number(),
  }).index("by_season_score", ["seasonId", "score"]),
});
```

## 핵심 서버 함수(개략)

* `api.daily.getTodaySet(locale)` : 데일리 세트 반환(없으면 생성)
* `api.quiz.startSession(setId)` : 세션 생성(프리페치)
* `api.quiz.submitAnswer(sessionId, qid, choiceId)` : 정오 판정·점수·다음 문항
* `api.quiz.finalize(sessionId, doubleDown: boolean)` : 더블다운 처리
* `api.pvp.createRoom()` / `joinRoom(roomId)` / `submitAnswerPvp(...)`
* `api.ai.generateQuestions(topic,diff,locale)` : Gemini 호출 + 검수 파이프라인

# 9) 프론트 컴포넌트 설계(요점)

* `PlayScreen`: 진행도 바(상단), QuizCard(중앙), CTA 버튼(하단), 힌트/패스
* `ResultScreen`: 점수, 하이라이트(정답 퍼센트·속도), 공유 스티커(캡션 프리셋)
* `PvpRoomScreen`: 대기 → 카운트다운 → 동기 플레이(실시간 포털), 이모지 폭죽
* **디자인 키토큰(라이트 우선)**

  * Primary `#6f1d1b` (브랜드 틴트), Icon `#1e1e2f`, Text `#2E2E2E`
  * 그라데이션 예: `['#ff9a9e','#fad0c4','#fadadd']`
  * Card: 16~24px radius, soft shadow, 글래스(blur 12~20)

# 10) 난이도·점수 설계(간단 수식)

* 기본: 정답 +100, 오답 0, 빠른 정답 보너스 `floor( (10s - t) * 5 )`(최대 +50)
* 연속정답 콤보: 3연속부터 +15, 5연속 +40 추가
* 더블다운 성공: 전체 스코어 ×2, 실패: 0
* 매칭 레이팅: Glicko-lite(승패만), 시즌 별 리셋

# 11) 데이터 파이프라인 & 운영

* **콘텐츠 라이프사이클:** 주 1~2회 테마팩 릴리즈 → 홈 상단 배치 → 유입/잔존 모니터
* **품질지표:** 문항 취소율(패스), 오답 집중도, 체류시간, 세션 완료율, 공유율
* **A/B 항목:** 더블다운 배수(1.5x/2x), 보기 갯수(4 vs 5), 힌트 연출, 타이머 길이
* **로컬라이제이션:** `ko` 우선, `en` 병행. 문화권 민감 질문 화이트리스트 운영.

# 12) 보안·컴플라이언스

* **저작권:** 쇼 명칭/로고/특정 문구 미사용. 문제 텍스트는 **원저작물 베끼지 않기**.
* **개인정보:** OAuth(Apple/Google) 최소정보, 지역·세션 로그 익명 집계.
* **안전모드:** 모델 출력 필터, 사용자 신고 라우팅.

# 13) 개발 로드맵 (8~10주 스프린트 기준)

* **W1–2: 토대**

  * Convex 스키마/권한, auth, 데일리 세트 생성기, 기본 UI 킷(QuizCard/ResultBadge)
* **W3–4: 플레이 코어**

  * 세션/채점/더블다운, 힌트, 결과 공유 스티커, 분석 SDK
* **W5–6: PVP 알파**

  * 룸/매칭, 실시간 동기, 간단 이모지 리액션, 리더보드
* **W7: AI 파이프라인 베타**

  * Gemini 연결, 오답 선택지 생성·설명, 자동 검수
* **W8: 시즌/상점**

  * 시즌 프레임·코스메틱, 리워드 광고, 구독 베타
* **Hardening & Beta:** 성능/크래시/튜닝 → TestFlight/Closed Track

# 14) 샘플 UI/로직 스니펫

**QuizCard(요지)**

```tsx
// app/components/QuizCard.tsx
import { View, Text, Pressable } from "react-native";
import Animated, { ZoomIn, FadeIn } from "react-native-reanimated";

type Props = {
  stem: string;
  choices: { id: string; text: string }[];
  onSelect: (id: string) => void;
  locked?: boolean;
};

export default function QuizCard({ stem, choices, onSelect, locked }: Props) {
  return (
    <Animated.View entering={FadeIn}>
      <Text className="text-xl font-semibold mb-4">{stem}</Text>
      <View className="gap-3">
        {choices.map(c => (
          <Animated.View key={c.id} entering={ZoomIn}>
            <Pressable
              disabled={locked}
              onPress={() => onSelect(c.id)}
              className="rounded-2xl p-4 bg-white/80"
              style={{ shadowOpacity: 0.12, shadowRadius: 12 }}
            >
              <Text className="text-base">{c.text}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}
```

**Convex: 데일리 세트 가져오기(개략)**

```ts
// convex/daily.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTodaySet = query({
  args: { locale: v.string() },
  handler: async (ctx, { locale }) => {
    const today = new Date().toISOString().slice(0,10);
    let set = await ctx.db.query("dailySets").withIndex("by_date_locale", q =>
      q.eq("date", today).eq("locale", locale)
    ).first();
    if (!set) {
      const qs = await ctx.db.query("questionBank")
        .withIndex("by_locale_diff", q => q.eq("locale", locale))
        .take(9);
      const id = await ctx.db.insert("dailySets", {
        date: today, questionIds: qs.map(q=>q._id), seed: crypto.randomUUID(), locale
      });
      set = await ctx.db.get(id);
    }
    return set;
  }
});
```

# 15) 출시 후 지표 목표(초기 30D)

* D1 Retention ≥ 35%, D7 ≥ 12%
* 세션당 평균 7~9분, 데일리 세트 완료율 ≥ 70%
* 공유율(결과화면) ≥ 15%, 광고 시청 완료 ≥ 60%

---

---

## 1. 헬퍼 카드 UX 설계

* **구성**:

  * 기본적으로 세션당 **2장 제공** (예: 1 힌트 + 1 패스).
  * 사용자는 원하는 타이밍에 사용 가능.
  * “소셜/광고/구독” 등을 통해 추가 충전이 가능하게 설계.
* **히든 규칙**(밸런스 유지):

  * 한 세션에서 같은 종류(힌트나 패스)를 **2회 이상** 쓰지 못하도록 제한 → 전략적 선택 유도.
  * 패스 사용 시 점수는 0점 처리(감점 없음), 힌트는 정답 확률 +해설 제공.
* **리차지 경제**:

  * **데일리 무료 충전**: 매일 아침 로그인 시 1장 보너스.
  * **광고 시청 보상**: 광고 1회 = 카드 1장 충전(쿨다운 1~2시간).
  * **프리미엄 구독자**: 세션당 항상 3장 제공(예: 힌트2 + 패스1).
  * **코스메틱 보상 연동**: 시즌패스 보상으로 카드 외형/이펙트 변경 가능.

---

## 2. V1 수익화 범위 (Soft Launch 기준)

**소프트 런치에서는 너무 무겁게 가기보다, 플레이 경험에 집중하면서 광고/코스메틱 정도만 연결하는 게 적절**합니다.

* **리워드 광고 (최우선)**

  * 힌트/패스 충전과 직접 연결 → 사용자 입장에서 자연스럽게 소비.
  * 짧은 세션 구조(10분 내)와 잘 맞음.
* **코스메틱 (UI 효과, 프로필 프레임)**

  * 초반부터 가볍게 붙일 수 있음.
  * 과금 없이도 얻을 수 있게 일부 제공 → retention 확보.
* **구독 (후순위, v2 이후)**

  * 무광고 + 추가 헬퍼카드 + 시즌 테마팩 접근권.
  * 초기엔 아직 사용자 LTV/Retention 데이터가 없기 때문에, 런칭 초반엔 배제 후 **데이터 기반**으로 2차 빌드에 도입하는 것이 안전.

---

✅ **정리:**

* **V1 소프트 런치** → **헬퍼카드 2장 제한 + 리워드 광고 충전 + 기본 코스메틱 보상**.
* **구독/시즌 패스**는 retention/유저 피드백 확인 후 도입.
* 이렇게 하면 초기 진입장벽 낮추고, “앱이 재미있다”는 확신을 준 뒤 점진적으로 확장 가능.

---