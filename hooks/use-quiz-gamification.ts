import { useGamification } from '@/context/gamification-context';
import { QuestionFormat, useQuizSetup, UserAnswer } from '@/context/quiz-setup-context';
import { log } from '@/utils/log';
import { useCallback, useRef, useState } from 'react';

export const useQuizGamification = () => {
  const quizSetup = useQuizSetup();
  const gamification = useGamification();

  // 로컬 게임화 상태
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [showPointsAnimation, setShowPointsAnimation] = useState<boolean>(false);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);

  // 업적 추적을 위한 ref들
  const questionStartTime = useRef<number>(Date.now());
  const allAnswerTimes = useRef<number[]>([]);
  const correctAnswerStreak = useRef<number>(0);
  const firstThreeAnswers = useRef<boolean[]>([]);
  const maxStreakInQuiz = useRef<number>(0);

  const isComebackVictory = (userAnswers: UserAnswer[]): boolean => {
    const firstThreeWrong = userAnswers.slice(0, 3).every((a) => a.isCorrect === false);
    const restAnswers = userAnswers.slice(3);
    const restAllCorrect = restAnswers.every((a) => a.isCorrect === true);
    return firstThreeWrong && restAllCorrect;
  };

  const calculatePoints = useCallback(
    (
      isCorrect: boolean,
      question: any,
      streakCount: number
    ): number => {
      if (!isCorrect) return 0;

      let points = 0;

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
          points = 10;
          break;
      }

      switch (question.category) {
        case 'math-logic':
          points += 8;
          break;
        case 'science-tech':
          points += 6;
          break;
        case 'history-culture':
        case 'arts-literature':
          points += 4;
          break;
        case 'kpop-music':
        case 'entertainment':
        case 'movies':
        case 'drama-variety':
          points += 2;
          break;
        case 'sports':
          points += 1;
          break;
        case 'general':
        default:
          break;
      }

      if (question.questionFormat === 'short') {
        points += 3;
      }

      if (streakCount >= 3) {
        const streakBonus = Math.floor(streakCount / 3) * 3;
        points += Math.max(0, Math.min(streakBonus, 15));
      }

      if (
        question.difficulty === 'hard' &&
        question.category &&
        ['math-logic', 'science-tech'].includes(question.category)
      ) {
        points += 5;
      }

      return points;
    },
    []
  );

  const handleAnswer = useCallback(
    (
      currentQuestion: any,
      currentQuestionIndex: number,
      userAnswer: string,
      questionFormat: QuestionFormat
    ): { isCorrect: boolean; pointsEarned: number; newStreak: number } => {
      const endTime = Date.now();
      const answerTime = (endTime - questionStartTime.current) / 1000;
      allAnswerTimes.current.push(answerTime);

      let correct = false;

      if (questionFormat === 'true_false') {
        const normalizeBool = (val: any): boolean | null => {
          const s = String(val ?? '').trim().toLowerCase();
          if (['o', 'true', 't', '1', '예', '맞다', '맞아요', 'yes'].includes(s)) return true;
          if (['x', 'false', 'f', '0', '아니오', '아니다', 'no'].includes(s)) return false;
          return null;
        };
        const expected = normalizeBool((currentQuestion as any).answer);
        const given = normalizeBool(userAnswer);
        correct = expected !== null && given !== null && expected === given;
      } else if (questionFormat === 'multiple' || questionFormat === 'filmography') {
        correct = userAnswer === (currentQuestion as any).answer;
      } else {
        const answers = ((currentQuestion as any).answers || []) as string[];
        correct = answers.map((a) => a.toLowerCase()).includes(userAnswer.toLowerCase());
      }

      if (correct) {
        correctAnswerStreak.current++;
        maxStreakInQuiz.current = Math.max(maxStreakInQuiz.current, correctAnswerStreak.current);
      } else {
        correctAnswerStreak.current = 0;
      }

      let newStreak: number;
      if (correct) {
        newStreak = currentStreak + 1;
        setCurrentStreak(newStreak);
      } else {
        newStreak = 0;
        setCurrentStreak(0);
      }

      const pointsEarned = calculatePoints(correct, currentQuestion, newStreak);

      if (pointsEarned > 0) {
        setEarnedPoints(pointsEarned);
        setShowPointsAnimation(true);
        gamification.addPoints(pointsEarned, `Question ${currentQuestionIndex + 1}`);
      }

      const newAnswer: UserAnswer = {
        questionId: currentQuestion._id,
        question: currentQuestion.question,
        correctAnswer: currentQuestion.answer || currentQuestion.answers,
        userAnswer,
        isCorrect: correct,
        pointsEarned,
        streakCount: newStreak,
        answerTime,
        questionIndex: currentQuestionIndex,
      };

      log('📝 답변 저장:', {
        questionIndex: currentQuestionIndex,
        answerTime,
        isCorrect: correct,
        userAnswer,
      });

      const updatedAnswers = [...quizSetup.setup.userAnswers];
      updatedAnswers[currentQuestionIndex] = newAnswer;
      quizSetup.setUserAnswers(updatedAnswers);

      questionStartTime.current = Date.now();

      return { isCorrect: correct, pointsEarned, newStreak };
    },
    [currentStreak, calculatePoints, gamification, quizSetup]
  );

  const handleQuizCompletion = useCallback(async () => {
    const { questions, userAnswers, topCategory, subcategory, questionFormat } =
      quizSetup.setup as any;

    const correct = userAnswers.filter((a: UserAnswer) => a.isCorrect).length;
    const total = questions.length;

    const accuracy = (correct / total) * 100;
    if (accuracy >= 90) gamification.addPoints(50);

    const averageTime =
      allAnswerTimes.current.length > 0
        ? allAnswerTimes.current.reduce((sum, time) => sum + time, 0) /
          allAnswerTimes.current.length
        : 0;

    const totalTimeSpent = allAnswerTimes.current.reduce(
      (sum, time) => sum + time * 1000,
      0
    );

    const comebackVictory = isComebackVictory(userAnswers);

    const difficulty = (quizSetup.setup.difficulty || 'medium') as any;

    const wasPerfect = gamification.recordQuizCompletion(
      (subcategory || topCategory) || 'general',
      (questionFormat === 'true_false' || questionFormat === 'filmography') ? 'multiple' : (questionFormat as any),
      correct,
      total,
      difficulty,
      totalTimeSpent,
      {
        averageTime,
        comebackVictory,
        maxPerfectStreak: maxStreakInQuiz.current,
      }
    );

    gamification.updateStreak();

    const newAchievements = await gamification.checkAchievements();

    if (wasPerfect) {
      gamification.addPoints(20, 'Perfect Score Bonus');
      log('🎯 완벽한 정답률! 보너스 20포인트');
    }

    return {
      wasPerfect,
      newAchievements,
      averageTime,
      comebackVictory,
      maxPerfectStreak: maxStreakInQuiz.current,
      accuracy,
      totalTimeSpent,
    };
  }, [quizSetup, gamification]);

  const handlePointsAnimationComplete = useCallback(() => {
    setShowPointsAnimation(false);
    setEarnedPoints(0);
  }, []);

  const resetQuizDataWithAchievements = useCallback(() => {
    quizSetup.resetQuizData();
    gamification.clearNewlyUnlockedAchievements();
    setCurrentStreak(0);
    setShowPointsAnimation(false);
    setEarnedPoints(0);
    questionStartTime.current = Date.now();
    allAnswerTimes.current = [];
    correctAnswerStreak.current = 0;
    firstThreeAnswers.current = [];
    maxStreakInQuiz.current = 0;
  }, [quizSetup, gamification]);

  const initializeQuizTracking = useCallback(() => {
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
    ...quizSetup,
    ...gamification,
    currentStreak,
    showPointsAnimation,
    earnedPoints,
    handleAnswer,
    handleQuizCompletion,
    handlePointsAnimationComplete,
    calculatePoints,
    resetQuizData: resetQuizDataWithAchievements,
    initializeQuizTracking,
    get quizStats() {
      const userAnswers = quizSetup.setup.userAnswers;
      const answerTimes = userAnswers
        .filter((answer) => answer.answerTime !== undefined)
        .map((answer) => answer.answerTime!);

      const totalTimeSpent = answerTimes.reduce((sum, time) => sum + time, 0);
      const averageTime =
        answerTimes.length > 0
          ? answerTimes.reduce((sum, time) => sum + time, 0) / answerTimes.length
          : 0;

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

      const firstThreeCorrect = userAnswers
        .slice(0, 3)
        .filter((answer) => answer.isCorrect).length;

      const stats = {
        averageTime,
        maxPerfectStreak: maxStreak,
        firstThreeCorrect,
        totalAnswerTimes: answerTimes.length,
        totalTimeSpent,
      };

      log('📊 quizStats 계산:', {
        userAnswersLength: userAnswers.length,
        answerTimesLength: answerTimes.length,
        stats,
      });

      return stats;
    },
  };
};
