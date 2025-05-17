import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';

const insertQuiz = useMutation(api.quizzes.insertQuiz);
const quizzes = [
  {
    answer: '블랙핑크',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['블랙핑크', 'BTS', 'TWICE', 'Stray Kids'],
    question: '유튜브에서 가장 많은 구독자를 보유한 K팝 그룹은 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '강남스타일',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['강남스타일', 'Fantastic Baby', 'Gee', 'Nobody'],
    question:
      'K팝 역사상 최초로 유튜브 조회수 10억 뷰를 넘긴 뮤직비디오의 곡 제목은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '빌보드',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['빌보드', '오리콘', '가온', 'UK 차트'],
    question: '미국 음악 시장의 주요 앨범 및 싱글 차트 이름은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '2세대',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['1세대', '2세대', '3세대', '4세대'],
    question:
      '소녀시대, 빅뱅, 슈퍼주니어 등이 활동했던 K팝 시대를 몇 세대라고 부를까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '하이브 (HYBE)',
    category: 'kpop-music',
    difficulty: 'easy',
    options: [
      'SM 엔터테인먼트',
      'YG 엔터테인먼트',
      'JYP 엔터테인먼트',
      '하이브 (HYBE)',
    ],
    question: '그룹 BTS의 소속사 이름은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '트와이스',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['트와이스', '블랙핑크', '아이브', '뉴진스'],
    question:
      '‘What is Love?’ 뮤직비디오에서 다양한 영화 장면을 패러디한 그룹은 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'Gee',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['Gee', 'Tell Me', 'So Hot', 'Nobody'],
    question:
      "소녀시대의 대표곡 중 하나로, 'Oh Oh Oh' 후렴구가 인상적인 곡은 무엇일까요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '멜론 (Melon)',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['멜론 (Melon)', '지니뮤직', '벅스뮤직', '플로 (FLO)'],
    question:
      '한국에서 가장 많은 사용자를 보유한 음원 스트리밍 플랫폼 중 하나는 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '3세대',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['2세대', '3세대', '4세대', '5세대'],
    question:
      'BTS, 블랙핑크, 트와이스 등이 활발하게 활동한 시기를 K팝 몇 세대라고 구분할까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'JYP 엔터테인먼트',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['SM 엔터테인먼트', 'YG 엔터테인먼트', 'JYP 엔터테인먼트', 'HYBE'],
    question: '원더걸스, 2PM, 스트레이 키즈를 배출한 기획사는 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '뮤직뱅크',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['뮤직뱅크', '인기가요', '엠카운트다운', '쇼! 음악중심'],
    question:
      '매주 금요일에 방송되는 KBS의 대표적인 K팝 음악 프로그램은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '응원봉',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['응원봉', '플래카드', '슬로건', '포토카드'],
    question:
      'K팝 팬들이 콘서트나 팬미팅에서 그룹이나 가수를 응원하기 위해 사용하는 야광 막대 형태의 도구는 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '레드벨벳',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['레드벨벳', '블랙핑크', '아이즈원', 'ITZY'],
    question:
      "'피카부 (Peek-A-Boo)' 뮤직비디오에서 몽환적이면서도 미스터리한 분위기를 자아내는 그룹은 어디일까요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'Tell Me',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['Tell Me', 'Gee', 'Sorry Sorry', 'Lies'],
    question:
      "원더걸스를 국민 걸그룹 반열에 올려놓은 '어머나!'로 시작하는 후렴구가 인상적인 곡은 무엇일까요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '지니뮤직',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['멜론 (Melon)', '지니뮤직', '벅스뮤직', '웨이브 (Wavve)'],
    question: 'KT에서 운영하는 국내 음원 스트리밍 서비스 플랫폼은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '4세대',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['3세대', '4세대', '5세대', '6세대'],
    question:
      '아이브, 뉴진스, 르세라핌 등이 등장하며 새롭게 K팝 시장을 이끌고 있는 시기를 몇 세대라고 부를까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'YG 엔터테인먼트',
    category: 'kpop-music',
    difficulty: 'medium',
    options: [
      'SM 엔터테인먼트',
      'YG 엔터테인먼트',
      'JYP 엔터테인먼트',
      '하이브 (HYBE)',
    ],
    question: '빅뱅, 2NE1, 블랙핑크, 트레저를 배출한 기획사는 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '인기가요',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['뮤직뱅크', '인기가요', '엠카운트다운', '쇼! 챔피언'],
    question:
      '매주 일요일에 방송되는 SBS의 대표적인 K팝 음악 프로그램은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '포토카드',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['응원봉', '포토카드', '앨범', '굿즈'],
    question:
      'K팝 앨범을 구매하면 랜덤으로 들어있는 멤버들의 사진이 담긴 작은 카드를 무엇이라고 부를까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '아이브',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['아이브', '르세라핌', '에스파', '뉴진스'],
    question:
      "'ELEVEN'으로 데뷔하여 'After LIKE', 'I AM' 등 다수의 히트곡을 보유한 그룹은 어디일까요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'Nobody',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['Nobody', 'So Hot', 'Tell Me', 'Irony'],
    question:
      "원더걸스의 곡 중에서 복고풍 콘셉트와 'I want nobody nobody but you' 후렴구가 유명한 곡은 무엇일까요?",
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '벅스뮤직',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['멜론 (Melon)', '지니뮤직', '벅스뮤직', '카카오뮤직'],
    question:
      'NHN벅스에서 운영하는 국내 음원 스트리밍 및 다운로드 서비스 플랫폼은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '5세대',
    category: 'kpop-music',
    difficulty: 'hard',
    options: ['4세대', '5세대', '6세대', '7세대'],
    question:
      '아직 명확한 기준은 없지만, 2023년 이후 데뷔하는 그룹들을 K팝 몇 세대로 분류하려는 움직임이 있을까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: 'SM 엔터테인먼트',
    category: 'kpop-music',
    difficulty: 'medium',
    options: [
      'SM 엔터테인먼트',
      'YG 엔터테인먼트',
      'JYP 엔터테인먼트',
      '큐브 엔터테인먼트',
    ],
    question: '레드벨벳, 에스파, 라이즈를 배출한 기획사는 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '엠카운트다운',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['엠카운트다운', '뮤직뱅크', '인기가요', '쇼! 음악중심'],
    question:
      '매주 목요일에 방송되는 Mnet의 대표적인 K팝 음악 프로그램은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '굿즈',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['굿즈', '앨범', '음원', '방송 출연'],
    question:
      'K팝 그룹의 로고나 사진 등을 활용하여 제작된 다양한 상품들을 통칭하는 용어는 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '플로 (FLO)',
    category: 'kpop-music',
    difficulty: 'medium',
    options: ['멜론 (Melon)', '지니뮤직', '벅스뮤직', '플로 (FLO)'],
    question: 'SK텔레콤에서 운영하는 인공지능 기반의 음악 플랫폼은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '하이브 (HYBE)',
    category: 'kpop-music',
    difficulty: 'medium',
    options: [
      'SM 엔터테인먼트',
      'YG 엔터테인먼트',
      'JYP 엔터테인먼트',
      '하이브 (HYBE)',
    ],
    question:
      'BTS, 투모로우바이투게더, 엔하이픈, 르세라핌이 소속된 기획사는 어디일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
  {
    answer: '쇼! 음악중심',
    category: 'kpop-music',
    difficulty: 'easy',
    options: ['쇼! 음악중심', '엠카운트다운', '뮤직뱅크', '쇼! 챔피언'],
    question:
      '매주 토요일에 방송되는 MBC의 대표적인 K팝 음악 프로그램은 무엇일까요?',
    questionFormat: 'multiple',
    quizType: 'knowledge',
  },
];

const uploadQuiz = async (quizzes: any) => {
  for (const quiz of quizzes) {
    try {
      await insertQuiz(quiz as any);
      console.log(`✅ Uploaded: ${quiz.question}`);
    } catch (error) {
      console.error(`❌ Failed: ${quiz.question}`, error);
    }
  }
};
