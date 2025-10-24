export type CategoryNeighbor = {
  slug: string;
  weight: number;
};

export type CategoryMeta = {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  sampleTags: string[];
  neighbors: CategoryNeighbor[];
};

export const categories: CategoryMeta[] = [
  {
    slug: "kpop_music",
    title: "K-POP•음악",
    emoji: "🎵",
    description: "아이돌, 가요, 음원 차트, 콘서트 관련 퀴즈",
    sampleTags: ["아이브", "뉴진스", "방탄소년단", "멜론", "뮤직비디오"],
    neighbors: [
      { slug: "variety_ott", weight: 0.15 },
      { slug: "fashion_life", weight: 0.1 },
    ],
  },
  {
    slug: "variety_ott",
    title: "예능•OTT",
    emoji: "📺",
    description: "방송 예능 및 OTT 오리지널 콘텐츠 퀴즈",
    sampleTags: ["놀면뭐하니", "피지컬100", "스우파", "넷플릭스", "쿠팡플레이"],
    neighbors: [
      { slug: "drama_movie", weight: 0.25 },
      { slug: "kpop_music", weight: 0.1 },
    ],
  },
  {
    slug: "drama_movie",
    title: "드라마•영화",
    emoji: "🎬",
    description: "한국·해외 드라마/영화, 배우, 명대사 관련 퀴즈",
    sampleTags: ["DP", "오징어게임", "콘크리트유토피아", "MCU", "칸영화제"],
    neighbors: [
      { slug: "variety_ott", weight: 0.1 },
      { slug: "news_issues", weight: 0.1 },
      { slug: "fashion_life", weight: 0.05 },
    ],
  },
  {
    slug: "sports_games",
    title: "스포츠•게임",
    emoji: "🏆",
    description: "축구, 야구, e스포츠, 콘솔·모바일 게임 관련 퀴즈",
    sampleTags: ["손흥민", "KBO", "롤드컵", "LoL", "플스"],
    neighbors: [
      { slug: "tech_it", weight: 0.1 },
      { slug: "news_issues", weight: 0.05 },
    ],
  },
  {
    slug: "tech_it",
    title: "테크•IT",
    emoji: "💡",
    description: "신제품, IT 서비스, 스타트업, AI 관련 퀴즈",
    sampleTags: ["아이폰", "삼성", "챗GPT", "스타트업", "전자제품"],
    neighbors: [
      { slug: "sports_games", weight: 0.05 },
      { slug: "news_issues", weight: 0.1 },
    ],
  },
  {
    slug: "fashion_life",
    title: "패션•라이프",
    emoji: "👗",
    description: "패션, 뷰티, 브랜드, 일상 트렌드 관련 퀴즈",
    sampleTags: ["나이키", "무신사", "향수", "뷰티", "스트릿"],
    neighbors: [
      { slug: "kpop_music", weight: 0.1 },
      { slug: "drama_movie", weight: 0.05 },
    ],
  },
  {
    slug: "news_issues",
    title: "시사•이슈",
    emoji: "🗞️",
    description: "사회·경제·문화 등 최근 이슈 관련 퀴즈",
    sampleTags: ["물가", "환경", "국제뉴스", "문화", "정책"],
    neighbors: [
      { slug: "tech_it", weight: 0.1 },
      { slug: "drama_movie", weight: 0.1 },
    ],
  },
  {
    slug: "general_knowledge",
    title: "상식",
    emoji: "⚡",
    description: "과학, 역사, 언어 등 기본 상식 퀴즈",
    sampleTags: ["수도", "위인", "물리", "영어표현", "수학"],
    neighbors: [
      { slug: "tech_it", weight: 0.05 },
      { slug: "news_issues", weight: 0.05 },
    ],
  },
];
