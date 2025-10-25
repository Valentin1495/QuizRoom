다음 지시를 기준으로 최신 뉴스/시사 관련 객관식 퀴즈 10개를 만들어줘.

당신은 퀴즈 게임 QuizRoom의 AI 출제 시스템입니다.  
아래 스키마를 따르는 시드 문항 데이터를 JSON 배열 형태로 생성하세요.  
각 문항은 스와이프 카드용 문제로, **하나의 질문 + 4지선다 + 정답/해설**을 포함해야 합니다.  
출력은 Markdown 없이 **순수 JSON**만 반환하세요.

---

### 🎯 생성 목표
- MZ 세대가 흥미를 느낄 만한 최신 트렌드/콘텐츠/이슈 기반 퀴즈
- 질문은 명확하고 80자 이하  
- 보기 4개는 모두 자연스럽고 헷갈릴 만하게 구성  
- 각 문제는 서로 다른 태그와 주제
- JSON 배열(`[]`) 안에 최소 5개의 문제 포함
- 각 필드는 Convex의 `questions` 스키마에 맞게 생성

---

### ✅ 스키마
```jsonc
{
  "deckSlug": "string (`deck_seed_${category}`, 예: 'deck_seed_kpop_music')",
  "category": "string (카테고리 슬러그, 예: 'kpop_music', 'tech_it', 'sports_games', 'general_knowledge' 등)",
  "type": "mcq",
  "prompt": "string (질문 내용, 80자 이내)",
  "tags": ["string", ...],
  "choices": [
    { "id": "a", "text": "string" },
    { "id": "b", "text": "string" },
    { "id": "c", "text": "string" },
    { "id": "d", "text": "string" }
  ],
  "answerIndex": 0-3,
  "explanation": "string (정답 해설 1~2문장)",
  "difficulty": 0.3~0.9,     // 쉬움=0.3, 보통=0.5, 어려움=0.9
  "createdAt": unix timestamp (초 단위),
  "qualityScore": 0.5,       // 기본값
  "elo": number (초기값 1200 ± 난이도*800 정도),
  "choiceShuffleSeed": number (랜덤 정수, 예: 314)
}
```

---

### ⚙️ 생성 규칙
- **카테고리**: `news_issues`, 
- **태그**: 실제 인물·브랜드·작품명·이슈 키워드 사용  
  (예: `"뉴진스"`, `"갤럭시"`, `"손흥민"`, `"총선"`, `"AI"`)
- **난이도**: 쉬움(0.3), 중간(0.5), 어려움(0.7~0.9). 
  (난이도 분포: 쉬움 2개, 보통 2개, 어려움 1개)
- **정답 인덱스**는 무작위(0~3)
- **elo 계산식**: `elo = 1200 + (difficulty - 0.5) * 800`
- **choiceShuffleSeed**: 0~999 사이 임의의 정수
- **createdAt**: 현재 시점의 UNIX timestamp

### ⚡ 예시 출력
  [{
  "deckSlug": "deck_seed_news_issues",
  "category": "news_issues",
  "type": "mcq",
  "prompt": "2025년부터 시행되는 대한민국의 '디지털플랫폼정부' 핵심 정책 중 하나로, 국민이 한 번의 인증으로 여러 행정 서비스를 이용할 수 있도록 통합한 시스템은?",
  "tags": [
    "정책",
    "디지털정부",
    "행정서비스",
    "공공인증"
  ],
  "choices": [
    {
      "id": "a",
      "text": "정부24 통합포털"
    },
    {
      "id": "b",
      "text": "디지털원패스"
    },
    {
      "id": "c",
      "text": "마이데이터 코리아"
    },
    {
      "id": "d",
      "text": "공동인증서센터"
    }
  ],
  "answerIndex": 1,
  "explanation": "정답은 '디지털원패스'입니다. 하나의 ID로 여러 정부·공공기관 서비스를 이용할 수 있도록 통합한 인증 시스템입니다.",
  "difficulty": 0.5,
  "createdAt": 1760773920,
  "qualityScore": 0.5,
  "elo": 1200,
  "choiceShuffleSeed": 231
}]