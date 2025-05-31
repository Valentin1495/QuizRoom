import { useMutation } from 'convex/react';
import { Alert } from 'react-native';
import { api } from '../convex/_generated/api';

export const useChallenges = (userId?: string | null) => {
  if (!userId) return;

  const updateProgress = useMutation(api.challenges.updateChallengeProgress);

  const onQuizCompleted = async (perfectScore: boolean) => {
    try {
      const updatedChallenges = await updateProgress({
        userId,
        quizCompleted: true,
        perfectScore,
      });

      // 완료된 도전과제가 있으면 알림 표시
      const completedChallenges = updatedChallenges?.filter(
        (c) => c.completed && c.currentCount === c.targetCount
      );
      if (completedChallenges && completedChallenges.length > 0) {
        const titles = completedChallenges.map((c) => c.title).join(', ');
        Alert.alert('🎉 도전과제 완료!', `${titles} 도전과제를 완료했습니다!`, [
          { text: '확인', style: 'default' },
        ]);
      }
    } catch (error) {
      console.error('도전과제 업데이트 실패:', error);
    }
  };

  return { onQuizCompleted };
};
