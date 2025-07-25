import { useGamification } from '@/context/gamification-context';
import {
  QuestionFormatByQuizType,
  QuizType,
  useQuizSetup,
  UserAnswer,
} from '@/context/quiz-setup-context';
import { Doc } from '@/convex/_generated/dataModel';
import { log } from '@/utils/log';
import { useCallback, useRef, useState } from 'react';

export const useQuizGamification = () => {
  const quizSetup = useQuizSetup();
  const gamification = useGamification();

  // 로컬 게임화 상태
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [showPointsAnimation, setShowPointsAnimation] =
    useState<boolean>(false);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);

  // 업적 추적을 위한 ref들
  const questionStartTime = useRef<number>(Date.now());
  const allAnswerTimes = useRef<number[]>([]);
  const correctAnswerStreak = useRef<number>(0);
  const firstThreeAnswers = useRef<boolean[]>([]);
  const maxStreakInQuiz = useRef<number>(0);

  const isComebackVictory = (userAnswers: UserAnswer[]): boolean => {
    // 처음 3문제를 모두 틀렸는지
    const firstThreeWrong = userAnswers
      .slice(0, 3)
      .every((a) => a.isCorrect === false);

    // 4번째부터 끝까지 모두 정답인지
    const restAnswers = userAnswers.slice(3);
    const restAllCorrect = restAnswers.every((a) => a.isCorrect === true);

    return firstThreeWrong && restAllCorrect;
  };

  // 포인트 계산 로직 (난이도 + 카테고리 보너스 개선)
  const calculatePoints = useCallback(
    (
      isCorrect: boolean,
      question: Doc<'quizzes'>,
      streakCount: number
    ): number => {
      if (!isCorrect) return 0;

      let points = 0;

      // 1. 난이도별 기본 포인트
      switch (question.difficulty) {
        case 'easy':
          points = 10;
          break;
        case 'medium':
          points = 15;
          break;
        case 'hard':
          points = 25;
          break;
        default:
          points = 10; // null일 경우 기본값
          break;
      }

      // 2. 카테고리별 보너스 (기존보다 세분화)
      switch (question.category) {
        // 고난이도 카테고리 (높은 보너스)
        case 'math-logic':
          points += 8;
          break;
        case 'science-tech':
          points += 6;
          break;

        // 중간 난이도 카테고리 (중간 보너스)
        case 'history-culture':
          points += 4;
          break;
        case 'arts-literature':
          points += 4;
          break;
        case 'foreign-movie':
          points += 3;
          break;
        case 'foreign-celebrity':
          points += 3;
          break;

        // 일반 카테고리 (낮은 보너스)
        case 'kpop-music':
          points += 2;
          break;
        case 'entertainment':
          points += 2;
          break;
        case 'korean-movie':
          points += 2;
          break;
        case 'korean-celebrity':
          points += 2;
          break;
        case 'sports':
          points += 1;
          break;

        // 기본 카테고리 (보너스 없음)
        case 'general':
        default:
          break;
      }

      // 3. 퀴즈 타입별 보너스 (새로 추가)
      switch (question.quizType) {
        case 'four-character':
        case 'proverb-chain':
          points += 3; // 한국어 지식 보너스
          break;
        case 'movie-chain':
          points += 2; // 연상 능력 보너스
          break;
        case 'nonsense':
          points += 4; // 창의성 보너스
          break;
        case 'logo':
          points += 2; // 시각적 인식 보너스
          break;
        case 'slang':
          points += 2; // 현대 언어 보너스
          break;
        case 'knowledge':
        case 'celebrity':
        default:
          break;
      }

      // 4. 주관식 문제 보너스
      if (question.questionFormat === 'short') {
        points += 3; // 주관식은 더 어려우므로 보너스
      }

      // 5. 연속 정답 보너스 (기존 유지하되 개선)
      if (streakCount >= 3) {
        const streakBonus = Math.floor(streakCount / 3) * 3; // 3문제마다 3포인트씩
        points += Math.min(streakBonus, 15); // 최대 15포인트까지만 보너스
      }

      // 6. 특별 콤보 보너스 (새로 추가)
      // 어려운 난이도 + 고난이도 카테고리 조합
      if (
        question.difficulty === 'hard' &&
        question.category &&
        ['math-logic', 'science-tech'].includes(question.category)
      ) {
        points += 5; // 콤보 보너스
      }

      return points;
    },
    []
  );

  // 답변 처리 (업적 추적 강화)
  const handleAnswer = useCallback(
    (
      currentQuestion: Doc<'quizzes'>,
      currentQuestionIndex: number,
      userAnswer: string,
      questionFormat: QuestionFormatByQuizType<QuizType>
    ): { isCorrect: boolean; pointsEarned: number; newStreak: number } => {
      // 답변 시간 측정
      const endTime = Date.now();
      const answerTime = (endTime - questionStartTime.current) / 1000; // 초 단위
      allAnswerTimes.current.push(answerTime);

      let correct = false;

      // 정답 확인
      if (questionFormat === 'multiple') {
        correct = userAnswer === currentQuestion.answer;
      } else {
        correct = currentQuestion
          .answers!.map((a) => a.toLowerCase())
          .includes(userAnswer.toLowerCase());
      }

      // 연속 정답 추적 (업적용)
      if (correct) {
        correctAnswerStreak.current++;
        maxStreakInQuiz.current = Math.max(
          maxStreakInQuiz.current,
          correctAnswerStreak.current
        );
      } else {
        correctAnswerStreak.current = 0;
      }

      // 처음 3문제 결과 추적
      if (currentQuestionIndex < 3) {
        firstThreeAnswers.current[currentQuestionIndex] = correct;
      }

      // 스트릭 업데이트 (UI용)
      let newStreak: number;
      if (correct) {
        newStreak = currentStreak + 1;
        setCurrentStreak(newStreak);
      } else {
        newStreak = 0;
        setCurrentStreak(0);
      }

      // 포인트 계산 및 추가
      const pointsEarned = calculatePoints(correct, currentQuestion, newStreak);

      if (pointsEarned > 0) {
        setEarnedPoints(pointsEarned);
        setShowPointsAnimation(true);
        gamification.addPoints(
          pointsEarned,
          `Question ${currentQuestionIndex + 1}`
        );
      }

      // 사용자 답변 업데이트 (업적 추적 정보 추가)
      const newAnswer: UserAnswer = {
        questionId: currentQuestion._id,
        question: currentQuestion.question,
        correctAnswer: currentQuestion.answer || currentQuestion.answers,
        userAnswer,
        isCorrect: correct,
        pointsEarned,
        streakCount: newStreak,
        // 업적 추적용 추가 정보
        answerTime,
        questionIndex: currentQuestionIndex,
      };

      // 디버깅 로그
      log('📝 답변 저장:', {
        questionIndex: currentQuestionIndex,
        answerTime,
        isCorrect: correct,
        userAnswer,
      });

      // 기존 userAnswers 배열 업데이트
      const updatedAnswers = [...quizSetup.setup.userAnswers];
      updatedAnswers[currentQuestionIndex] = newAnswer;
      quizSetup.setUserAnswers(updatedAnswers);

      // 다음 문제를 위한 시간 리셋
      questionStartTime.current = Date.now();

      return { isCorrect: correct, pointsEarned, newStreak };
    },
    [currentStreak, calculatePoints, gamification, quizSetup]
  );

  // 퀴즈 완료 처리 (업적 시스템과 완전 연동)
  const handleQuizCompletion = useCallback(async () => {
    const { questions, userAnswers, category, quizType, questionFormat } =
      quizSetup.setup;

    const correct = userAnswers.filter((a) => a.isCorrect).length;
    const total = questions.length;

    // 기본 정확도 보너스 (기존 로직 유지)
    const accuracy = (correct / total) * 100;
    if (accuracy >= 90) gamification.addPoints(50);

    // 카테고리 키 생성
    const categoryKey = category
      ? `${quizType}-${category}`
      : quizType || 'knowledge';

    // 평균 답변 시간 계산
    const averageTime =
      allAnswerTimes.current.length > 0
        ? allAnswerTimes.current.reduce((sum, time) => sum + time, 0) /
          allAnswerTimes.current.length
        : 0;

    // 총 소요 시간 계산 (밀리초)
    const totalTimeSpent = allAnswerTimes.current.reduce(
      (sum, time) => sum + time * 1000,
      0
    );

    // 역전승 체크 (처음 3문제를 틀렸지만 나머지는 모두 정답)
    const comebackVictory = isComebackVictory(userAnswers);

    // 난이도 결정 로직 (quizSetup에서 가져오거나 기본값 설정)
    const difficulty = quizSetup.setup.difficulty || 'medium'; // 기본값을 'medium'으로 설정

    // 업적 시스템에 퀴즈 완료 기록 (수정된 매개변수)
    const wasPerfect = gamification.recordQuizCompletion(
      categoryKey,
      questionFormat,
      correct,
      total,
      difficulty, // 필수 매개변수 추가
      totalTimeSpent, // 필수 매개변수 추가 (밀리초)
      {
        averageTime,
        comebackVictory,
        maxPerfectStreak: maxStreakInQuiz.current,
        // 향후 확장 가능한 옵션들
        // withFriend: false,
        // relearnedMistakes: false,
      }
    );

    // 스트릭 업데이트
    gamification.updateStreak();

    // 업적 체크
    const newAchievements = await gamification.checkAchievements();

    // 완벽한 정답률 추가 보너스
    if (wasPerfect) {
      gamification.addPoints(20, 'Perfect Score Bonus');
      log('🎯 완벽한 정답률! 보너스 20포인트');
    }

    // 새 업적 로그
    if (newAchievements.length > 0) {
      log(
        '🏆 새로 해금된 업적:',
        newAchievements.map((a) => a.title)
      );
    }

    return {
      wasPerfect,
      newAchievements,
      averageTime,
      comebackVictory,
      maxPerfectStreak: maxStreakInQuiz.current,
      accuracy,
      totalTimeSpent, // 반환값에 총 소요 시간 추가
    };
  }, [quizSetup, gamification]);

  // 포인트 애니메이션 완료 처리
  const handlePointsAnimationComplete = useCallback(() => {
    setShowPointsAnimation(false);
    setEarnedPoints(0);
  }, []);

  // 퀴즈 데이터 리셋 (업적 추적 데이터도 함께 리셋)
  const resetQuizDataWithAchievements = useCallback(() => {
    // 기존 퀴즈 데이터 리셋
    quizSetup.resetQuizData();

    // 게임화 관련 리셋
    gamification.clearNewlyUnlockedAchievements();

    // 업적 추적 데이터 리셋
    setCurrentStreak(0);
    setShowPointsAnimation(false);
    setEarnedPoints(0);
    questionStartTime.current = Date.now();
    allAnswerTimes.current = [];
    correctAnswerStreak.current = 0;
    firstThreeAnswers.current = [];
    maxStreakInQuiz.current = 0;
  }, [quizSetup, gamification]);

  // 퀴즈 시작 시 초기화 (새 함수 추가)
  const initializeQuizTracking = useCallback(() => {
    // 업적 추적 초기화
    questionStartTime.current = Date.now();
    allAnswerTimes.current = [];
    correctAnswerStreak.current = 0;
    firstThreeAnswers.current = [];
    maxStreakInQuiz.current = 0;
    setCurrentStreak(0);
    setShowPointsAnimation(false);
    setEarnedPoints(0);
  }, []);

  return {
    // 기존 퀴즈 셋업 반환
    ...quizSetup,
    // 기존 게임화 상태 반환
    ...gamification,
    // 추가 로컬 상태
    currentStreak,
    showPointsAnimation,
    earnedPoints,

    // 통합 함수들
    handleAnswer,
    handleQuizCompletion,
    handlePointsAnimationComplete,
    calculatePoints,
    resetQuizData: resetQuizDataWithAchievements,
    initializeQuizTracking, // 새로 추가된 초기화 함수

    // 업적 추적 정보 (디버깅/개발용)
    get quizStats() {
      // 실제 답변 데이터에서 시간 정보 추출
      const userAnswers = quizSetup.setup.userAnswers;
      const answerTimes = userAnswers
        .filter((answer) => answer.answerTime !== undefined)
        .map((answer) => answer.answerTime!);

      const totalTimeSpent = answerTimes.reduce((sum, time) => sum + time, 0);
      const averageTime =
        answerTimes.length > 0
          ? answerTimes.reduce((sum, time) => sum + time, 0) /
            answerTimes.length
          : 0;

      // 연속 정답 계산
      let maxStreak = 0;
      let currentStreak = 0;
      userAnswers.forEach((answer) => {
        if (answer.isCorrect) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });

      // 처음 3문제 정답 수 계산
      const firstThreeCorrect = userAnswers
        .slice(0, 3)
        .filter((answer) => answer.isCorrect).length;

      const stats = {
        averageTime,
        maxPerfectStreak: maxStreak,
        firstThreeCorrect,
        totalAnswerTimes: answerTimes.length,
        totalTimeSpent, // seconds 문제 사이에 앱을 나갔다 오거나, 화면을 오래 멈춰두면 그 시간은 포함되지 않습니다.
      };

      // 디버깅 로그
      log('📊 quizStats 계산:', {
        userAnswersLength: userAnswers.length,
        answerTimesLength: answerTimes.length,
        stats,
      });

      return stats;
    },
  };
};
