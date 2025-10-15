# QuizRoom — Party Live Reconnect Flow (2-Minute Grace UX)

## 🎮 Context

When a host or participant disconnects during a Party Live match, a **2-minute grace period** allows them to reconnect without losing progress. This ensures stability in live play while maintaining fairness and flow.

---

## 1. Disconnection Detection (0–5s)

**Trigger:** Convex live query or WebSocket disconnection.

**UI Feedback:**

* Top banner or toast: `⚠️ 연결이 불안정합니다... 다시 연결 중`
* Game pauses automatically; timer stops.
* Other players see an indicator (e.g., “OO가 잠시 드라이\ucube0했어요”).
* Calm visual tone (avoid alarming language).

---

## 2. Grace Period (5–120s)

### Participant View

* Overlay modal:

  ```
  🔄 연결이 끊겼습니다.
  2분 안에 복구되면 계속 진행됩니다.
  ```
* Countdown bar (120s) shows remaining grace time.
* Automatic reconnection attempts every 5 seconds.
* Manual `재시도` button.

### Host View

* Player list shows: `⌛ 재접속 대기 중 (1:58)`
* Game remains paused until player(s) return or timeout.

**Visual tone:** subtle blur, pulsing background (waiting state).

---

## 3. Reconnection Success (< 2 min)

### Participant

* Message: `✅ 연결 복구! 마지막 문제로 복귀 중...`
* Skeleton screen → sync → resume.

### Host

* Player status: `🔵 복귀 완료`
* Banner: `모든 플레이어 복귀! 게임을 다시 시작합니다 🚀`
* Game resumes automatically after 1s delay.

---

## 4. Reconnection Failed (>= 2 min)

### Participant

* Modal:

  ```
  😢 연결이 오래 끊겼습니다.
  이번 라운드는 종료되었어요.
  ```
* CTAs:

  * `대기실로 돌아가기`
  * `다음 라운드 기다리기`

### Host

* Player state: `📴 연결 끊겼음 (2:00 초과)`
* Options:

  * `참가자 제외 후 계속`
  * `라운드 재시작`

---

## 5. UX Enhancements

| Element       | Behavior                                       |
| ------------- | ---------------------------------------------- |
| Timer UI      | Circular or bar countdown to reduce anxiety    |
| Auto Retry    | Retry connection every 5s silently             |
| Language Tone | Friendly, positive language (“결국” 아니라 “복구 중”)  |
| Haptics       | Short vibration on reconnection                |
| Room Log      | Display system messages: “OO가 복귀”, “OO 연결 끊겼음” |

---

## 6. Implementation Notes

```ts
enum ConnectionState {
  ONLINE,
  RECONNECTING,
  OFFLINE_GRACE,
  OFFLINE_EXPIRED
}
```

* Custom hook: `useConnectionStatus()` monitors Convex live connection.
* Grace timer handled by client, validated by server timestamp.
* Convex `matches` table tracks reconnect state for each `matchPlayer`.
