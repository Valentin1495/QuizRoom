import { logError } from '@/utils/log-error';
import { useMutation } from 'convex/react';
import { Alert } from 'react-native';
import { api } from '../convex/_generated/api';

export const useChallenges = (userId?: string | null) => {
  if (!userId) return;

  const updateProgress = useMutation(api.challenges.updateChallengeProgress);

  const onQuizCompleted = async (
    category?: string,
    answerTime?: number, // 초 단위
    maxPerfectStreak?: number,
  ) => {
    try {
      const updatedChallenges = await updateProgress({
        userId,
        quizCompleted: true,
        category,
        answerTime, // 초 단위
        maxPerfectStreak,
      });

      // 완료된 도전과제가 있으면 알림 표시
      const completedChallenges = updatedChallenges?.filter(
        (c) => c.completed && c.currentCount === c.targetCount,
      );
      if (completedChallenges && completedChallenges.length > 0) {
        const titles = completedChallenges.map((c) => c.title).join(', ');
        Alert.alert('🎉 도전과제 완료!', `${titles} 도전과제를 완료했습니다!`, [
          { text: '확인', style: 'default' },
        ]);
      }
    } catch (error) {
      logError('도전과제 업데이트 실패:', error);
    }
  };

  // 개별 문제 완료 시 호출하는 함수 (더 세밀한 추적용)
  const onQuestionAnswered = async (
    isCorrect: boolean,
    category: string,
    answerTime: number, // 초 단위
    maxPerfectStreak: number,
  ) => {
    try {
      await updateProgress({
        userId,
        quizCompleted: false, // 개별 문제는 퀴즈 완료가 아님
        category,
        answerTime,
        maxPerfectStreak,
      });
    } catch (error) {
      logError('문제 완료 업데이트 실패:', error);
    }
  };

  return { onQuizCompleted, onQuestionAnswered };
};
