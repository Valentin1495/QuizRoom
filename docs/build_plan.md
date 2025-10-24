# QuizRoom Build Plan

> 기반: React Native (Expo) + TypeScript + Convex + Google Gemini. 현재 Expo/Convex 기본 세팅 완료.

## 1. Product Objectives
- 60초 내 플레이 가능한 한국형 퀴즈 경험(MZ 타깃) 제공.
- 데일리·스와이프·파티 3개 모드 MVP 6~8주 내 출시.
- UGC 크리에이터 루프와 AI 보조를 결합해 콘텐츠 확장성 확보.
- 구글/애플 로그인 + 카카오 공유(링크 템플릿)로 소셜 확산 가속.

## 2. Milestone Map
### Milestone A · Core Loop & Auth (Week 1)
- Convex 스키마/프로시저 1차 확정 (`users`, `decks`, `questions`, `matches`, `matchPlayers`, `reports`).
- 구글/애플 로그인(Expo AuthSession + AppleAuth, Convex 세션) 및 카카오 공유 템플릿 초기 통합 구현.
- 데일리 블링크 모드 UI/로직: 6문제, 타이머, 정답/해설 노출.
- Gemini 기반 문항 생성 초안 API 래퍼 구현, 시드 데이터 투입.

### Milestone B · Social Play & Live (Week 2)
- 파티 라이브: 방 생성/코드 조인/Convex 실시간 리더보드.
- 리액션(이모지, 진동) 및 결과 공유 카드 초안.
- 스와이프 스택: 무한 피드 UI, 난이도/태그 필터 적용.
- Expo Push: 데일리 푸시, 초대 알림 기본 라우팅.

### Milestone C · Creator Tools & Safety (Week 3)
- 크리에이터 퀴즈 빌더: Gemini 초안 → 편집 → 발행 플로우.
- 콘텐츠 검수: 욕설/혐오 필터, 신고 흐름, Convex 대시보드 뷰.
- 코스메틱 v1: 프로필 프레임/이모지 선택 UI, 구매 없이 지급 구조.
- 분석 이벤트(Convex → PostHog/Amplitude) 연동, 핵심 KPI 트래킹.

### Milestone D · Personalization & Launch Prep (Week 4)
- 개인화 추천: 관심 태그 + 정답률 기반 덱 점수 계산.
- 스트릭/XP 및 시즌0 콘텐츠 구성, 공유 카드 다듬기.
- 카카오 공유 템플릿, 딥링크(`app://room/{code}`) 폴백 검증.
- QA/성능 튜닝, 런치 체크리스트 점검.

## 3. Architecture Tasks
- [ ] Convex schema.ts 업데이트 + 데이터 벨리데이션.
- [ ] Convex 함수: `decks.getFeed`, `matches.createParty`, `matches.joinByCode`, `matches.liveLeaderboard`.
- [ ] 클라이언트 API 레이어(`lib/api.ts`) 재정비, typed endpoint 생성.
- [ ] Gemini 호출 모듈: 캐시/쿼터 관리, 금칙어 필터.
- [ ] 실시간 상태 관리: Convex Live Query + React Query 조합 검토.

## 4. Feature Backlog (MVP)
- 데일리 블링크: 타이머, 정답 애니메이션, 스트릭 UI.
- 스와이프 스택: 무한 리스트, 난이도 ELO 조정, 오답 학습.
- 파티 라이브: 호스트 컨트롤, 참가자 준비 상태, 지연 보정.
- 크리에이터 툴: 태그/언어 선택, 미리보기, 게시 검수.
- 코스메틱/프로필: 프레임 적용, 이모지 픽커, 기본 보상 테이블.
- 공유 카드: 결과 스냅샷, 카카오톡/인스타 최적화 템플릿.

## 5. Platform Integrations
- **인증**: Google Sign-In (Expo AuthSession) 기본, Apple Sign In(iOS) 병행. Convex에서 Google ID Token 검증로 세션 발급.
- **공유/초대(카카오)**: Kakao Link 템플릿으로 결과/초대 카드 전송, Kakao 채널 공지.
- **딥링크**: Expo Router + universal links(App/웹) 구성, `app://room/{code}` 웹 폴백.
- **분석**: PostHog/Amplitude SDK 초기화, 이벤트 명세 문서화.
- **푸시**: Expo Notifications — 데일리, 초대 알림 라우팅.

## 6. AI & Content Ops
- Gemini 프롬프트 템플릿 정의: 문항 생성, 오답 개선, 카드 카피.
- 금칙어·민감도 필터 규칙 수립 및 사전 테스트 데이터셋 확보.
- 트렌딩 이슈 덱 파이프라인: 감지 → AI 초안 → 에디터 승인 SLA 3시간.
- 신고 처리 SLA, 제재 정책을 문서화하고 Convex 관리용 함수 구성.

## 7. QA & Launch Checklist
- 자동화 테스트: 핵심 프로시저/유틸 유닛테스트, 주요 화면 E2E(Detox/Playwright).
- 성능: 파티 라이브 150ms 지연 가정, UI 스로틀/옵티마이저 적용.
- 접근성: 한글 폰트/반응형, 햅틱/톤 조정, 14+ 콘텐츠 가이드 확인.
- 출시 준비: 앱스토어 메타, 카카오 심사 자료, CS 흐름/FAQ 정리.

## 8. Open Questions
- 브랜드 덱 도입 시 검수 체계와 광고 표기 방식.
- 실시간 파티 최대 인원(기술 한계 vs. UX) 확정.
- Gemini API 쿼터/비용 관리 정책 및 백업 모델 여부.

---
문서 소스: `project_plan.md`. 기술/비즈니스 변경 시 본 플랜을 동기화하세요.
