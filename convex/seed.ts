import { mutation } from './_generated/server';
import { v } from 'convex/values';

// Seed data for the questions table
const SEED_QUESTIONS = [
  // kinder
  {
    stem: '다음 중 과일이 아닌 것은 무엇일까요?',
    choices: ['사과', '바나나', '당근', '딸기'],
    answerIndex: 2,
    category: 'general', gradeBand: 'kinder', difficulty: 1,
    explanation: '당근은 채소입니다.',
  },
  {
    stem: '신호등의 빨간불은 무엇을 의미할까요?',
    choices: ['가도 된다', '멈춘다', '천천히 간다', '뛰어간다'],
    answerIndex: 1,
    category: 'general', gradeBand: 'kinder', difficulty: 1,
    explanation: "빨간불은 '정지'를 의미합니다.",
  },
  // elem_low
  {
    stem: '1년은 총 몇 달일까요?',
    choices: ['10달', '11달', '12달', '13달'],
    answerIndex: 2,
    category: 'general', gradeBand: 'elem_low', difficulty: 2,
    explanation: '1년은 1월부터 12월까지 총 12달입니다.',
  },
  {
    stem: '우리나라의 국기는 무엇일까요?',
    choices: ['태극기', '성조기', '오성홍기', '일장기'],
    answerIndex: 0,
    category: 'general', gradeBand: 'elem_low', difficulty: 2,
    explanation: '대한민국의 국기는 태극기입니다.',
  },
  // elem_high
  {
    stem: '세종대왕이 만든 우리나라의 글자는 무엇일까요?',
    choices: ['한자', '가나', '알파벳', '한글'],
    answerIndex: 3,
    category: 'general', gradeBand: 'elem_high', difficulty: 3,
    explanation: '세종대왕은 훈민정음을 창제했으며, 오늘날의 한글입니다.',
  },
  {
    stem: "컴퓨터에서 '복사하기'의 단축키는 무엇일까요?",
    choices: ['Ctrl+X', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A'],
    answerIndex: 1,
    category: 'general', gradeBand: 'elem_high', difficulty: 3,
    explanation: 'Ctrl+C는 복사하기, Ctrl+X는 잘라내기, Ctrl+V는 붙여넣기 단축키입니다.',
  },
  // middle
  {
    stem: "조선 시대의 대표적인 화가로 '씨름', '서당' 등의 풍속화를 그린 사람은 누구일까요?",
    choices: ['신윤복', '정선', '김홍도', '장승업'],
    answerIndex: 2,
    category: 'general', gradeBand: 'middle', difficulty: 4,
    explanation: '김홍도는 조선 시대의 대표적인 풍속화가입니다.',
  },
  {
    stem: '지구의 대기 중 가장 많은 비율을 차지하는 기체는 무엇일까요?',
    choices: ['산소', '이산화탄소', '질소', '아르곤'],
    answerIndex: 2,
    category: 'general', gradeBand: 'middle', difficulty: 4,
    explanation: '지구 대기의 약 78%는 질소로 이루어져 있습니다.',
  },
  // high
  {
    stem: "셰익스피어의 4대 비극이 아닌 것은 무엇일까요?",
    choices: ['햄릿', '오셀로', '리어왕', '로미오와 줄리엣'],
    answerIndex: 3,
    category: 'general', gradeBand: 'high', difficulty: 5,
    explanation: "'로미오와 줄리엣'은 4대 비극에 포함되지 않습니다. 4대 비극은 햄릿, 오셀로, 리어왕, 맥베스입니다.",
  },
  {
    stem: "HTTP 상태 코드 중 'Not Found'를 의미하는 코드는 무엇일까요?",
    choices: ['200', '301', '404', '500'],
    answerIndex: 2,
    category: 'general', gradeBand: 'high', difficulty: 5,
    explanation: '404 Not Found는 클라이언트가 요청한 리소스를 서버에서 찾을 수 없음을 의미합니다.',
  },
  // college
  {
    stem: "객체 지향 프로그래밍(OOP)의 4가지 주요 특징에 포함되지 않는 것은 무엇일까요?",
    choices: ['캡슐화', '상속', '다형성', '컴파일'],
    answerIndex: 3,
    category: 'general', gradeBand: 'college', difficulty: 5,
    explanation: '컴파일은 프로그래밍 언어를 기계어로 번역하는 과정이며, OOP의 특징이 아닙니다. 4대 특징은 캡슐화, 상속, 다형성, 추상화입니다.',
  },
  {
    stem: '경제학에서 한 재화의 가격이 상승할 때 다른 재화의 수요가 증가하는 관계를 무엇이라고 할까요?',
    choices: ['보완재', '대체재', '열등재', '정상재'],
    answerIndex: 1,
    category: 'general', gradeBand: 'college', difficulty: 5,
    explanation: '대체재는 한 재화를 다른 재화로 대체할 수 있는 관계로, 한쪽의 가격이 오르면 다른 쪽의 수요가 늘어납니다 (예: 콜라와 사이다).',
  },
] as const;


export const seedQuestions = mutation({
  handler: async (ctx) => {
    let totalInserted = 0;
    for (const question of SEED_QUESTIONS) {
      // Check if a question with the same stem already exists
      const existing = await ctx.db
        .query('questions')
        .withIndex('by_category', (q) => q.eq('category', question.category))
        .filter((q) => q.eq(q.field('stem'), question.stem))
        .first();

      if (!existing) {
        await ctx.db.insert('questions', {
          source: 'curated',
          locale: 'ko-KR',
          flags: [],
          quality: 1500, // ELO-style default rating
          createdAt: Date.now(),
          ...question,
          choices: [...question.choices],
        });
        totalInserted++;
      }
    }
    return { message: `Successfully inserted ${totalInserted} new questions.` };
  },
});
