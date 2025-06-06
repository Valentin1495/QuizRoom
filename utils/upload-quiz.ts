const quizzes = [
  {
    answers: ['오손 웰스', 'Orson Welles'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'시민 케인'으로 유명하며, 혁신적인 촬영 기법과 서사 구조를 도입한 감독이자 배우는 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['쿠엔틴 타란티노', 'Quentin Tarantino'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'펄프 픽션', '킬 빌', '바스터즈: 거친 녀석들' 등 독특한 대사와 비선형적 서사 구조로 유명한 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['찰리 채플린', 'Charlie Chaplin'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "무성 영화 시대의 코미디 황제로 불리며, '모던 타임즈', '위대한 독재자' 등을 연출하고 주연한 인물은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['알프레드 히치콕', 'Alfred Hitchcock'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'싸이코', '새', '현기증' 등 서스펜스와 스릴러 영화의 대가로 불리는 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['스탠리 큐브릭', 'Stanley Kubrick'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'2001 스페이스 오디세이', '시계태엽 오렌지', '샤이닝' 등 철학적이고 완벽주의적인 연출로 유명한 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['대부', 'The Godfather'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "마피아 조직 '콜레오네 패밀리'의 이야기를 다룬 프랜시스 포드 코폴라 감독의 명작 영화는 무엇인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['펄프 픽션', 'Pulp Fiction'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '쿠엔틴 타란티노 감독의 대표작 중 하나로, 여러 에피소드가 얽히고설키는 비선형적 구성이 특징인 영화는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['블레이드 러너 2049', 'Blade Runner 2049'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'블레이드 러너'의 후속작으로, 드니 빌뇌브 감독이 연출한 SF 영화는 무엇인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['아멜리에', 'Amélie'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '파리를 배경으로 소심하지만 상상력이 풍부한 웨이트리스가 주변 사람들을 돕는 이야기를 다룬 프랑스 영화는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['돌비 애트모스', 'Dolby Atmos'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화관에서 3차원 입체 음향을 구현하는 기술로, 사운드 객체를 천장을 포함한 공간 전체에 배치하는 기술은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['롱 테이크', 'Long Take'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화 촬영에서 컷 없이 한 장면을 길게 촬영하는 기법을 의미하는 용어는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['미장센', 'Mise-en-scène'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화에서 화면에 담기는 모든 시각적 요소(배경, 소품, 의상, 조명, 배우의 움직임 등)를 통틀어 이르는 프랑스어 용어는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['맥거핀', 'MacGuffin'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '알프레드 히치콕 감독이 자주 사용한 개념으로, 영화 속에서 등장인물의 동기를 부여하지만 그 자체로는 중요하지 않은 대상을 의미하는 용어는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['앙드레 바쟁', 'André Bazin'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "프랑스 영화 비평가이자 영화 이론가로, 영화 잡지 '카이에 뒤 시네마'의 공동 설립자이며 누벨 바그 감독들에게 영향을 준 인물은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['세르게이 에이젠슈타인', 'Sergei Eisenstein'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'전함 포템킨', '10월' 등을 연출하며 몽타주 이론을 정립한 러시아의 영화 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['누벨 바그', 'Nouvelle Vague'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "1950년대 후반 프랑스에서 시작된 영화 운동으로, 기존의 영화 문법을 거부하고 실험적인 시도를 한 '새로운 물결'을 의미하는 용어는 무엇인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['엑스마키나', 'Ex Machina'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '인공지능 로봇의 의식과 인간의 본성을 탐구하는 SF 스릴러 영화로, 알렉스 갈랜드 감독의 작품은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['로마', 'Roma'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '알폰소 쿠아론 감독의 2018년 작으로, 1970년대 멕시코시티의 한 중산층 가정의 이야기를 흑백으로 담아낸 영화의 제목은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['파라노이아', 'Paranoia'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'컨버세이션', '세븐', '조커' 등에서 자주 나타나는, 등장인물이 자신을 향한 타인의 음모나 박해를 의심하는 심리 상태를 표현하는 장르적 특징은 무엇인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['마틴 스코세이지', 'Martin Scorsese'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'택시 드라이버', '성난 황소', '좋은 친구들' 등 범죄와 폭력을 사실적으로 묘사하는 작품으로 유명한 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['클린트 이스트우드', 'Clint Eastwood'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'용서받지 못한 자', '밀리언 달러 베이비', '그랜 토리노' 등 배우이자 감독으로서 큰 성공을 거둔 할리우드 아이콘은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['봉준호', 'Bong Joon-ho'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '2020년 아카데미 시상식에서 감독상, 각본상, 국제영화상 등 4개 부문을 수상한 한국 감독은 누구인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['박찬욱', 'Park Chan-wook'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'올드보이', '친절한 금자씨', '아가씨' 등 복수와 비틀린 욕망을 탐구하는 작품으로 유명한 한국 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['드니 빌뇌브', 'Denis Villeneuve'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'컨택트', '블레이드 러너 2049', '듄' 등 묵직한 연출과 심도 있는 SF 세계관으로 평가받는 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['데이비드 린치', 'David Lynch'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'멀홀랜드 드라이브', '트윈 픽스' 등 초현실주의적이고 난해한 연출로 컬트적인 인기를 얻은 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['콰이강의 다리', 'The Bridge on the River Kwai'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '제2차 세계대전 중 일본군 포로가 된 영국군 병사들이 태국과 버마를 잇는 철도 건설에 동원되는 이야기를 다룬 1957년작 영화는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['마스터', 'The Master'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '사이언톨로지 교회를 연상시키는 사이비 종교의 교주와 한 전쟁 참전 용사 간의 관계를 그린 폴 토마스 앤더슨 감독의 영화는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['프랑스', 'France'],
    category: 'entertainment',
    difficulty: 'hard',
    question: '칸 영화제가 매년 개최되는 나라는 어디인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['베니스', 'Venice'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '세계에서 가장 오래된 영화제 중 하나인 베니스 국제 영화제가 열리는 이탈리아 도시는 어디인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['골든 글로브상', 'Golden Globe Awards'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화와 텔레비전 분야를 모두 시상하며, 아카데미상의 전초전으로 불리기도 하는 시상식은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['백상예술대상', 'Baeksang Arts Awards'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '한국에서 영화, 드라마, 연극 등 대중문화 전반에 걸쳐 시상하는 종합 예술 시상식은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['미스터리 박스', 'Mystery Box'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      'J.J. 에이브럼스 감독이 자신의 작품에서 자주 사용하는 개념으로, 관객의 호기심을 자극하며 이야기가 진행됨에 따라 점차 드러나는 비밀스러운 요소를 의미하는 용어는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['디졸브', 'Dissolve'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화 편집 기술 중 하나로, 한 화면이 서서히 사라지면서 다른 화면이 서서히 나타나는 전환 효과는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['클리프행어', 'Cliffhanger'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '영화나 드라마에서 다음 에피소드나 속편에 대한 궁금증을 유발하기 위해 긴장감 넘치는 상황에서 끝내는 기법은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['존 포드', 'John Ford'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'수색자', '역마차' 등 서부극의 대가로 불리며, 아카데미 감독상을 4회 수상한 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['안드레이 타르콥스키', 'Andrei Tarkovsky'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'솔라리스', '스토커', '희생' 등 시적인 영상미와 심오한 철학적 메시지로 유명한 러시아 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['미켈란젤로 안토니오니', 'Michelangelo Antonioni'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'밤', '일식', '모험' 등 인간 소외와 현대인의 고독을 탐구하는 모더니즘 영화의 거장으로 불리는 이탈리아 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['루키노 비스콘티', 'Luchino Visconti'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'레오파드', '베니스에서의 죽음' 등 귀족적이고 사실적인 묘사가 특징인 이탈리아 네오리얼리즘의 거장은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['프랜시스 포드 코폴라', 'Francis Ford Coppola'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'대부' 시리즈와 '지옥의 묵시록'으로 유명한 미국의 거장 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['에밀 쿠스투리차', 'Emir Kusturica'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'집시의 시간', '언더그라운드' 등 발칸 지역의 현실을 마법적 리얼리즘으로 표현하는 보스니아 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['페드로 알모도바르', 'Pedro Almodóvar'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'내 어머니의 모든 것', '그녀에게' 등 강렬한 색감과 여성 캐릭터를 중심으로 스페인 사회를 다루는 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['카이에 뒤 시네마', 'Cahiers du Cinéma'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '프랑스 누벨 바그 감독들의 산실이자 영화 이론을 발전시킨 프랑스의 유명 영화 비평 잡지의 이름은 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['IMDb', 'Internet Movie Database'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      '세계에서 가장 큰 영화, TV 프로그램, 비디오 게임 관련 정보를 제공하는 온라인 데이터베이스 웹사이트는 무엇인가요?',
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['로베르토 로셀리니', 'Roberto Rossellini'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'로마, 오픈 시티' 등 이탈리아 네오리얼리즘 운동의 선구자로 불리는 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['비토리오 데 시카', 'Vittorio De Sica'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'자전거 도둑', '움베르토 D.' 등 이탈리아 네오리얼리즘의 대표작을 연출한 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['프리츠 랑', 'Fritz Lang'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'메트로폴리스', 'M' 등 독일 표현주의 영화의 거장으로 불리는 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['잉마르 베리만', 'Ingmar Bergman'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'제7의 봉인', '산딸기' 등 인간의 존재론적 고뇌와 죽음을 다룬 스웨덴의 거장 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['아키라 쿠로사와', 'Akira Kurosawa'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'7인의 사무라이', '라쇼몽' 등 일본 영화의 거장으로 불리며 서양 영화에도 큰 영향을 미친 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['페데리코 펠리니', 'Federico Fellini'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'달콤한 인생', '8과 1/2' 등 초현실주의적이고 환상적인 연출로 유명한 이탈리아 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['베르나르도 베르톨루치', 'Bernardo Bertolucci'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'마지막 탱고', '마지막 황제' 등 정치적 메시지와 서사적 스케일을 결합한 이탈리아 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['조지 밀러', 'George Miller'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'매드 맥스' 시리즈를 연출한 호주 출신의 감독으로, '퓨리오사: 매드맥스 사가'의 감독은 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
  {
    answers: ['다니엘 데이 루이스', 'Daniel Day-Lewis'],
    category: 'entertainment',
    difficulty: 'hard',
    question:
      "'데어 윌 비 블러드', '링컨', '나의 왼발' 등 메서드 연기의 대가로 불리는 영국 배우는 누구인가요?",
    questionFormat: 'short',
    quizType: 'knowledge',
  },
];

console.log(quizzes.length);

export const uploadQuizBatch = async (insertQuizBatch: any) => {
  try {
    const result = await insertQuizBatch({ quizzes });
    console.log(`✅ Successfully uploaded ${result.count} quizzes in batch`);
    return result;
  } catch (error) {
    console.error('❌ Batch upload failed:', error);
    throw error;
  }
};
