좋아—“파티 라이브 모드”를 **작게 시작해서 무리 없이 키우는** MVP 설계를 딱 정리해줄게. 지금 당장 만들 수 있게 범위·데이터·이벤트·화면·테스트까지 최소셋으로.

# 🎯 MVP 목표

* 호스트가 만든 방에 사람들이 들어와 **10문제**를 **동시에 진행**하고, **최종 순위**를 본다.
* 안정적 동기화(타이머/정답 공개/점수)와 **끊김 복귀**가 된다.
* 덱은 **고정 1종** 또는 소수(메타데이터 단순).

---

# ✅ 범위 (Must / Should / Won’t)

**Must**

* 방 생성/입장(코드), 대기실 인원 표시, 시작 버튼
* 라운드 루프: 문제 공개 → 답변(4지선다) → 정답 공개 → 미니 리더보드
* 점수: 정답 100 + 속도 보너스(최대 50)만 (콤보는 MVP 제외)
* 최종 결과(Top 3, 내 순위), 리매치(덱/규칙 동일)
* 네트워크 지연 보정: 서버 수신 시각 기준 + 2s 그레이스
* 재접속(20s 유예)

**Should**

* 이미지/오디오 없는 **텍스트 문제** 우선
* 신고 버튼(단순 사유 텍스트만 수집)
* 호스트: 스킵/일시정지

**Won’t (후순위)**

* 덱 마켓/추천, 콤보·난이도 보정, 오디오/이미지 문제, 이모지 리액션, 소셜 공유 고도화

---

# 🧱 데이터 모델 (Convex)

```ts
// rooms
{id, code, hostId, status: 'lobby'|'countdown'|'round'|'reveal'|'results',
 rules: {rounds: 10, answerSeconds: 10, readSeconds: 3, graceSeconds: 2},
 deckId, serverT0, createdAt, expiresAt}

// participants
{roomId, userId, nickname, isHost, joinedAt, lastSeen, total: 0, avgMs: 0, answers: number}

// rounds
{roomId, index, questionRef, seed, startedAt, closedAt, answerKeySentAt}

// answers
{roomId, roundIndex, userId, choice, recvAtMs, isCorrect, delta}
```

---

# 🔌 실시간 이벤트(서버 함수 시그니처)

```ts
room.create({deckId, rules}) -> {roomId, code}
room.join({code, nickname}) -> {roomId, me}
room.ready({roomId}) // MVP에선 ready 생략 가능
game.start({roomId}) // sets serverT0, moves to countdown
round.next({roomId}) // advances round index, broadcasts question
answer.submit({roomId, roundIndex, choice, clientTs}) // scores by recvAt
round.reveal({roomId}) // broadcasts correct answer + per-user delta
game.finish({roomId}) // aggregates and final standings
presence.heartbeat({roomId})
```

---

# ⏱ 타이밍(기본값)

* 읽기 3s → 답변 10s → 그레이스 2s → 공개/해설 4s → 미니보드 3s
* 10문제 ≈ 3–4분. (MVP는 고정 상수로 시작)

---

# 🧮 점수식 (MVP 단순화)

```ts
base = isCorrect ? 100 : 0
speedBonus = isCorrect ? Math.ceil((remainingSec/answerSeconds)*50) : 0
delta = base + speedBonus
```

* 동점 타이브레이커: `avgMs`(정답 제출 평균 시간) 작은 순.

---

# 🖥 클라이언트 화면(최소)

1. **방 입장**: 코드 입력, 닉네임
2. **로비**: 인원수, 호스트 “시작” 버튼
3. **문제**: 질문 텍스트, 4지선다, 상단 글로벌 타이머
4. **정답 공개**: 정답 하이라이트, 전체 분포, 내 점수 변화
5. **미니 리더보드**: Top 3 + 내 현재 순위
6. **최종 결과**: 최종 순위, 리매치 버튼

---

# 🔐 신뢰/반치트 (MVP)

* 정답 키는 **reveal 직전**에만 전송
* 서버가 `recvAt` 기록해 판정, 클라 시간은 참고용
* 하트비트 5s, 20s 내 복귀 허용(다음 라운드부터 참여)

---

# 🧪 수용 기준(acceptance)

* 10명 동시 접속에서 타이머 **±200ms** 수준 동기화 유지
* 1명 네트워크 끊김 후 10s 내 복귀 → 다음 라운드 자동 복귀
* 라운드 종료 후 모든 클라이언트 **동일한 정답/분포/점수** 표시
* 오류 상황(방 코드 없음/가득 참/중복 닉네임) UX 메시지 노출

---

# 🧰 개발 순서(의존도 기준)

1. **도메인 객체/스키마**(rooms/participants/rounds/answers)
2. **방 생성/입장/시작** + 서버 브로드캐스트(Convex sub)
3. **라운드 루프**(next → submit → reveal)
4. **스코어 집계 & 결과 화면**
5. **재접속/하트비트/유예**
6. **호스트 컨트롤(스킵/일시정지)**
7. **간단 신고/로그 수집**

---

# 🧱 인터페이스 예시 (타입만)

```ts
type Question = { id:string; text:string; choices:string[]; answerIndex:number; };

type ClientEvents =
 | {type:'JOINED'; me:{id:string, nickname:string}}
 | {type:'STATE'; status:string, round?:{index:number, endsAt:number}, serverNow:number}
 | {type:'QUESTION'; q:Question, roundIndex:number, closeAt:number}
 | {type:'REVEAL'; correct:number, dist:number[], delta:number, total:number, rank:number}
 | {type:'RESULTS'; standings:Array<{nickname:string,total:number}>};
```

---

# 🚀 확장 로드맵(후속)

* 콤보/난이도 보정, 이모지 리액션, 이미지/오디오 문제
* 덱 메타데이터/추천, 리플레이, 공유 템플릿
* 방 권한(킥/뮤트), 관전자 모드, 서버 샤딩