import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { StyleSheet, View } from 'react-native';
import EmptyStatsCard from './empty-stat-card';
import LevelProgress from './level-progress';
import StatCard from './stat-card';

type CardListProps = { userId?: string | null; unlockedCount?: number };

export default function StatCardList({ userId, unlockedCount }: CardListProps) {
  const gamificationData = useQuery(
    api.gamification.getGamificationData,
    userId ? { userId } : 'skip'
  );

  if (!gamificationData) {
    return null;
  }

  const {
    level,
    expInCurrentLevel,
    pointsToNextLevel,
    currentStreak,
    longestStreak,
    totalQuizzes,
    totalCorrectAnswers,
    totalPoints,
  } = gamificationData;
  const overallAccuracy =
    totalQuizzes === 0
      ? '-'
      : Math.round(
          (gamificationData.totalCorrectAnswers /
            (gamificationData.totalQuizzes * 10)) *
            100
        );
  const hasQuizData = gamificationData.totalQuizzes > 0;

  return (
    <View>
      {/* Level Progress */}
      <LevelProgress
        currentLevel={level}
        currentExp={expInCurrentLevel}
        nextLevelExp={pointsToNextLevel}
        delay={100}
        unlockedCount={unlockedCount}
      />

      {/* Stats Cards */}
      {hasQuizData ? (
        <View style={styles.statsGrid}>
          <StatCard
            title='총 퀴즈'
            value={totalQuizzes.toString()}
            subtitle='완료'
            icon='library-outline'
            color={['#667eea', '#764ba2']}
            delay={200}
          />
          <StatCard
            title='정답률'
            value={`${overallAccuracy}%`}
            subtitle={`${totalCorrectAnswers}/${totalQuizzes * 10}`}
            icon='checkmark-circle-outline'
            color={['#f093fb', '#f5576c']}
            delay={300}
          />
          <StatCard
            title='현재 스트릭'
            value={`${currentStreak}일`}
            subtitle='연속 학습'
            icon='flame-outline'
            color={['#4facfe', '#00f2fe']}
            delay={400}
          />
          <StatCard
            title='최장 스트릭'
            value={`${longestStreak}일`}
            subtitle='개인 기록'
            icon='trending-up-outline'
            color={['#43e97b', '#38f9d7']}
            delay={500}
          />
          <StatCard
            title='총 포인트'
            value={totalPoints.toLocaleString()}
            subtitle='포인트'
            icon='star-outline'
            color={['#fa709a', '#fee140']}
            delay={600}
          />
          <StatCard
            title='레벨'
            value={level.toString()}
            subtitle='현재 단계'
            icon='diamond-outline'
            color={['#a8edea', '#fed6e3']}
            delay={700}
          />
        </View>
      ) : (
        <View style={styles.emptyStatsContainer}>
          <EmptyStatsCard delay={200} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginBottom: 30,
  },
});
