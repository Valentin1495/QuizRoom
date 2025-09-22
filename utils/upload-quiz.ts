import { log } from './log';
import { logError } from './log-error';

const quizzes = [
  {
    answer: '무리수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['유리수', '정수', '자연수', '무리수'],
    question: '분수로 나타낼 수 없는 실수를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '허수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['실수', '유리수', '허수', '정수'],
    question: '제곱하여 음수가 되는 수를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '복소수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['실수', '허수', '유리수', '복소수'],
    question: '실수와 허수를 포함하는 수를 통틀어 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '로그',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['지수', '로그', '미분', '적분'],
    question: '어떤 수를 밑으로 하는 거듭제곱을 나타내는 기호는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '미분',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['적분', '미분', '극한', '수열'],
    question: '함수의 순간적인 변화율을 구하는 계산법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '적분',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['미분', '적분', '극한', '수열'],
    question:
      '함수의 그래프와 x축 사이의 넓이를 구하는 계산법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '극한',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['미분', '적분', '극한', '수열'],
    question:
      '변수가 특정 값에 한없이 가까워질 때 함수의 값이 가까워지는 값을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '행렬',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['벡터', '텐서', '스칼라', '행렬'],
    question:
      '숫자나 기호를 직사각형 모양으로 배열한 것을 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '벡터',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['스칼라', '벡터', '행렬', '텐서'],
    question: '크기와 방향을 모두 가지는 물리량을 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '미분방정식',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['선형대수', '확률론', '미분방정식', '정수론'],
    question:
      '미지 함수와 그 미분들의 관계를 나타내는 방정식을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '푸리에 변환',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['라플라스 변환', '푸리에 변환', '웨이블릿 변환', '코사인 변환'],
    question:
      '시간 영역의 신호를 주파수 영역의 신호로 변환하는 수학적 기법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '라플라스 변환',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['푸리에 변환', '라플라스 변환', 'Z-변환', '힐베르트 변환'],
    question:
      '시간 영역의 함수를 복소수 주파수 영역의 함수로 변환하는 수학적 기법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '해석학',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['대수학', '기하학', '정수론', '해석학'],
    question: '미적분학, 극한, 연속성 등을 다루는 수학 분야는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '정수론',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['대수학', '기하학', '정수론', '해석학'],
    question: '정수의 성질을 연구하는 수학 분야는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '확률론',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['통계학', '미적분학', '확률론', '집합론'],
    question:
      '불확실한 사건의 발생 가능성을 수치화하고 분석하는 수학 분야는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '위상수학',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['기하학', '해석학', '대수학', '위상수학'],
    question:
      '연속적인 변형에도 변하지 않는 공간의 성질을 연구하는 수학 분야는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '군',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['환', '체', '군', '벡터 공간'],
    question:
      '특정 연산에 대해 닫혀 있고 결합법칙, 항등원, 역원을 만족하는 대수 구조를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '환',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['군', '체', '환', '벡터 공간'],
    question:
      '두 가지 연산에 대해 결합법칙, 분배법칙 등을 만족하는 대수 구조를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '체',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['군', '환', '체', '집합'],
    question:
      '사칙연산이 모두 가능하고 나눗셈이 0으로 나누는 경우를 제외하고 항상 정의되는 대수 구조를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '리만 가설',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '골드바흐의 추측',
      '페르마의 마지막 정리',
      '리만 가설',
      '푸앵카레 추측',
    ],
    question:
      '소수의 분포에 대한 미해결 문제 중 하나로, 리만 제타 함수의 비자명 근이 모두 임계선 위에 있다는 가설은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '푸앵카레 추측',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '리만 가설',
      '푸앵카레 추측',
      'P-NP 문제',
      '나비에-스토크스 방정식',
    ],
    question:
      '3차원 다양체에서 단순 연결이 구와 동치라는 위상수학의 추측으로, 2002년 그리고리 페렐만에 의해 증명된 것은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '페르마의 마지막 정리',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '피타고라스의 정리',
      '페르마의 마지막 정리',
      '디오판토스 방정식',
      '오일러의 공식',
    ],
    question:
      'n이 2보다 큰 정수일 때, $a^n + b^n = c^n$을 만족하는 양의 정수 $a, b, c$는 존재하지 않는다는 정리는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '골드바흐의 추측',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '쌍둥이 소수 추측',
      '골드바흐의 추측',
      '카탈란의 추측',
      '비베르바흐의 추측',
    ],
    question:
      '2보다 큰 모든 짝수는 두 소수의 합으로 나타낼 수 있다는 정수론의 미해결 추측은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '수열',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['함수', '방정식', '수열', '집합'],
    question: '규칙에 따라 나열된 수들의 집합을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '급수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['수열', '함수', '급수', '극한'],
    question: '수열의 항들을 차례로 더한 것을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '조화평균',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['산술평균', '기하평균', '조화평균', '제곱평균'],
    question: '수의 역수들의 산술평균의 역수를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '공리',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['정의', '정리', '증명', '공리'],
    question: '증명 없이 참으로 받아들이는 기본적인 명제를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '정리',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['공리', '정의', '정리', '가설'],
    question:
      '공리나 다른 정리들로부터 논리적으로 증명된 명제를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '모순',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['동치', '함의', '모순', '대우'],
    question:
      '어떤 명제와 그 명제의 부정이 동시에 참일 수 없는 논리적 관계를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '필요충분조건',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['필요조건', '충분조건', '필요충분조건', '상관관계'],
    question:
      '두 명제 P와 Q에 대해 P가 Q이면 Q가 P인 관계를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '명제 논리',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['술어 논리', '양상 논리', '명제 논리', '비고전 논리'],
    question:
      '명제를 기본 단위로 하여 논리적 관계를 다루는 논리 체계를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '술어 논리',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['명제 논리', '술어 논리', '양상 논리', '직관주의 논리'],
    question:
      '명제 내부의 구조(술어, 변수, 양화사)까지 분석하여 논리적 관계를 다루는 논리 체계를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '귀류법',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['직접 증명법', '간접 증명법', '귀류법', '수학적 귀납법'],
    question:
      '어떤 명제가 참임을 증명하기 위해 그 명제의 부정이 참이라고 가정했을 때 모순이 발생함을 보이는 증명법은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '수학적 귀납법',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['연역법', '귀납법', '수학적 귀납법', '유추'],
    question:
      '어떤 명제가 모든 자연수에 대해 성립함을 증명하는 방법 중, 기저 단계와 귀납 단계를 이용하는 것은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '파스칼의 삼각형',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['피보나치 수열', '파스칼의 삼각형', '황금비', '삼각수'],
    question:
      '이항계수를 배열하여 삼각형 형태로 나타낸 것으로, 각 줄의 숫자가 위 두 수의 합인 것은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '피보나치 수열',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['등차수열', '등비수열', '피보나치 수열', '조화수열'],
    question:
      '첫째 항과 둘째 항이 1이고, 이후의 항은 바로 앞의 두 항의 합으로 이루어진 수열은 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '오일러의 공식',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '피타고라스의 정리',
      '페르마의 정리',
      '오일러의 공식',
      '가우스의 정리',
    ],
    question:
      '복소 지수 함수와 삼각 함수 사이의 관계를 나타내는 $e^{ix} = \cos x + i \sin x$는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '이차방정식',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['일차방정식', '이차방정식', '삼차방정식', '사차방정식'],
    question:
      '최고차항의 차수가 2인 다항식으로 이루어진 방정식을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '수열의 극한',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['급수', '함수의 극한', '수열의 극한', '미분계수'],
    question:
      '수열의 항의 번호가 한없이 커질 때, 그 항들이 가까워지는 값을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '도함수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['원함수', '역함수', '도함수', '부정적분'],
    question:
      '미분 가능한 함수의 미분계수를 나타내는 새로운 함수를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '편미분',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['전미분', '상미분', '편미분', '방향 미분'],
    question:
      '다변수 함수에서 하나의 변수에 대해서만 미분하는 것을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '고유값',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['고유벡터', '고유값', '특이값', '스펙트럼'],
    question:
      '선형 변환에 의해 방향은 변하지 않고 크기만 변하는 벡터에 해당하는 스칼라 값을 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '정칙 함수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['연속 함수', '미분 가능 함수', '해석 함수', '정칙 함수'],
    question:
      '복소평면의 한 영역에서 미분 가능한 복소 함수를 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '유수',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['특이점', '극점', '유수', '영점'],
    question:
      '복소 함수의 고립 특이점 근처에서 복소 적분을 계산하는 데 사용되는 계수를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '리만 적분',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['르베그 적분', '스틸체스 적분', '리만 적분', '확률 적분'],
    question:
      '함수의 넓이를 구하기 위해 직사각형 근사를 사용하는 적분 방법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '르베그 적분',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['리만 적분', '르베그 적분', '다중 적분', '선적분'],
    question:
      '함수의 값을 기준으로 분할하여 적분하는 현대적인 적분 방법을 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '확률 밀도 함수',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '누적 분포 함수',
      '확률 질량 함수',
      '확률 밀도 함수',
      '모멘트 생성 함수',
    ],
    question:
      '연속 확률 변수가 특정 값을 가질 확률을 나타내는 함수를 무엇이라고 하나요?',
    questionFormat: 'multiple',
  },
  {
    answer: '베이즈 정리',
    category: 'math-logic',
    difficulty: 'hard',
    options: [
      '중심 극한 정리',
      '큰 수의 법칙',
      '베이즈 정리',
      '체비쇼프 부등식',
    ],
    question:
      '새로운 정보를 얻었을 때 어떤 사건의 확률을 갱신하는 방법을 제시하는 정리는 무엇인가요?',
    questionFormat: 'multiple',
  },
  {
    answer: '동형사상',
    category: 'math-logic',
    difficulty: 'hard',
    options: ['준동형사상', '단사 함수', '전사 함수', '동형사상'],
    question:
      '두 대수 구조 사이의 매핑으로, 구조를 보존하면서 역함수가 존재하는 것을 무엇이라고 부르나요?',
    questionFormat: 'multiple',
  },
];
log(quizzes.length);

export const uploadQuizBatch = async (insertQuizBatch: any) => {
  try {
    const result = await insertQuizBatch({ quizzes });
    log(`✅ Successfully uploaded ${result.count} quizzes in batch`);
    return result;
  } catch (error) {
    logError('❌ Batch upload failed:', error);
    throw error;
  }
};
