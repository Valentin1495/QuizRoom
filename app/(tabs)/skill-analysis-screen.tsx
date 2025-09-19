import CategoryProgressCard from '@/components/category-progress-card';
import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { useAIAnalysis } from '@/hooks/use-ai-analysis';
import { useRefresh } from '@/hooks/use-refresh';
import { getSkillLevelFromWeightedAccuracy } from '@/utils/get-skill-level-from-weighted-accuracy';
import { isEmptyObject } from '@/utils/is-empty-object';
import { switchCategoryKey } from '@/utils/switch-category-key';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
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
  const userId = getAuth().currentUser?.uid;
  const gradientColors = Colors.light.gradientColors;
  const [selectedTab, setSelectedTab] = useState<'detailed' | 'ai'>('detailed');
  const [animatedValue] = useState(new Animated.Value(0));
  const [tierGuideExpanded, setTierGuideExpanded] = useState(false);
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

  // 약점 추천 계산 - 훅 규칙을 지키기 위해 최상위에서 실행
  type WeaknessPick = {
    categoryKey: string;
    rawCategory: string;
    label: string;
    difficulty: 'easy' | 'medium' | 'hard';
    accuracy: number;
  } | null;

  const weakness = useMemo<WeaknessPick>(() => {
    const oa = analysis.overallAnalysis as any[];
    if (!oa || oa.length === 0) return null;

    let best: WeaknessPick = null;

    for (const a of oa) {
      const categoryKey: string = a.category;
      const rawCategory = categoryKey.replace(/^knowledge-/, '');
      const label = switchCategoryKey(categoryKey);
      const fallback = {
        easy: { totalQuestions: 0, accuracy: 0 },
        medium: { totalQuestions: 0, accuracy: 0 },
        hard: { totalQuestions: 0, accuracy: 0 },
      };
      const diff: {
        easy: { totalQuestions: number; accuracy: number };
        medium: { totalQuestions: number; accuracy: number };
        hard: { totalQuestions: number; accuracy: number };
      } = (a?.difficultyAnalysis as any) ?? fallback;
      (['easy', 'medium', 'hard'] as const).forEach((level) => {
        const stats = diff[level];
        const attempted = stats && stats.totalQuestions > 0;
        const acc = attempted ? stats.accuracy : 101;
        if (best === null || acc < ((best as any)?.accuracy ?? 999)) {
          best = {
            categoryKey,
            rawCategory,
            label,
            difficulty: level,
            accuracy: acc,
          };
        }
      });
    }

    if (best === null) return null;
    if ((best as any).accuracy === 101) {
      const sorted = [...(oa || [])].sort(
        (x, y) => (x.weightedAccuracy ?? 999) - (y.weightedAccuracy ?? 999)
      );
      const pick = sorted[0];
      if (!pick) return null;
      const rawCategory = String(pick.category).replace(/^knowledge-/, '');
      const pickWeak: WeaknessPick = {
        categoryKey: pick.category,
        rawCategory,
        label: switchCategoryKey(pick.category),
        difficulty: 'medium' as const,
        accuracy: pick.weightedAccuracy ?? 0,
      };
      return pickWeak;
    }
    return best;
  }, [analysis.overallAnalysis]);

  const handleStartWeaknessPractice = () => {
    if (!weakness) return;
    const params = new URLSearchParams({
      quizType: 'knowledge',
      category: weakness.rawCategory,
      difficulty: weakness.difficulty,
      questionFormat: 'multiple',
    } as any);
    router.push(`/quiz?${params.toString()}`);
  };

  // 분석 완료 체크
  useEffect(() => {
    if (!aiLoading && analysis.overallAnalysis.length > 0) {
      // 완료 애니메이션
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    }
  }, [aiLoading, analysis.overallAnalysis.length]);

  // 로딩 애니메이션 설정
  useEffect(() => {
    if (aiLoading) {
      // 기존 애니메이션 정지
      animatedValue.stopAnimation();
      animatedValue.setValue(0);

      const animateLoading = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      animateLoading();
    }
  }, [aiLoading]);

  // AI 탭이 처음 선택될 때만 refreshAI 호출
  useEffect(() => {
    if (selectedTab === 'ai' && !aiLoading) {
      refreshAI();
    }
  }, [selectedTab]);

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      {/* 안드로이드용 외부 배경 효과 */}
      {Platform.OS === 'android' && (
        <View style={styles.androidShadowContainer}>
          <View style={styles.androidShadowLayer1} />
          <View style={styles.androidShadowLayer2} />
        </View>
      )}

      <LinearGradient
        colors={['#1e3a8a', '#1e40af', '#3b82f6']} // 다크 네이비 → 블루 그라디언트
        style={[
          styles.loadingCard,
          Platform.OS === 'android' && styles.androidLoadingCard,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* 배경 장식 요소들 */}
        <View style={styles.loadingBackgroundDecorations}>
          <View style={[styles.floatingDot, styles.dot1]} />
          <View style={[styles.floatingDot, styles.dot2]} />
          <View style={[styles.floatingDot, styles.dot3]} />
          <View style={[styles.floatingDot, styles.dot4]} />
        </View>

        {/* 메인 로딩 아이콘 */}
        <Animated.View
          style={[
            styles.loadingIconContainer,
            {
              transform: [
                {
                  rotate: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
                {
                  scale: animatedValue.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.8, 1.2, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.iconBackground}>
            <Ionicons name='analytics' size={56} color='#ffffff' />
          </View>
          <View style={styles.iconRing} />
        </Animated.View>

        {/* 로딩 텍스트 */}
        <Animated.View
          style={[
            styles.loadingTextContainer,
            {
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0, 0.5, 1],
              }),
              transform: [
                {
                  translateY: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.loadingTitle}>실력 분석 중...</Text>
          <Text style={styles.loadingSubtitle}>
            AI가 당신의 퀴즈 실력을 분석 중이에요!{'\n'}💭🧠✨
          </Text>

          {/* 진행률 표시 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    transform: [
                      {
                        scaleX: animatedValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>데이터 처리 중...</Text>
          </View>
        </Animated.View>

        {/* 하단 힌트 */}
        <Animated.View
          style={[
            styles.loadingHint,
            {
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [0, 0, 1],
              }),
            },
          ]}
        >
          <Ionicons
            name='bulb-outline'
            size={20}
            color='rgba(255, 255, 255, 0.8)'
          />
          <Text style={styles.hintText}>
            분석이 완료되면{'\n'}맞춤형 학습 조언을 받을 수 있어요
          </Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );

  const renderRequirementMission = () => (
    <View style={styles.requirementsContainer}>
      <Text style={styles.requirementsTitle}>실력 분석 미션 가이드 🧭</Text>
      <View style={styles.requirementsList}>
        <Text style={styles.requirementItem}>
          • <Text style={styles.requirementValue}>기본/AI 분석</Text>: 카테고리
          1개 완성 🌈 (난이도별 1세트 × 3)
        </Text>
      </View>
    </View>
  );

  const renderInsufficientData = () => {
    const metadata = analysisData?.analysisMetadata;
    const dataStatus = metadata?.dataStatus; // 'insufficient' | 'partial' | 'sufficient'

    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={Colors.light.gradientColors}
            style={styles.insufficientCard}
          >
            <Ionicons
              name='trending-up'
              size={60}
              color={Colors.light.primary}
            />

            {dataStatus === 'insufficient' &&
              isEmptyObject(categoryStats ?? {}) && (
                <>
                  <Text style={styles.insufficientTitle}>
                    아직 푼 퀴즈가 없어요 🐣
                  </Text>
                  <Text style={styles.insufficientText}>
                    관심 있는 카테고리 하나만 먼저 마스터해볼까요? 🎯{'\n'}
                    난이도별 1세트(10문제)씩, 총 3세트(30문제)만 풀면 기본/AI
                    분석을 시작할 수 있어요!
                  </Text>

                  {renderRequirementMission()}
                </>
              )}

            {dataStatus === 'insufficient' &&
              !isEmptyObject(categoryStats ?? {}) && (
                <>
                  <Text style={styles.insufficientTitle}>
                    조금만 더 풀어볼까요? 🏃‍♂️
                  </Text>
                  <Text style={styles.insufficientText}>
                    한 카테고리에서 쉬움 / 보통 / 어려움 각 1세트(10문제)씩만
                    풀면 기본/AI 실력 분석을 바로 보여드릴게요! 🔍
                  </Text>

                  {renderRequirementMission()}
                </>
              )}

            {dataStatus !== 'sufficient' &&
              !isEmptyObject(categoryStats ?? {}) && (
                <View style={{ marginTop: 20 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: 'bold',
                      color: Colors.light.primary,
                      marginBottom: 8,
                    }}
                  >
                    📊 카테고리별 퀴즈 진행 현황
                  </Text>
                  {Object.entries(categoryStats ?? {}).map(
                    ([category, stats]) => (
                      <CategoryProgressCard
                        key={category}
                        categoryLabel={switchCategoryKey(category)}
                        difficultyStats={stats.difficultyStats}
                      />
                    )
                  )}
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
            color={selectedTab === tab.key ? '#ffffff' : '#666'}
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

  const renderTierGuide = () => (
    <View style={styles.tierGuideContainer}>
      <TouchableOpacity
        style={styles.tierGuideHeader}
        onPress={() => setTierGuideExpanded(!tierGuideExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.tierGuideHeaderLeft}>
          <Ionicons name='information-circle' size={20} color='#667eea' />
          <Text style={styles.tierGuideTitle}>깡깡이 등급 기준</Text>
        </View>
        <Ionicons
          name={tierGuideExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color='#667eea'
        />
      </TouchableOpacity>

      {tierGuideExpanded && (
        <Animated.View
          style={[
            styles.tierGuideContent,
            {
              opacity: tierGuideExpanded ? 1 : 0,
              transform: [
                {
                  translateY: tierGuideExpanded ? 0 : -20,
                },
              ],
            },
          ]}
        >
          <Text style={styles.tierGuideSubtitle}>
            가중 평균 정답률은 어려운 문제를 더 중요하게 평가하는 방식이에요.
            쉬움(1배), 보통(2배), 어려움(3배) 가중치를 적용하여 어려운 문제를 잘
            푸는 진짜 실력자에게 더 높은 점수를 줘요!
          </Text>
          {[
            {
              tier: '🤪 완전 깡깡이',
              range: '0-39%',
              description: '아직 많이 틀려요. 더 연습해보세요!',
              color: '#ef4444',
              bgColor: '#fef2f2',
            },
            {
              tier: '😅 여전히 깡깡이',
              range: '40-59%',
              description: '조금씩 실력이 향상되고 있어요.',
              color: '#f97316',
              bgColor: '#fff7ed',
            },
            {
              tier: '🤔 깡깡이 벗어나는 중',
              range: '60-74%',
              description: '깡깡이에서 벗어나려고 노력 중!',
              color: '#0ea5e9',
              bgColor: '#f0f9ff',
            },
            {
              tier: '🧠 이제 깡깡이 아님',
              range: '75-84%',
              description: '이제 깡깡이가 아니에요!',
              color: '#22c55e',
              bgColor: '#f0fdf4',
            },
            {
              tier: '🚀 깡깡이 완전 극복',
              range: '85-100%',
              description: '완전히 깡깡이를 극복했어요!',
              color: '#a855f7',
              bgColor: '#fdf4ff',
            },
          ].map((item, index) => (
            <View
              key={index}
              style={[styles.tierGuideItem, { backgroundColor: item.bgColor }]}
            >
              <View style={styles.tierGuideTop}>
                <Text style={styles.tierGuideTier}>{item.tier}</Text>
                <Text
                  style={[
                    styles.tierGuideRange,
                    { color: item.color, backgroundColor: `${item.color}15` },
                  ]}
                >
                  {item.range}
                </Text>
              </View>
              <Text style={styles.tierGuideDescription}>
                {item.description}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
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
                <Text style={styles.scoreBadgeText}>{a.weightedAccuracy}%</Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      '가중 평균 정답률이란?',
                      '어려운 문제를 더 중요하게 평가하는 방식이에요.\n\n' +
                        '가중치: 쉬움(1배), 보통(2배), 어려움(3배)\n\n' +
                        '예시:\n' +
                        '• 쉬움: 20문제, 80% 정답률 → 20×80×1 = 1,600\n' +
                        '• 보통: 10문제, 70% 정답률 → 10×70×2 = 1,400\n' +
                        '• 어려움: 5문제, 60% 정답률 → 5×60×3 = 900\n\n' +
                        '가중 평균 = (1,600+1,400+900) ÷ (20×1+10×2+5×3) = 3,900 ÷ 55 = 70.9%\n\n' +
                        '어려운 문제를 잘 푸는 진짜 실력자에게 더 높은 점수를 줘요!'
                    )
                  }
                  style={{ marginLeft: 6 }}
                >
                  <Ionicons name='help-circle-outline' size={16} color='#fff' />
                </TouchableOpacity>
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
              <Ionicons name='alarm' size={20} color='#f59e0b' />
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
                  ? `성장률: +${a.growthTrend}%`
                  : a.growthTrend < 0
                    ? `성장률: ${a.growthTrend}%`
                    : `성장률: 변화 없음`}
              </Text>
            </View>
          </View>

          {/* 스킬 레벨 - 게이미피케이션 */}
          <View style={styles.skillSection}>
            <View style={styles.skillHeader}>
              <Ionicons name='trophy' size={20} color='#f59e0b' />
              <Text style={styles.skillTitle}>현재 수준</Text>
            </View>
            <View
              style={[
                styles.skillBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy).includes(
                  '등급 미부여'
                ) && styles.unrankedBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                  '🤪 완전 깡깡이' && styles.completeGgBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                  '😅 여전히 깡깡이' && styles.stillGgBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                  '🤔 깡깡이 벗어나는 중' && styles.escapeGgBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                  '🧠 이제 깡깡이 아님' && styles.notGgBadge,
                getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                  '🚀 깡깡이 완전 극복' && styles.overcomeGgBadge,
              ]}
            >
              <Text
                style={[
                  styles.skillText,
                  getSkillLevelFromWeightedAccuracy(
                    a.weightedAccuracy
                  ).includes('등급 미부여') && styles.unrankedText,
                  getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                    '🤪 완전 깡깡이' && styles.completeGgText,
                  getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                    '😅 여전히 깡깡이' && styles.stillGgText,
                  getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                    '🤔 깡깡이 벗어나는 중' && styles.escapeGgText,
                  getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                    '🧠 이제 깡깡이 아님' && styles.notGgText,
                  getSkillLevelFromWeightedAccuracy(a.weightedAccuracy) ===
                    '🚀 깡깡이 완전 극복' && styles.overcomeGgText,
                ]}
              >
                {getSkillLevelFromWeightedAccuracy(a.weightedAccuracy).includes(
                  '등급 미부여'
                )
                  ? '등급 미부여'
                  : getSkillLevelFromWeightedAccuracy(a.weightedAccuracy)}
              </Text>
              {getSkillLevelFromWeightedAccuracy(a.weightedAccuracy).includes(
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

  // 탭 변경 시 analysisComplete 상태 리셋하지 않음 (한 번 완료되면 계속 유지)
  const renderAITab = () => {
    // refreshAI() 호출 제거 - useEffect에서 처리

    // 로딩 상태 표시 조건 (디버그용으로 강제 로딩 표시)
    const shouldShowLoading = aiLoading;

    // 디버그용: AI 탭에서 항상 로딩 상태 표시
    // if (selectedTab === 'ai') {
    //   // 애니메이션 재시작
    //   animatedValue.stopAnimation();
    //   animatedValue.setValue(0);

    //   const animateLoading = () => {
    //     Animated.loop(
    //       Animated.sequence([
    //         Animated.timing(animatedValue, {
    //           toValue: 1,
    //           duration: 2000,
    //           useNativeDriver: true,
    //         }),
    //         Animated.timing(animatedValue, {
    //           toValue: 0,
    //           duration: 0,
    //           useNativeDriver: true,
    //         }),
    //       ])
    //     ).start();
    //   };

    //   animateLoading();

    //   return renderLoadingState();
    // }

    if (shouldShowLoading) {
      return renderLoadingState();
    }

    return (
      <View style={styles.tabContent}>

        {/* 약점 보완 세트 CTA */}
        {weakness && (
          <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
              onPress={handleStartWeaknessPractice}
              activeOpacity={0.9}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#22c55e', '#16a34a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name='flash' size={22} color='#fff' />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                    약점 보완 10문제 시작
                  </Text>
                </View>
                <Text style={{ color: '#ecfdf5', marginTop: 8, fontWeight: '600' }}>
                  {weakness.label} · {weakness.difficulty === 'easy' ? '쉬움' : weakness.difficulty === 'medium' ? '보통' : '어려움'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* 제거됨: AI 종합 평가 / 동기부여 메시지 / 다음 목표 */}

        {aiError && (
          <>
            <View style={styles.errorBanner}>
              <Ionicons name='warning' size={20} color='#fff' />
              <Text style={styles.errorText}>{aiError}</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => {
                refreshAI(true);
              }}
            >
              <Ionicons name='refresh' size={18} color='#3b82f6' />
              <Text style={styles.refreshButtonText}>AI 재분석 시도</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  if (!analysisData || !categoryStats) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ActivityIndicator
          size='large'
          color={Colors.light.secondary}
          style={{ marginTop: 20 }}
        />
      </SafeAreaView>
    );
  }

  if (analysisData?.analysisMetadata.dataStatus === 'insufficient') {
    return renderInsufficientData();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 헤더 */}
      <LinearGradient colors={gradientColors} style={styles.header}>
        <Text style={styles.headerTitle}>실력 분석</Text>
        <Text style={styles.headerSubtitle}>당신의 퀴즈 실력을 한눈에 👀</Text>
      </LinearGradient>

      {renderTabSelector()}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              onRefresh();
            }}
          />
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
          {selectedTab === 'detailed' && (
            <>
              {renderTierGuide()}
              {renderDetailedTab()}
            </>
          )}
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
    fontSize: 32,
    fontWeight: '800',
    color: Colors.light.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.light.primary,
    opacity: 0.9,
    fontWeight: '500',
  },
  loadingContent: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
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
    color: Colors.light.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  insufficientText: {
    fontSize: 16,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  requirementsContainer: {
    marginTop: 24,
    width: '100%',
  },
  requirementsTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: Colors.light.primary,
  },
  requirementsList: {
    paddingLeft: 8,
  },
  requirementItem: {
    fontSize: 14,
    marginBottom: 4,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  requirementValue: {
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  ctaButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#ffffff',
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
    backgroundColor: Colors.light.secondary,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#ffffff',
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
    color: '#ffffff',
  },
  categoryScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
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
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    color: '#ffffff',
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
    color: '#ffffff',
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
    color: '#ffffff',
  },
  strengthsContainer: {
    marginTop: 12,
  },
  strengthsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  strengthText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  detailedCategoryCard: {
    backgroundColor: '#ffffff',
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
    color: Colors.light.primary,
  },
  scoreTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreTagText: {
    color: '#ffffff',
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
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginLeft: 4,
  },
  recommendedText: {
    fontSize: 14,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recommendedValue: {
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  aiCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    ...Platform.select({
      android: {
        borderWidth: 2,
        borderColor: 'rgba(102, 126, 234, 0.3)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
    }),
  },
  aiGradient: {
    padding: 24,
    position: 'relative',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 12,
    letterSpacing: -0.5,
  },
  aiInsight: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 26,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
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
    color: Colors.light.primary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  recommendationText: {
    fontSize: 14,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    color: Colors.light.primary,
    marginBottom: 8,
  },
  strategyText: {
    fontSize: 14,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    lineHeight: 20,
  },
  motivationCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#ff9a9e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    ...Platform.select({
      android: {
        borderWidth: 2,
        borderColor: 'rgba(255, 154, 158, 0.4)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
      },
    }),
  },
  motivationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  motivationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 12,
    letterSpacing: -0.5,
  },
  motivationText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  goalsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#f8fafc',
    ...Platform.select({
      android: {
        borderWidth: 3,
        borderColor: 'rgba(102, 126, 234, 0.2)',
        backgroundColor: '#ffffff',
        // elevation 대신 더 진한 테두리로 깊이감 표현
        borderLeftWidth: 4,
        borderLeftColor: 'rgba(102, 126, 234, 0.4)',
      },
    }),
  },
  goalsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  goalText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    marginLeft: 16,
    flex: 1,
    lineHeight: 22,
  },
  noAIContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    margin: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  noAIText: {
    fontSize: 16,
    color: Colors.light.secondary,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    backgroundColor: '#667eea',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#5a67d8',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  // 깡깡이 등급별 배지 스타일
  unrankedBadge: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
    borderWidth: 2,
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
  completeGgBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 3,
  },
  completeGgText: {
    color: '#dc2626',
    fontSize: 16,
  },
  stillGgBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
    borderWidth: 3,
  },
  stillGgText: {
    color: '#ea580c',
    fontSize: 16,
  },
  escapeGgBadge: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
    borderWidth: 3,
  },
  escapeGgText: {
    color: '#0284c7',
    fontSize: 16,
  },
  notGgBadge: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
    borderWidth: 3,
    shadowColor: '#22c55e',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  notGgText: {
    color: '#16a34a',
    fontSize: 16,
  },
  overcomeGgBadge: {
    backgroundColor: '#fdf4ff',
    borderColor: '#a855f7',
    borderWidth: 4,
    shadowColor: '#a855f7',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    transform: [{ scale: 1.05 }],
  },
  overcomeGgText: {
    fontSize: 18,
    color: '#9333ea',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  refreshButtonText: {
    color: '#667eea',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },
  // 티어 가이드 스타일 - 그림자 제거 및 개선
  tierGuideContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tierGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierGuideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierGuideTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 8,
  },
  tierGuideSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginVertical: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  tierGuideContent: {
    gap: 12,
    marginTop: 16,
  },
  tierGuideItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tierGuideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierGuideTier: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  tierGuideRange: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontWeight: '600',
  },
  tierGuideDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // 안드로이드용 그림자 대체 효과
  androidShadowContainer: {
    position: 'absolute',
    width: width * 0.9,
    maxWidth: 400,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidShadowLayer1: {
    position: 'absolute',
    width: '98%',
    height: '98%',
    borderRadius: 34,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    transform: [{ scale: 1.02 }],
  },
  androidShadowLayer2: {
    position: 'absolute',
    width: '96%',
    height: '96%',
    borderRadius: 36,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    transform: [{ scale: 1.04 }],
  },
  loadingCard: {
    width: width * 0.9,
    maxWidth: 400,
    padding: 40,
    borderRadius: 32,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#1e40af', // 블루 그림자
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
      },
      android: {
        elevation: 0, // 기본 elevation 제거
      },
    }),
  },
  // 안드로이드 전용 카드 스타일
  androidLoadingCard: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'transparent', // 그라디언트가 배경이므로 투명
  },
  loadingBackgroundDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingDot: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // 블루 톤 배경
    borderRadius: 50,
  },
  dot1: {
    width: 60,
    height: 60,
    top: 20,
    left: 20,
  },
  dot2: {
    width: 40,
    height: 40,
    top: 60,
    right: 30,
  },
  dot3: {
    width: 80,
    height: 80,
    bottom: 40,
    left: 10,
  },
  dot4: {
    width: 30,
    height: 30,
    bottom: 80,
    right: 40,
  },
  loadingIconContainer: {
    position: 'relative',
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.2)', // 블루 톤 배경
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(147, 197, 253, 0.4)', // 연한 블루 테두리
  },
  iconRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(147, 197, 253, 0.3)', // 연한 블루 링
    borderStyle: 'dashed',
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: 200,
    height: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.3)', // 블루 톤 배경
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    width: '100%', // 전체 너비로 설정
    backgroundColor: '#60a5fa', // 밝은 블루 진행바
    borderRadius: 3,
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    transformOrigin: 'left', // 왼쪽에서 시작하도록 설정
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // 블루 톤 배경
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.3)', // 연한 블루 테두리
    marginTop: 20,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
});
