QuizRoom의 **스와이프 스택**만 딱 떼서 MVP → GA까지 바로 실행 가능한 빌드 플랜을 정리했어. (전체 프로젝트·빌드 맥락은 여기에 이미 잡혀 있어: 스와이프 스택/무한 피드·난이도 ELO·태그 기반 필터링.)

# 목표 정의

* **핵심 경험**: 끝없이 넘기는 1문항 카드 피드, “빠른 판단→즉시 보상→다음 카드”.
* **성과 지표(v1)**: 1세션당 완료 카드 ≥ 18장, 평균 응답시간 ≤ 5.5초, 다음 카드 로딩 대기 0ms 체감(프리페치 ≥ 3장).

# 1) UX·플로우 (MVP)

1. 홈 탭 → “스와이프” 진입 → 온보딩 1장(제스처 튜토리얼 5초).
2. 카드 구성

   * 상단: 카테고리/태그 칩, 난이도 점(●●○).
   * 본문: 질문(최대 80자) + 보조 미디어(선택).
   * 하단: 4지선다 버튼.
   * 제스처:

     * **정답 제출**: 보기 탭 → 즉시 채점 → 상단 토스트(±점수/연속기록).
     * **다음 카드**: 우측 스와이프(정답 후) / 상단 “다음” 스와이프 힌트.
     * **보류**: 상단으로 스와이프(스킵, 페널티 0점/연속 끊김).
     * **신고/저장**: 좌측 스와이프 홀드 → 액션 시트(신고, 다시보기).
3. 미세 피드백

   * 정답: 카드 테두리 스프링 애니메이션 + 햅틱(light).
   * 오답: 흔들림(shake) + 해설 2줄 노출(2.5초 자동접기).
4. 중단/복귀

   * 중단 시 진행 상태 로컬 보관(최근 20장), 복귀 시 같은 스택에서 이어서.

# 2) 데이터 모델 & API(Convex)

### 스키마 보강

* `questions`(기존): `difficulty`(0..1), `tags[]`, `answerIndex`, `explanation` 유지.
* 신규/보강:

  * `questions.elo`(number, 600–2400 범위 초기화), `qualityScore`(likes/plays 가중).
  * `users.skill`(perTag ELO 맵 포함), `users.sessionPref`(lastSeenCursor 등).
  * `answers` 컬렉션 신설: (userId, questionId, isCorrect, timeMs, createdAt).

### 서버 함수(초안)

* `questions.getSwipeFeed({ cursor?, limit=20, tags?, excludeIds?, userSkill? })`

  * 랭킹 수식: `score = w1*matchSkill + w2*recency + w3*quality - w4*dupPenalty`.
  * 응답: `items[], nextCursor`.
* `answers.submit({ questionId, isCorrect, timeMs })`

  * 트랜잭션: `answers` 기록 → `users.skill[tag]` ELO 업데이트 → `questions.elo` 조정(섀도 업데이트, 배치 가능).
* `reports.create({ questionId, reason })`
* `swipe.bookmark({ questionId })`

# 3) 난이도 적응(간단 ELO)

* 기본식(사용자 스킬 `Su`, 문항 스킬 `Sq`):

  * 기대값 `Eu = 1 / (1 + 10^((Sq - Su)/400))`
  * 업데이트(정답=1, 오답=0):

    * `Su' = Su + Ku * (result - Eu)`
    * `Sq' = Sq + Kq * (Eu - result)`
* 파라미터 제안: `Ku=24`, `Kq=16`(신규 문항 초기 Kq↑), 태그별 독립 업데이트.
* 초기화: 사용자 태그 미보유 시 `Su=1200`, 문항 `Sq`는 기존 `difficulty`를 ELO로 매핑(예: 0.5→1200, 0.8→1600).

# 4) 클라이언트 구조 (Expo/TypeScript)

```
/app/(tabs)/swipe.tsx         // 엔트리
/components/swipe/SwipeStack.tsx
/components/swipe/SwipeCard.tsx
/components/swipe/AnswerSheet.tsx
/components/common/ResultToast.tsx
/lib/feed.ts                  // 질의/프리페치 훅
/lib/elo.ts                   // 클라 추정(UX용), 실제 갱신은 서버
```

### 핵심 훅(개념)

* `useSwipeFeed({ category, tags })`

  * 내부 상태: `queue`(최대 10장), `prefetch`(백그라운드 3장), `cursor`.
  * 이벤트: `onAnswered` → 낙관적 제거 → `answers.submit` → 실패 시 롤백.
* 제스처/렌더링: `react-native-gesture-handler` + `react-native-reanimated` 카드 스택(겹침 3장, 다음 카드 미리 보임 8px).

# 5) 퍼포먼스 & 안정성

* **프리페치 파이프라인**: 화면 진입 즉시 20장 → 뷰포트 기준 “앞으로 3장 남으면 추가 로드”.
* **메모리 관리**: 카드 언마운트 즉시 미디어 해제, 이미지 `expo-image` 캐시.
* **오프라인/지연**: 정답 제출은 큐잉 후 재시도; 2분 내 재연결 시 점수 동기화.
* **60fps 수칙**: 큰 이미지 변환 금지, Reanimated에서 translate/opacity만.

# 6) 분석 & A/B

* 이벤트: `Swipe.Start`, `Card.View`, `Card.Answer(correct, timeMs)`, `Card.Skip`, `Toast.Show`, `Feed.Refill`, `Error.SubmitRetry`.
* A/B 아이디어:

  1. 스킵 제스처 on/off, 2) 해설 자동펼침 vs 버튼, 3) 정답 후 자동-다음 vs 수동 스와이프.

# 7) 보안/거버넌스

* 클라에는 정답 인덱스 미포함(서버 채점), 제출은 서버 타임스탬프 기준.
* 신고 플로우 원탭(좌스와이프 홀드) → 서버 큐 + 대시보드.
* 민감어·표절 사전필터는 크리에이터 발행 단계에서(스택 피드는 소비 전용). 

# 8) 마일스톤(스와이프 스택 전용)

* **W1**: API 스켈레톤( `getSwipeFeed` / `submit` ), 카드/스택 UI, 프리페치.
* **W2**: ELO v1(태그별), 분석 이벤트, 북마크/신고. (빌드 플랜 Milestone B와 맞물림) 
* **W3**: 품질 랭킹 가중치 튜닝, 로딩/오류 UX, 접근성/햅틱 조정.
* **W4**: A/B 2개 롤아웃, 폴리싱 & 버그바시.

# 9) 테스트 계획(요약)

* **유닛**: `elo.ts` 기대값/업데이트 케이스, `feed.ts` 프리페치 경계.
* **E2E(Detox)**: 첫 진입 튜토, 연속 30장 처리, 오프라인 중 5건 제출 후 복귀 동기화.
* **성능**: 중저가 안드로이드에서 30장 연속 스와이프 60fps 유지.

# 10) 완료 기준(DoD)

* 20장 프리로드, 정답→다음 카드 UX 평균 300ms 이내.
* 서버/클라 이벤트 대시보드에서 세션당 카드 수·정답률·평균 응답시간 확인 가능.
* A/B 실험 스위치로 스킵/해설 정책 즉시 전환 가능.

---

## 구현 스니펫(요약)

### getSwipeFeed (서버 의사코드)

```ts
// convex/functions/questions.ts
export const getSwipeFeed = query(async ({ db, args, auth }) => {
  const { cursor, limit = 20, tags = [], userSkill } = args;
  // 1) 후보군: 최신·품질 상위 n*3
  const base = await db.query("questions")
    .withIndex("byCreatedAt")
    .filter(q => tags.length ? q.tags.some(t => tags.includes(t)) : true)
    .take(limit * 3, { cursor });

  // 2) 매칭 점수
  const scored = base.map(q => {
    const sq = q.elo ?? mapDifficultyToElo(q.difficulty);
    const su = estimateUserSkill(userSkill, q.tags);
    const matchSkill = 1 - Math.abs(sq - su) / 800; // 0..1
    const recency = recencyWeight(q.createdAt);
    const quality = q.qualityScore ?? 0.5;
    const dupPenalty = 0; // 클라 excludeIds로 보정
    const score = 0.55*matchSkill + 0.25*recency + 0.20*quality - 0.10*dupPenalty;
    return { q, score };
  }).sort((a,b) => b.score - a.score).slice(0, limit);

  return { items: scored.map(s => stripAnswer(s.q)), nextCursor: calcCursor(base) };
});
```

### 클라이언트 스택(핵심 로직)

```tsx
// /components/swipe/SwipeStack.tsx
export function SwipeStack({ tags }: { tags?: string[] }) {
  const { queue, loadMore, submitAnswer } = useSwipeFeed({ category, tags });

  const onSelect = useCallback(async (q, choiceIdx) => {
    const isCorrect = choiceIdx === q.answerIndex; // 클라 미노출이 이상적, 서버 채점이면 여기선 전송만
    optimisticPop(q.id);
    await submitAnswer({ id: q.id, isCorrect, timeMs: perfNow() - q.ts });
    if (queue.length < 3) loadMore();
  }, [queue.length]);

  return <StackRenderer items={queue} onAnswer={onSelect} />;
}
```
