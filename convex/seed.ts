import { mutation } from './_generated/server';
import { v } from 'convex/values';

// Seed data for the questions table
const SEED_QUESTIONS = [
  // 일반상식
  {
    stem: '대한민국의 수도는 어디인가요?',
    choices: ['부산', '서울', '인천', '대구'],
    answerIndex: 1,
    category: 'general', gradeBand: 'K-2', difficulty: 1,
    explanation: '대한민국의 수도는 서울입니다.',
  },
  {
    stem: 'React Native는 어떤 언어를 사용하여 앱을 만드나요?',
    choices: ['Java', 'Swift', 'JavaScript', 'Kotlin'],
    answerIndex: 2,
    category: 'general', gradeBand: '9-12', difficulty: 2,
    explanation: 'React Native는 JavaScript와 React를 기반으로 네이티브 앱을 만듭니다.',
  },
  // 국어
  {
    stem: "'하늘을 나는 자동차'는 어떤 종류의 표현법일까요?",
    choices: ['직유법', '은유법', '활유법', '의인법'],
    answerIndex: 1,
    category: 'korean', gradeBand: '6-8', difficulty: 3,
    explanation: "'A는 B이다' 형태의 은유법에 해당합니다.",
  },
  // 수학
  {
    stem: '정삼각형의 한 내각의 크기는 몇 도일까요?',
    choices: ['45도', '60도', '90도', '120도'],
    answerIndex: 1,
    category: 'math', gradeBand: '3-5', difficulty: 2,
    explanation: '정삼각형의 세 내각의 합은 180도이며, 모든 각의 크기가 같으므로 한 내각은 60도입니다.',
  },
  // 과학
  {
    stem: '물질의 세 가지 상태가 아닌 것은 무엇일까요?',
    choices: ['고체', '액체', '기체', '플라즈마'],
    answerIndex: 3,
    category: 'science', gradeBand: '6-8', difficulty: 3,
    explanation: '일반적으로 물질의 세 가지 상태는 고체, 액체, 기체를 말합니다. 플라즈마는 제4의 상태로 불립니다.',
  },
];


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
        });
        totalInserted++;
      }
    }
    return { message: `Successfully inserted ${totalInserted} new questions.` };
  },
});
