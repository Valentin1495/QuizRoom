import EmptyStatsCard from '@/components/empty-stat-card';
import LevelProgress from '@/components/level-progress';
import StatCard from '@/components/stat-card';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatsScreen() {
  const { userId } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const gamificationData = useQuery(
    api.gamification.getOrCreateGamificationData,
    userId ? { userId } : 'skip'
  );

  // 화면이 포커스될 때마다 데이터 새로고침
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        setRefreshTrigger((prev) => prev + 1);
      }
    }, [userId])
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>통계</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Level Progress */}
        <LevelProgress
          currentLevel={level}
          currentExp={expInCurrentLevel}
          nextLevelExp={pointsToNextLevel}
          delay={100}
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
              icon='trophy-outline'
              color={['#43e97b', '#38f9d7']}
              delay={500}
            />
            <StatCard
              title='총 포인트'
              value={totalPoints.toLocaleString()}
              subtitle='xp'
              icon='diamond-outline'
              color={['#fa709a', '#fee140']}
              delay={600}
            />
            <StatCard
              title='레벨'
              value={level.toString()}
              subtitle='현재 단계'
              icon='star-outline'
              color={['#a8edea', '#fed6e3']}
              delay={700}
            />
          </View>
        ) : (
          <View style={styles.emptyStatsContainer}>
            <EmptyStatsCard delay={200} />
          </View>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginBottom: 30,
  },
  masteryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 35,
  },
  bottomPadding: {
    height: 20,
  },
  // Empty state styles
  emptyStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
});
