import type { DailyCategory } from "@/constants/daily";

type FallbackQuestion = {
  id: string;
  prompt: string;
  correctAnswer: boolean;
  explanation: string;
  difficulty: number;
};

type FallbackShareTemplate = {
  headline: string;
  cta: string;
  emoji: string;
};

type FallbackQuiz = {
  availableDate: string;
  category: DailyCategory;
  questions: FallbackQuestion[];
  shareTemplate: FallbackShareTemplate;
};

type WeeklyFallbackMap = Readonly<Record<number, FallbackQuiz>>;

export const DEFAULT_WEEKLY_DAILY_QUIZZES: WeeklyFallbackMap = {
  0: {
    "availableDate": "2025-10-12",
    "category": "drama_movie",
    "questions": [
      {
        "id": "q1",
        "prompt": "넷플릭스 오리지널 드라마 '오징어 게임 시즌 2'에는 시즌 1의 '무궁화 꽃이 피었습니다' 인형인 영희의 남자친구 로봇 '철수'가 새로 등장할 것이 예고되었다.",
        "correctAnswer": true,
        "explanation": "'오징어 게임 시즌 2' 제작 공식화 당시, 황동혁 감독이 시즌 1의 영희에 이어 남자친구 로봇인 '철수'의 등장을 예고하며 큰 관심을 모았습니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "영화 '파묘'는 오컬트 영화로는 최초로 국내에서 천만 관객을 돌파했으며, 이는 장르 영화의 흥행 한계를 넘어선 기록이다.",
        "correctAnswer": true,
        "explanation": "'파묘'는 개봉 32일째에 천만 관객을 돌파하며, 오컬트 및 공포 장르 영화 사상 최초의 천만 관객 돌파 작품이라는 기록을 세웠습니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "영화 '파묘'의 등장인물인 풍수사 '김상덕', 장의사 '고영근', 무속인 '이화림', '윤봉길' 등의 이름은 모두 역사 속 독립운동가들의 이름에서 따온 것이 아니다.",
        "correctAnswer": false,
        "explanation": "'파묘'의 주요 등장인물 이름들은 최민식(김상덕), 유해진(고영근), 김고은(이화림), 이도현(윤봉길) 등 역사 속 독립운동가의 이름에서 따온 것으로, 영화 속 항일 코드의 중요한 장치 중 하나입니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "넷플릭스 드라마 '오징어 게임 시즌 2'의 제작비는 역대 한국 드라마 중 최고인 1,000억 원에 달하며, 이는 K-콘텐츠의 높아진 글로벌 위상을 보여준다.",
        "correctAnswer": true,
        "explanation": "'오징어 게임 시즌 2'는 제작비가 1,000억 원에 달하는 것으로 알려져, 역대 한국 드라마 중 최고 제작비를 기록하며 글로벌 기대작으로 주목받고 있습니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "영화 '파묘'는 국내 흥행에만 성공했을 뿐, 해외에서는 오컬트라는 장르적 특성 때문에 흥행에 큰 성과를 거두지 못했다.",
        "correctAnswer": false,
        "explanation": "'파묘'는 국내뿐만 아니라 인도네시아와 베트남 등지에서 역대 한국 영화 최고 흥행 기록을 세우는 등 해외 133개국에 판매되며 글로벌 흥행에도 성공했습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "넷플릭스 드라마 '오징어 게임 시즌 2'에서는 시즌 1에 등장했던 딱지치기, 무궁화 꽃이 피었습니다 같은 전통적인 놀이 외에 '공기놀이'와 '제기차기'가 새로운 서바이벌 게임으로 등장했다.",
        "correctAnswer": true,
        "explanation": "'오징어 게임 시즌 2'에서는 딱지치기와 비석치기 외에 공기놀이(5개 연속 잡기), 제기차기(5번 연속 차기), 팽이 돌리기 등이 새로운 생존 게임으로 등장합니다.",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 드라마•영화 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "🎬"
    }
  },
  1: {
    "availableDate": "2025-10-13",
    "category": "kpop_music",
    "questions": [
      {
        "id": "q1",
        "prompt": "2025년 JYP엔터테인먼트에서 데뷔한 신인 보이그룹 '킥플립(KickFlip)'은 데뷔와 동시에 미국 그래미닷컴에서 '2025년 주목해야 할 K팝 루키'로 선정되었다.",
        "correctAnswer": true,
        "explanation": "JYP의 신인 보이그룹 킥플립은 데뷔 전후로 미국 그래미닷컴의 '2025년 주목해야 할 K팝 루키 8팀' 중 하나로 선정되며 글로벌 주목도를 입증했습니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "2025년에 데뷔한 빅히트 뮤직의 보이그룹 '코르티스(CORTIS)'는 데뷔 앨범 초동(일주일간 판매량)이 40만 장을 넘기며 2025년 데뷔 신인 중 가장 높은 판매고를 기록했다.",
        "correctAnswer": true,
        "explanation": "코르티스는 데뷔 앨범 'COLOR OUTSIDE THE LINES'의 초동 판매량이 약 43만 장을 기록하며 2025년 데뷔 신인 중 가장 높은 기록을 달성했습니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "2025년은 K-POP '빅4' 기획사(하이브, SM, JYP, YG) 모두에서 신인 걸그룹이 데뷔하는 '걸그룹 데뷔 러시'의 해로 불리고 있다.",
        "correctAnswer": false,
        "explanation": "2025년에는 SM의 에스파 여동생 그룹 등 신인 걸그룹 데뷔 기대감이 있지만, JYP와 하이브는 주로 보이그룹(킥플립, 코르티스 등)을 내세우며 '보이그룹 전성기' 기대감이 더 커지고 있습니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "2025년은 방탄소년단(BTS) 멤버들의 군 복무 완료에 따라 완전체 활동이 재개되는 해이며, 컴백 앨범은 하반기(9~10월경)에 발매될 것으로 예상되고 있다.",
        "correctAnswer": true,
        "explanation": "2025년은 방탄소년단 멤버들의 전역 후 완전체 활동 재개가 예상되는 해이며, 업계에서는 컴백 앨범 시기를 하반기로 예측하며 큰 기대를 모으고 있습니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "MZ 세대 사이에서 큰 인기를 끄는 '스테이씨'는 2025년 상반기 활동에서 K-POP 걸그룹 역사상 최초로 데뷔 후 5년 이내 빌보드 '핫 100' 차트에 진입하는 기록을 세웠다.",
        "correctAnswer": false,
        "explanation": "스테이씨는 인기 있는 4세대 그룹이지만, 데뷔 후 5년 이내 빌보드 '핫 100'에 진입한 그룹은 뉴진스 등이며, 스테이씨는 아직 해당 기록을 달성하지는 못했습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "JYP의 또 다른 보이그룹 'NEXZ(넥스지)'는 스트레이 키즈 이후 6년 만에 JYP가 선보인 보이그룹이며, 2025년 한국이 아닌 일본에서만 활동할 예정이다.",
        "correctAnswer": false,
        "explanation": "NEXZ는 스트레이 키즈 이후 JYP의 보이그룹이지만, 2025년 글로벌 및 일본 새 앨범 발매는 물론, 한국에서 첫 공식 팬미팅과 스페셜 콘서트를 개최하며 국내외 활동을 병행할 예정입니다.",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 K-POP•음악 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "🎵"
    }
  },
  2: {
    "availableDate": "2025-10-14",
    "category": "variety_ott",
    "questions": [
      {
        "id": "q1",
        "prompt": "2025년 공개된 넷플릭스 오리지널 드라마 '닭강정'은 영화 '극한직업'의 이병헌 감독과 드라마 '더 글로리'의 김은숙 작가가 처음으로 공동 작업한 화제작이다.",
        "correctAnswer": false,
        "explanation": "'닭강정'은 이병헌 감독이 연출했지만, 김은숙 작가와 협업한 작품은 2025년 공개 예정인 '다 이루어질지니'이며, '닭강정'은 동명의 웹툰을 원작으로 한 작품입니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "MZ 세대 사이에서 큰 인기를 끈 OTT 오리지널 예능 프로그램의 성공 요인으로, 기존 공중파 예능보다 과감하고 새로운 포맷의 실험이 가능하다는 점이 꼽힌다.",
        "correctAnswer": true,
        "explanation": "OTT 예능은 기존 방송 심의나 타겟층 제약에서 벗어나 더 과감하고 새로운 포맷을 시도하여, 신선한 재미를 추구하는 MZ 세대의 선호도를 높이는 주요 성공 요인으로 분석됩니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "2025년 넷플릭스에서 공개 예정인 드라마 '오징어 게임 3'의 주요 출연진에는 시즌 1의 주인공인 이정재와 이병헌, 그리고 임시완, 강하늘 등의 새로운 배우들이 포함되었다.",
        "correctAnswer": true,
        "explanation": "'오징어 게임 3'의 출연진에는 이정재와 이병헌을 비롯해 임시완, 강하늘, 위하준 등 화려한 배우들이 합류할 것으로 공개되어 큰 기대를 모았습니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "2025년 넷플릭스에서 공개된 한국 오리지널 영화 중, 누적 시청 시간 1위를 기록하며 가장 큰 흥행을 거둔 작품은 마동석 주연의 '황야'이다.",
        "correctAnswer": true,
        "explanation": "2023년부터 2025년 상반기까지 넷플릭스에서 가장 많이 시청한 한국 영화는 누적 시청 시간 1억 2,850만 시간을 기록한 '황야'입니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "2025년 공개되는 드라마 '폭싹 속았수다'는 '나의 아저씨'의 김원석 PD와 '동백꽃 필 무렵'의 임상춘 작가가 처음으로 의기투합하여 주목받은 작품이다.",
        "correctAnswer": false,
        "explanation": "'폭싹 속았수다'는 김원석 PD와 임상춘 작가가 함께 만든 작품이 맞지만, 두 사람은 이미 이전 작품을 통해 협업 경험이 있습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "2025년 하반기 디즈니+에서 공개될 예정인 오리지널 시리즈 '탁류'는 디즈니+에서 처음으로 선보이는 한국 사극 장르 드라마이다.",
        "correctAnswer": false,
        "explanation": "'탁류'는 디즈니+의 한국 사극 시리즈 기대작 중 하나이지만, 디즈니+ 최초의 한국 사극 시리즈에 대한 정보는 현재까지 공식적으로 확인된 바가 없습니다. (참고: 유사 작품들이 이미 존재합니다.)",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 예능•OTT 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "🍿"
    }
  },
  3: {
    "availableDate": "2025-10-15",
    "category": "fashion_life",
    "questions": [
      {
        "id": "q1",
        "prompt": "최근 MZ 세대의 라이프스타일 트렌드 중 하나인 '디깅 소비'는 특정 분야나 취향에 깊이 빠져들어 관련된 제품이나 경험에 돈을 아끼지 않는 소비 행태를 말한다.",
        "correctAnswer": true,
        "explanation": "'디깅 소비'는 '파고들다(Digging)'에서 유래한 용어로, 자신이 좋아하는 분야에 깊이 몰두하고 관련 소비를 통해 만족감을 얻는 경향을 의미합니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "2025년 패션 트렌드 중 하나로 꼽히는 '발레코어(Balletcore)' 룩은 발레복에서 영감을 받아 튜튜 스커트, 발레 플랫 슈즈 등 우아하고 로맨틱한 아이템을 일상복에 접목시킨 스타일이다.",
        "correctAnswer": true,
        "explanation": "발레코어는 발레리나의 우아하고 사랑스러운 감성을 일상 패션에 적용한 스타일로, 리본이나 쉬폰 소재 등을 활용하는 것이 특징입니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "친환경과 윤리적 소비를 중시하는 MZ 세대는 패션 분야에서 '제로 웨이스트 패션'보다 '패스트 패션'을 선호하는 경향이 더욱 두드러지고 있다.",
        "correctAnswer": false,
        "explanation": "MZ 세대는 가치 소비를 중요하게 생각하며, 지속 가능성을 강조하는 '제로 웨이스트 패션'이나 친환경 소재 의류에 대한 관심이 높아지고 있어, 대량 생산되는 패스트 패션과는 거리를 두는 추세입니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "최근 유행하는 '레트로 시크(Retro Chic)' 스타일은 과거의 디자인을 그대로 복각하는 것에 중점을 두며, 현대적인 우아함과는 거리가 멀다.",
        "correctAnswer": false,
        "explanation": "2025년 트렌드로 해석되는 레트로 시크는 과거 스타일에서 영감을 받았지만, 완벽한 재단과 대담한 스타일링을 통해 현대적이고 우아한 감성으로 재해석되는 것이 특징입니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "최근 MZ 세대의 '갓생(God+生)' 트렌드 확산과 함께, 성취감과 만족감을 얻기 위해 소비나 과도한 여가 활동 대신 소박한 일상을 즐기는 '미니멀 라이프'가 주목받고 있다.",
        "correctAnswer": true,
        "explanation": "'갓생'은 자기계발과 건강한 삶을 추구하는 트렌드로, 과도한 소비나 자극적인 활동보다 소소하지만 확실한 만족감을 주는 미니멀 라이프, 소박한 일상 기록 등이 인기를 얻고 있습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "2025년 하이 패션 트렌드에서 '로라이즈 팬츠'는 Y2K 시절의 과장된 디테일과 화려한 색상을 그대로 재현하여 인기를 얻고 있다.",
        "correctAnswer": false,
        "explanation": "최신 로라이즈 팬츠 트렌드는 Y2K의 과장된 디테일을 덜어내고, 미니멀하고 정제된 실루엣으로 돌아와 모던 클래식의 반열에 올라섰습니다.",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 패션•라이프 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "👗"
    }
  },
  4: {
    "availableDate": "2025-10-09",
    "category": "news_issues",
    "questions": [
      {
        "id": "q1",
        "prompt": "MZ 세대가 주로 이용하는 숏폼 플랫폼 중, 1인당 월평균 사용 시간은 유튜브(YouTube)가 틱톡(TikTok)보다 더 길게 나타난다.",
        "correctAnswer": false,
        "explanation": "최근 숏폼 트렌드 조사에 따르면, 틱톡의 1인당 월평균 사용 시간이 유튜브보다 더 길어 MZ 세대의 숏폼 선호도가 높게 나타났습니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "2025년 한국 경제는 인플레이션 부담 완화와 금리 인하 기조에 힘입어 전년도 대비 높은 경제 성장률을 기록할 것으로 전망된다.",
        "correctAnswer": false,
        "explanation": "2025년 한국 경제는 인플레이션 안정화 전망에도 불구하고, 전년도보다 낮은 수준의 성장률(잠재성장률 수준)이 예측되며 대외 환경 악화로 하방 위험이 가중된다는 분석이 나왔습니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "최근 AI 딥페이크(Deepfake) 기술을 악용한 성착취물 사례에서, 딥페이크에 등장한 인물 중 한국 국적자가 다른 국가보다 가장 높은 비중을 차지했다.",
        "correctAnswer": true,
        "explanation": "딥페이크 성착취물에 등장하는 인물 중 한국 국적자가 상당한 비중을 차지하여 딥페이크 오용에 따른 한국 사회의 심각한 인격적 피해 우려가 커지고 있습니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "MZ 세대 사이에서 '숏확행'이라는 신조어가 유행하는 것은, 숏폼 콘텐츠를 시청할 때 복잡한 절차 없이 확실한 만족감을 얻고자 하는 심리를 반영한다.",
        "correctAnswer": true,
        "explanation": "MZ 세대는 짧고 간편한 미디어 콘텐츠를 선호하며, 숏확행(짧게 시청하고 확실한 행복을 얻음)은 이러한 '짧은 콘텐츠로 확실한 행복을 추구'하는 트렌드를 반영합니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "2025년 한국 사회의 가장 큰 구조적 이슈 중 하나인 저출산·고령화와 더불어, 고령화 사회의 기준 연령에 대한 서울시민의 적정 인식은 평균 65세 미만으로 나타났다.",
        "correctAnswer": false,
        "explanation": "서울시민을 대상으로 한 설문조사 결과, 응답자가 생각하는 적절한 노인(고령화 사회) 기준 연령은 평균 70.2세로, 기존의 65세 기준보다 높게 인식하는 것으로 나타났습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "최근 급증하는 AI 딥페이크 악용 범죄에 대응하기 위한 가장 최선의 방법은, 또 다른 AI 기반의 정교한 딥페이크 식별 기술을 발전시키는 것이다.",
        "correctAnswer": true,
        "explanation": "딥페이크의 진위 여부를 가려내기 어렵기 때문에, 피해를 막기 위한 최선의 대응책 중 하나로 AI를 활용한 보이스피싱 탐지나 딥페이크 식별 기술의 발전이 중요하다고 지적됩니다.",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 뉴스•시사 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "🗞️"
    }
  },
  5: {
    "availableDate": "2025-10-10",
    "category": "tech_it",
    "questions": [
      {
        "id": "q1",
        "prompt": "최근 IT 트렌드로 주목받는 '에이전트 AI(Agentic AI)'는 사용자의 구체적인 명령 없이는 자율적으로 목표를 설정하고 실행할 수 없다.",
        "correctAnswer": false,
        "explanation": "에이전트 AI는 기존 AI보다 진화하여, 사용자의 개입 없이도 스스로 목표를 설정하고 복잡한 다단계 문제를 자율적으로 계획하고 실행할 수 있습니다.",
        "difficulty": 0.3
      },
      {
        "id": "q2",
        "prompt": "MZ세대 사이에서 인기를 끄는 '공간 컴퓨팅(Spatial Computing)'은 가상현실(VR)과 증강현실(AR) 기술을 융합하여 현실과 디지털 세계를 연결하는 기술이다.",
        "correctAnswer": true,
        "explanation": "공간 컴퓨팅은 AR과 VR을 아우르는 개념으로, 물리적 공간에 디지털 정보를 중첩하여 사용자가 몰입감 있는 경험을 할 수 있도록 합니다.",
        "difficulty": 0.4
      },
      {
        "id": "q3",
        "prompt": "엣지 컴퓨팅(Edge Computing)은 데이터 처리량을 늘리기 위해 모든 데이터를 클라우드 서버로 전송한 후 처리하는 기술을 의미한다.",
        "correctAnswer": false,
        "explanation": "엣지 컴퓨팅은 데이터가 생성되는 장치나 가까운 네트워크 노드에서 데이터를 처리하여, 네트워크 전송 시간을 줄이고 클라우드로의 불필요한 전송을 최소화하는 기술입니다.",
        "difficulty": 0.5
      },
      {
        "id": "q4",
        "prompt": "생성형 AI(Generative AI) 기술은 텍스트, 이미지, 코드를 포함한 다양한 형태의 비정형 데이터를 분석하여 완전히 새로운 콘텐츠를 창작해낼 수 있다.",
        "correctAnswer": true,
        "explanation": "생성형 AI는 챗GPT 등장 이후 급부상한 기술로, 기존 데이터를 바탕으로 학습하여 완전히 새로운 결과물(글, 이미지, 음성 등)을 만들어내는 것이 특징입니다.",
        "difficulty": 0.6
      },
      {
        "id": "q5",
        "prompt": "최근 '지속 가능한 IT 기술(Sustainable IT)'의 일환으로, 인공지능(AI) 모델 학습 시 전력 소비가 적은 소형 모델보다 무조건 대규모 언어 모델(LLM)을 활용하는 추세이다.",
        "correctAnswer": false,
        "explanation": "대규모 AI 모델의 막대한 전력 소비와 환경 오염 문제가 대두되면서, IT 업계는 에너지 효율을 높이기 위한 에너지 효율적 컴퓨팅 및 지속 가능한 기술을 강조하고 있습니다.",
        "difficulty": 0.45
      },
      {
        "id": "q6",
        "prompt": "양자 컴퓨터의 발전으로 기존 암호화 기술이 무력화될 가능성에 대비하여, 양자 컴퓨터에도 해독이 어려운 암호 체계인 '양자내성 암호(PQC, Post-Quantum Cryptography)'가 차세대 보안 기술로 주목받고 있다.",
        "correctAnswer": true,
        "explanation": "양자내성 암호는 양자 컴퓨터의 연산 능력으로도 해독이 곤란한 수학적 알고리즘을 사용하여, 미래의 보안 기반을 구축하는 핵심 기술로 인식되고 있습니다.",
        "difficulty": 0.7
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 테크•IT 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "💡"
    }
  },
  6: {
    "availableDate": "2025-10-11",
    "category": "sports_games",
    "questions": [
      {
        "id": "q1",
        "prompt": "2024년 KBO 리그 최우수선수(MVP)는 KIA 타이거즈의 김도영 선수이며, 그는 야수 중 최연소 MVP 신기록을 세웠다.",
        "correctAnswer": true,
        "explanation": "2024년 KBO MVP는 KIA 김도영 선수로, 그는 만 21세의 나이로 선정되며 야수 부문 최연소 MVP 기록을 경신했습니다. (전체 최연소 MVP는 류현진)",
        "difficulty": 0.4
      },
      {
        "id": "q2",
        "prompt": "2024 KBO 리그에서 SSG 랜더스의 노경은 선수는 40세가 넘는 나이로 홀드 타이틀을 차지하며 KBO 역사상 최고령 타이틀 홀더 기록을 세웠다.",
        "correctAnswer": true,
        "explanation": "노경은 선수는 40대 선수 중 최초로 타이틀 홀더(홀드상)를 차지하는 영광을 안았으며, 이는 KBO 역사에 새로운 기록을 남겼습니다.",
        "difficulty": 0.5
      },
      {
        "id": "q3",
        "prompt": "2024년 KBO 한국시리즈 MVP는 KIA 타이거즈의 김도영 선수이며, 우승팀에게는 부상으로 자동차가 수여되었다.",
        "correctAnswer": false,
        "explanation": "2024년 한국시리즈 MVP는 KIA 타이거즈의 '김선빈' 선수이며, 김도영 선수는 정규시즌 MVP를 수상했습니다. 한국시리즈 MVP에게는 자동차가 부상으로 수여되었습니다.",
        "difficulty": 0.6
      },
      {
        "id": "q4",
        "prompt": "e스포츠 '리그 오브 레전드 월드 챔피언십(롤드컵) 2024'에서 T1은 4강전에서 중국팀을 꺾고 결승에 진출했으며, 우승을 차지하며 5회 우승의 대기록을 썼다.",
        "correctAnswer": true,
        "explanation": "T1은 2024년 롤드컵에서 중국팀을 꺾고 결승에 진출해 우승을 차지하며, 리그 오브 레전드 e스포츠 역사상 최초로 롤드컵 통산 5회 우승을 달성했습니다.",
        "difficulty": 0.3
      },
      {
        "id": "q5",
        "prompt": "롤드컵 2024 결승전 MVP는 '페이커' 이상혁 선수이며, 이 수상으로 그는 롤드컵 통산 4번째 결승전 MVP를 기록했다.",
        "correctAnswer": false,
        "explanation": "롤드컵 2024 결승전 MVP는 '페이커' 이상혁 선수이지만, 이는 그의 '통산 3번째' 롤드컵 결승전 MVP 수상입니다.",
        "difficulty": 0.7
      },
      {
        "id": "q6",
        "prompt": "2024 LCK 서머 시즌 우승팀은 Gen.G이며, 그들은 이 우승으로 LCK의 월즈(Worlds) 1시드 자리를 확보했다.",
        "correctAnswer": false,
        "explanation": "2024 LCK 서머 시즌 우승팀은 'Hanwha Life Esports'이며, 준우승을 차지한 팀이 Gen.G입니다. Hanwha Life Esports가 1시드를 확보했습니다.",
        "difficulty": 0.45
      }
    ],
    "shareTemplate": {
      "headline": "오늘의 스포츠•게임 퀴즈, 60초 스피드런!",
      "cta": "도전?",
      "emoji": "🏆"
    }
  }
} as const;


function getWeekdayFromIsoDate(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00+09:00`);
  return date.getUTCDay();
}

export function resolveFallbackDailyQuizByWeekday(weekday: number): FallbackQuiz | null {
  return DEFAULT_WEEKLY_DAILY_QUIZZES[weekday] ?? null;
}

export function resolveFallbackDailyQuizByDate(isoDate: string): FallbackQuiz | null {
  const weekday = getWeekdayFromIsoDate(isoDate);
  return resolveFallbackDailyQuizByWeekday(weekday);
}
