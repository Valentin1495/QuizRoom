import DifficultyAnalysisCard from '@/components/difficulty-analysis-card';
import OverallAnalysisCard from '@/components/overall-analysis-card';
import QuizRecommendationCard from '@/components/quiz-recommendation-card';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type UpdatedKnowledgeCategory =
  | 'history-culture'
  | 'science-tech'
  | 'kpop-music'
  | 'arts-literature'
  | 'sports'
  | 'entertainment'
  | 'general'
  | 'math-logic'
  | 'knowledge-history-culture'
  | 'knowledge-science-tech'
  | 'knowledge-kpop-music'
  | 'knowledge-arts-literature'
  | 'knowledge-sports'
  | 'knowledge-entertainment'
  | 'knowledge-general'
  | 'knowledge-math-logic';

export default function AnalysisScreen() {
  const { userId } = useAuth();
  const { onRefresh, refreshing } = useRefresh();
  const categoryStatsData = useQuery(
    api.gamification.getCategoryStatsWithDifficulty,
    userId ? { userId } : 'skip'
  );
  const overallAnalysisData = useQuery(
    api.gamification.getOverallAnalysis,
    userId
      ? {
          userId,
        }
      : 'skip'
  );

  const recommendationsData = useQuery(
    api.gamification.getPersonalizedQuizRecommendation,
    userId
      ? {
          userId,
        }
      : 'skip'
  );

  // 로딩 상태
  if (
    categoryStatsData === undefined ||
    overallAnalysisData === undefined ||
    recommendationsData === undefined
  ) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color='#667eea' />
          <Text style={styles.loadingText}>
            실력 분석 데이터를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 데이터가 없는 경우
  if (!categoryStatsData || Object.keys(categoryStatsData).length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name='bar-chart-outline' size={80} color='#ccc' />
          <Text style={styles.emptyTitle}>아직 퀴즈 기록이 없습니다</Text>
          <Text style={styles.emptySubtitle}>
            퀴즈를 풀고 실력을 분석해 보세요!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>실력 분석</Text>
        <Text style={styles.headerSubtitle}>분야별 성취도를 확인하세요</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 종합 분석 카드 */}
        {overallAnalysisData &&
          overallAnalysisData.strongestCategories.length > 0 && (
            <OverallAnalysisCard analysis={overallAnalysisData} />
          )}

        {/* 퀴즈 추천 카드 */}
        {recommendationsData && recommendationsData.length > 0 && (
          <QuizRecommendationCard recommendations={recommendationsData} />
        )}

        {/* 카테고리별 상세 분석 */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>카테고리별 상세 분석</Text>
          {Object.entries(categoryStatsData).map(([category, stats]) => (
            <DifficultyAnalysisCard
              key={category}
              category={category as UpdatedKnowledgeCategory}
              stats={stats as Doc<'categoryStats'>}
            />
          ))}
        </View>

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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 30,
  },
});
