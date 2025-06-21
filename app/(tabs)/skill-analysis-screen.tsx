import CategoryProgressCard from '@/components/category-progress-card';
import { api } from '@/convex/_generated/api';
import { useAIAnalysis } from '@/hooks/use-ai-analysis';
import { useRefresh } from '@/hooks/use-refresh';
import { getSkillLevelFromWeightedAccuracy } from '@/utils/get-skill-level';
import { switchCategoryKey } from '@/utils/switch-category-key';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function SkillAnalysisScreen() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'detailed' | 'ai'>('detailed');
  const [animatedValue] = useState(new Animated.Value(0));
  const { onRefresh, refreshing } = useRefresh();
  const analysisData = useQuery(
    api.gamification.getOverallAnalysis,
    userId ? { userId } : 'skip'
  );
  const {
    analysis,
    loading: aiLoading,
    setLoading: setAILoading,
    error: aiError,
    refresh: refreshAI,
  } = useAIAnalysis(userId ?? '', analysisData);

  const categoryStats = useQuery(
    api.gamification.getCategoryStatsWithDifficulty,
    userId ? { userId } : 'skip'
  );

  const router = useRouter();

  useEffect(() => {
    if (!aiLoading && analysis.overallAnalysis.length > 0) {
      setAILoading(false);
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [aiLoading, analysis]);

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.loadingCard}
      >
        <Animated.View
          style={[
            styles.loadingContent,
            {
              transform: [
                {
                  rotate: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name='analytics' size={40} color='white' />
        </Animated.View>
        <Text style={styles.loadingText}>분석 중...</Text>
        <Text style={styles.loadingSubtext}>
          AI가 당신의 실력을 분석하고 있어요 🤖
        </Text>
      </LinearGradient>
    </View>
  );

  const renderRequirementMission = () => (
    <View style={styles.requirementsContainer}>
      <Text style={styles.requirementsTitle}>실력 분석 미션 가이드 🧭</Text>
      <View style={styles.requirementsList}>
        <Text style={styles.requirementItem}>
          • <Text style={styles.requirementValue}>기본 분석</Text>: 카테고리 1개
          완성 (난이도별 1세트 × 3)
        </Text>
        <Text style={styles.requirementItem}>
          • <Text style={styles.requirementValue}>AI 분석</Text>: 카테고리 2개
          이상 완성 🌈
        </Text>
      </View>
    </View>
  );

  const renderInsufficientData = () => {
    const metadata = analysisData?.analysisMetadata;
    const dataStatus = metadata?.dataStatus; // 'insufficient' | 'partial' | 'sufficient'

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#ffecd2', '#fcb69f']}
            style={styles.insufficientCard}
          >
            <Ionicons name='trending-up' size={60} color='#ff6b6b' />

            {dataStatus === 'insufficient' && !categoryStats && (
              <>
                <Text style={styles.insufficientTitle}>
                  아직 푼 퀴즈가 없어요 🐣
                </Text>
                <Text style={styles.insufficientText}>
                  관심 있는 카테고리 하나만 먼저 마스터해볼까요? 🎯{'\n'}
                  난이도별 1세트(10문제)씩, 총 3세트(30문제)만 풀면 기본 분석을
                  시작할 수 있어요!
                </Text>

                {renderRequirementMission()}
              </>
            )}

            {dataStatus === 'insufficient' && categoryStats && (
              <>
                <Text style={styles.insufficientTitle}>
                  조금만 더 풀어볼까요? 🏃‍♂️
                </Text>
                <Text style={styles.insufficientText}>
                  한 카테고리에서 쉬움 / 보통 / 어려움 각 1세트(10문제)씩만 풀면
                  기본 실력 분석을 바로 보여드릴게요! 🔍
                </Text>

                {renderRequirementMission()}
              </>
            )}

            {dataStatus !== 'sufficient' && categoryStats && (
              <View style={{ marginTop: 20 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}
                >
                  📊 카테고리별 퀴즈 진행 현황
                </Text>
                {Object.entries(categoryStats).map(([category, stats]) => (
                  <CategoryProgressCard
                    key={category}
                    categoryLabel={switchCategoryKey(category)}
                    difficultyStats={stats.difficultyStats}
                  />
                ))}
              </View>
            )}

            {/* CTA */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Text style={styles.ctaButtonText}>도전하러 가기 🚀</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    );
  };
  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'detailed', label: '상세', icon: 'bar-chart' },
        { key: 'ai', label: 'AI 인사이트', icon: 'bulb' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
          onPress={() => setSelectedTab(tab.key as any)}
        >
          <Ionicons
            name={tab.icon as any}
            size={18}
            color={selectedTab === tab.key ? 'white' : '#666'}
          />
          <Text
            style={[
              styles.tabText,
              selectedTab === tab.key && styles.activeTabText,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDetailedTab = () => (
    <View style={styles.detailedContainer}>
      {analysisData?.overallAnalysis.map((a, index) => (
        <View key={index} style={styles.detailCard}>
          {/* 헤더 - 그라데이션 배경 */}
          <View style={styles.detailHeader}>
            <View style={styles.titleSection}>
              <Text style={styles.detailTitle}>
                {switchCategoryKey(a.category)}
              </Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>{a.skillScore}%</Text>
              </View>
            </View>
          </View>

          {/* 난이도 분석 - 카드형 */}
          <View style={styles.difficultySection}>
            <View style={styles.sectionHeader}>
              <Ionicons name='bar-chart' size={20} color='#000' />
              <Text style={styles.sectionTitle}>난이도별 정답률</Text>
            </View>
            <View style={styles.difficultyCards}>
              {(['easy', 'medium', 'hard'] as const).map((level) => {
                const label =
                  level === 'easy'
                    ? '쉬움'
                    : level === 'medium'
                      ? '보통'
                      : '어려움';

                const stats = a.difficultyAnalysis?.[level];
                const hasAttempted = stats && stats.totalQuestions > 0;
                const displayText = hasAttempted
                  ? `${stats.accuracy}%`
                  : '미응시';

                const iconName =
                  level === 'easy'
                    ? 'happy'
                    : level === 'medium'
                      ? 'help-circle'
                      : 'flame';
                const iconColor =
                  level === 'easy'
                    ? '#22c55e'
                    : level === 'medium'
                      ? '#fbbf24'
                      : '#ef4444';

                return (
                  <View
                    key={level}
                    style={[
                      styles.difficultyCard,
                      level === 'easy' && styles.easyCard,
                      level === 'medium' && styles.mediumCard,
                      level === 'hard' && styles.hardCard,
                    ]}
                  >
                    <Ionicons name={iconName} size={24} color={iconColor} />
                    <Text style={styles.difficultyLabel}>{label}</Text>
                    <Text
                      style={[
                        styles.difficultyPercent,
                        !hasAttempted && { color: '#9ca3af' },
                      ]}
                    >
                      {displayText}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 통계 정보 - 모던한 아이콘 */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Ionicons name='fitness' size={20} color='#2563eb' />
              <Text style={styles.statText}>총 {a.totalQuestions}문제</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name='flash' size={20} color='#f59e0b' />
              <Text style={styles.statText}>
                평균 {Math.round(a.averageTime / 1000)}초
              </Text>
            </View>
          </View>

          {/* 성장 트렌드 - 눈에 띄는 디자인 */}
          <View
            style={[
              styles.trendSection,
              a.growthTrend > 0 && styles.positiveGrowth,
              a.growthTrend < 0 && styles.negativeGrowth,
            ]}
          >
            <View style={styles.trendHeader}>
              <Ionicons
                name={
                  a.growthTrend > 0
                    ? 'trending-up'
                    : a.growthTrend < 0
                      ? 'trending-down'
                      : 'remove'
                }
                size={20}
                color='#1a1a1a'
              />
              <Text style={styles.trendText}>
                {a.growthTrend > 0
                  ? `성장률: +${a.growthTrend}점 🚀`
                  : a.growthTrend < 0
                    ? `성장률: ${a.growthTrend}점 📉`
                    : `성장률: 점수 유지 🔄`}
              </Text>
            </View>
          </View>

          {/* 스킬 레벨 - 게이미피케이션 */}
          <View style={styles.skillSection}>
            <View style={styles.skillHeader}>
              <Ionicons name='trophy' size={20} color='#f59e0b' />
              <Text style={styles.skillTitle}>현재 티어</Text>
            </View>
            <View
              style={[
                styles.skillBadge,
                getSkillLevelFromWeightedAccuracy(
                  a.difficultyAnalysis
                ).includes('등급 미부여') && styles.unrankedBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '⚫ 아이언' && styles.ironBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '🥉 브론즈' && styles.bronzeBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '🥈 실버' && styles.silverBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '🥇 골드' && styles.goldBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '💜 플래티넘' && styles.platinumBadge,
                getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                  '💎 다이아몬드' && styles.diamondBadge,
              ]}
            >
              <Text
                style={[
                  styles.skillText,
                  getSkillLevelFromWeightedAccuracy(
                    a.difficultyAnalysis
                  ).includes('등급 미부여') && styles.unrankedText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '⚫ 아이언' && styles.ironText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '🥉 브론즈' && styles.bronzeText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '🥈 실버' && styles.silverText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '🥇 골드' && styles.goldText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '💜 플래티넘' && styles.platinumText,
                  getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis) ===
                    '💎 다이아몬드' && styles.diamondText,
                ]}
              >
                {getSkillLevelFromWeightedAccuracy(
                  a.difficultyAnalysis
                ).includes('등급 미부여')
                  ? '등급 미부여'
                  : getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis)}
              </Text>
              {getSkillLevelFromWeightedAccuracy(a.difficultyAnalysis).includes(
                '등급 미부여'
              ) && (
                <Text style={styles.unrankedSubtext}>
                  더 많은 문제를 풀어보세요! 💪
                </Text>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderAITab = () => {
    refreshAI();

    if (aiLoading) {
      return renderLoadingState();
    }

    return (
      <View style={styles.tabContent}>
        {analysis.aiInsights ? (
          <>
            {/* AI 종합 평가 */}
            <BlurView intensity={20} tint='light' style={styles.aiCard}>
              <LinearGradient
                colors={['rgba(102, 126, 234, 0.8)', 'rgba(118, 75, 162, 0.8)']}
                style={styles.aiGradient}
              >
                <View style={styles.aiHeader}>
                  <Ionicons name='sparkles' size={24} color='white' />
                  <Text style={styles.aiTitle}>AI 종합 분석</Text>
                </View>
                <Text style={styles.aiInsight}>
                  {analysis.aiInsights.overallInsight}
                </Text>
              </LinearGradient>
            </BlurView>

            {/* 동기부여 메시지 */}
            <LinearGradient
              colors={['#ff9a9e', '#fecfef']}
              style={styles.motivationCard}
            >
              <Ionicons name='heart' size={24} color='white' />
              <Text style={styles.motivationText}>
                {analysis.aiInsights.motivationalMessage}
              </Text>
            </LinearGradient>

            {/* 다음 목표 */}
            <View style={styles.goalsContainer}>
              <Text style={styles.goalsTitle}>🎯 다음 목표</Text>
              {analysis.aiInsights.nextGoals.map((goal, index) => (
                <View key={index} style={styles.goalItem}>
                  <Ionicons name='checkbox-outline' size={20} color='#667eea' />
                  <Text style={styles.goalText}>{goal}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.noAIContainer}>
            <Ionicons name='sparkles' size={50} color='#34A853' />
            <Text style={styles.insufficientTitle}>
              AI 분석까지는 한 걸음 남았어요 🤖
            </Text>
            <Text style={styles.insufficientText}>
              기본 분석은 완료했어요! 이제 다른 카테고리도 하나만 더 마스터하면
              AI가 당신의 강점과 성장 방향까지 분석해드려요 🌟
            </Text>
            {renderRequirementMission()}
          </View>
        )}
        {aiError && (
          <>
            <View style={styles.errorBanner}>
              <Ionicons name='warning' size={20} color='#fff' />
              <Text style={styles.errorText}>{aiError}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => refreshAI(true)}
            >
              <Ionicons name='refresh' size={18} color='#667eea' />
              <Text style={styles.refreshButtonText}>AI 재분석 시도</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  if (analysisData?.analysisMetadata.dataStatus === 'insufficient') {
    return renderInsufficientData();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 헤더 */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <Text style={styles.headerTitle}>실력 분석</Text>
        <Text style={styles.headerSubtitle}>당신의 퀴즈 실력을 한눈에</Text>
      </LinearGradient>

      {renderTabSelector()}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: animatedValue,
              transform: [
                {
                  translateY: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {selectedTab === 'detailed' && renderDetailedTab()}
          {selectedTab === 'ai' && renderAITab()}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingCard: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    margin: 20,
  },
  loadingContent: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  difficultyProgressContainer: {
    marginTop: 16,
    marginBottom: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff5f0',
  },

  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },

  difficultyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  complete: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },

  incomplete: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '600',
  },

  insufficientCard: {
    margin: 20,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
  },
  insufficientTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3436',
    marginTop: 16,
    marginBottom: 8,
  },
  insufficientText: {
    fontSize: 16,
    color: '#636e72',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#636e72',
    marginTop: 8,
  },
  requirementsContainer: {
    marginTop: 24,
    width: '100%',
  },
  requirementsTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#2d3436',
  },
  requirementsList: {
    paddingLeft: 8,
  },
  requirementItem: {
    fontSize: 14,
    marginBottom: 4,
    color: '#636e72',
  },
  requirementValue: {
    fontWeight: 'bold',
    color: '#2d3436',
  },
  ctaButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  ctaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#667eea',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  tabContent: {
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  categoryCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  categoryGradient: {
    padding: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  categoryScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  difficultyItem: {
    flex: 1,
    alignItems: 'center',
  },

  difficultyScore: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  difficultyBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginVertical: 4,
  },
  difficultyBarFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  weaknessContainer: {
    marginTop: 12,
  },
  weaknessTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  weaknessText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  improveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  improveButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  strengthsContainer: {
    marginTop: 12,
  },
  strengthsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  strengthText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  detailedCategoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  detailedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailedCategoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3436',
  },
  scoreTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  detailedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailedStatText: {
    fontSize: 12,
    color: '#636e72',
    marginLeft: 4,
  },
  recommendedText: {
    fontSize: 14,
    color: '#636e72',
  },
  recommendedValue: {
    fontWeight: 'bold',
    color: '#2d3436',
  },
  aiCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  aiGradient: {
    padding: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  aiInsight: {
    fontSize: 16,
    color: 'white',
    lineHeight: 24,
  },
  recommendationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  recommendationCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  recommendationText: {
    fontSize: 14,
    color: '#636e72',
    lineHeight: 20,
  },
  strategyCard: {
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 8,
  },
  strategyText: {
    fontSize: 14,
    color: '#636e72',
    lineHeight: 20,
  },
  motivationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  motivationText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  goalsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  goalsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3436',
    marginBottom: 12,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  goalText: {
    fontSize: 14,
    color: '#636e72',
    marginLeft: 12,
    flex: 1,
  },
  noAIContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 20,
  },
  noAIText: {
    fontSize: 16,
    color: '#636e72',
    textAlign: 'center',
    marginTop: 16,
  },
  detailedContainer: {
    padding: 20,
    gap: 20,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // 그라데이션 배경
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    position: 'relative',
    overflow: 'hidden',
  },
  detailHeader: {
    marginBottom: 20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  scoreBadge: {
    backgroundColor: '#06b6d4',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#0891b2',
  },
  scoreBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  difficultySection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3748',
  },
  difficultyCards: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  easyCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22c55e',
  },
  mediumCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: '#fbbf24',
  },
  hardCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
  },
  difficultyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  difficultyPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  trendSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  positiveGrowth: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  negativeGrowth: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  skillSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  skillTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  skillBadge: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  skillText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8b5cf6',
    textAlign: 'center',
  },
  // 티어별 배지 스타일
  unrankedBadge: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  unrankedText: {
    color: '#6b7280',
    fontSize: 14,
  },
  unrankedSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  ironBadge: {
    backgroundColor: '#f3f4f6',
    borderColor: '#4b5563',
    borderWidth: 2,
  },
  ironText: {
    color: '#374151',
  },
  bronzeBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
    borderWidth: 3,
  },
  bronzeText: {
    color: '#92400e',
  },
  silverBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#64748b',
    borderWidth: 3,
  },
  silverText: {
    color: '#334155',
  },
  goldBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 3,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  goldText: {
    color: '#d97706',
  },
  platinumBadge: {
    backgroundColor: '#f3e8ff',
    borderColor: '#7c3aed',
    borderWidth: 3,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  platinumText: {
    color: '#5b21b6',
  },
  diamondBadge: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0284c7',
    borderWidth: 4,
    shadowColor: '#0284c7',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    transform: [{ scale: 1.05 }],
  },
  diamondText: {
    fontSize: 18,
    color: '#0369a1',
  },
  errorBanner: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  errorText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#eef1ff',
    borderRadius: 6,
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#667eea',
    marginLeft: 6,
    fontWeight: '500',
  },
});
