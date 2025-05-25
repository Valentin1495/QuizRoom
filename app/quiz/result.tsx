import { UserAnswer } from '@/context/quiz-setup-context';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { useQuizGamification } from '@/hooks/use-quiz-gamification';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { switchDifficulty } from '@/utils/switch-difficulty';
import { switchQuestionFormat } from '@/utils/switch-question-format';
import { switchQuizType } from '@/utils/switch-quiz-type';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Home, RefreshCw, Star, X } from 'react-native-feather';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function QuizResultScreen() {
  const {
    setup,
    resetQuizData,
    restartQuiz,
    totalPoints,
    level,
    streak,
    newlyUnlockedAchievements,
    getPointsForNextLevel,
  } = useQuizGamification();

  /* ------------------------------------------------------------------
   * 2. 기본 통계 계산
   * ----------------------------------------------------------------*/
  const { userAnswers, quizType, category, difficulty, questionFormat } = setup;
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const totalCount = userAnswers.length;
  const percentage = Math.round((correctCount / totalCount) * 100);
  const wrongCount = totalCount - correctCount;

  /* ------------------------------------------------------------------
   * 3. 추가 게임화 값
   * ----------------------------------------------------------------*/
  const totalEarnedPoints = userAnswers.reduce(
    (sum, a) => sum + (a as UserAnswer).pointsEarned,
    0
  );
  const maxStreak = userAnswers.reduce(
    (m, a) => Math.max(m, (a as UserAnswer).streakCount),
    0
  );

  /* ------------------------------------------------------------------
   * 4. 애니메이션용 shared values
   * ----------------------------------------------------------------*/
  const scoreOpacity = useSharedValue(0);
  const scoreScale = useSharedValue(0.8);
  const chartProgress = useSharedValue(0);
  const detailsOpacity = useSharedValue(0);
  const pointsCountUp = useSharedValue(0);
  const expProgress = useSharedValue(0);

  /* ------------------------------------------------------------------
   * 5. 컴포넌트 마운트 애니메이션
   * ----------------------------------------------------------------*/
  useEffect(() => {
    scoreOpacity.value = withSequence(
      withTiming(0), // start hidden
      withDelay(300, withTiming(1, { duration: 800 }))
    );
    scoreScale.value = withSequence(
      withTiming(0.8),
      withDelay(
        300,
        withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) })
      )
    );
    chartProgress.value = withDelay(
      1000,
      withTiming(percentage / 100, {
        duration: 1500,
        easing: Easing.out(Easing.quad),
      })
    );
    /* 포인트 카운트업 */
    pointsCountUp.value = withDelay(
      1200,
      withTiming(totalEarnedPoints, {
        duration: 1500,
        easing: Easing.out(Easing.quad),
      })
    );
    /* 경험치 게이지 */

    expProgress.value = withDelay(
      1800,
      withTiming((totalPoints % 1000) / 1000, { duration: 1000 })
    );
    detailsOpacity.value = withDelay(2000, withTiming(1, { duration: 800 }));
  }, []);

  /* ------------------------------------------------------------------
   * 6. 애니메이션 style
   * ----------------------------------------------------------------*/
  const scoreCardStyle = useAnimatedStyle(() => ({
    opacity: scoreOpacity.value,
    transform: [{ scale: scoreScale.value }],
  }));
  const chartStyle = useAnimatedStyle(() => ({
    width: `${chartProgress.value * 100}%`,
  }));
  const detailsStyle = useAnimatedStyle(() => ({
    opacity: detailsOpacity.value,
  }));

  /* ------------------------------------------------------------------
   * 7. 결과 메시지 / 등급
   * ----------------------------------------------------------------*/
  const getResultMessage = () => {
    if (percentage >= 90) {
      if (maxStreak >= 5)
        return '🔥 완벽한 연속 정답! 당신은 진정한 퀴즈 마스터!';
      return '🏆 훌륭해요! 전문가시네요!';
    }
    if (percentage >= 70) return '👍 잘했어요! 거의 다 맞췄네요!';
    if (percentage >= 50) return '💪 좋은 시도! 다시 도전해 보세요!';
    return '📚 괜찮아요! 꾸준히 학습하면 분명 더 나아질 거예요!';
  };
  const getGrade = () => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    return 'F';
  };

  /* ------------------------------------------------------------------
   * 8. 하위 UI 렌더러 – 게임화 섹션
   * ----------------------------------------------------------------*/

  /************  점수 & 레벨 카드  ************/
  const renderLevelCard = () => {
    const expToNext = getPointsForNextLevel();
    const progress = totalPoints / (totalPoints + expToNext); // 0~1

    return (
      <View style={styles.levelCard}>
        <Text style={styles.levelTitle}>Lv. {level}</Text>
        <Text style={styles.levelPoints}>
          <Text style={styles.levelPointsLabel}>다음 레벨까지</Text>{' '}
          <Text style={{ fontStyle: 'italic' }}>
            {expToNext.toLocaleString()} xp
          </Text>{' '}
          💪
        </Text>
        {/* exp bar */}
        <View style={styles.expBarBg}>
          <View style={[styles.expBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.expLabel}>
          {totalPoints}/{totalPoints + expToNext} xp
        </Text>

        {streak >= 1 && (
          <LinearGradient
            colors={['#f59e0b', '#ef4444']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakGradient}
          >
            <Text style={styles.streakText}>
              {streak}일 {streak > 1 && '연속'} 참여
            </Text>
            <Ionicons name='flame-outline' size={24} color='#fff' />
          </LinearGradient>
        )}
      </View>
    );
  };

  /************  스트릭 & 업적 요약  ************/
  const renderStreakAndAchievements = () => {
    // 이번 퀴즈에서 새로 획득한 배지만 표시
    const recentBadges = newlyUnlockedAchievements;

    // 스트릭이나 새 배지가 없으면 렌더링하지 않음
    if (recentBadges.length === 0) {
      return null;
    }

    return (
      <View style={styles.streakCard}>
        {recentBadges.length > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.newBadgeLabel}>🎉 새로 획득한 배지!</Text>
            <View style={styles.badgeRow}>
              {recentBadges.map((badge) => (
                <View key={badge.id} style={styles.badge}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeTitle}>{badge.title}</Text>
                  <Text style={styles.badgeDescription}>
                    {badge.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  // 퀴즈 정보 렌더링
  const renderQuizInfo = () => {
    return (
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>퀴즈 유형</Text>
            <Text style={styles.infoValue}>{switchQuizType(quizType)}</Text>
          </View>

          {category && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>카테고리</Text>
              <Text style={styles.infoValue}>
                {switchCategoryToLabel(category) || ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          {questionFormat && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>문제 형식</Text>
              <Text style={styles.infoValue}>
                {switchQuestionFormat(questionFormat) || ''}
              </Text>
            </View>
          )}

          {difficulty && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>난이도</Text>
              <Text style={styles.infoValue}>
                {switchDifficulty(difficulty) || ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // 결과 요약 렌더링
  const renderSummary = () => {
    return (
      <View style={styles.summaryContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <LinearGradient
              colors={['#22c55e', '#16a34a']}
              style={styles.statIcon}
            >
              <Check width={20} height={20} color='white' />
            </LinearGradient>
          </View>
          <Text style={styles.statValue}>{correctCount}</Text>
          <Text style={styles.statLabel}>정답</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <LinearGradient
              colors={['#f43f5e', '#e11d48']}
              style={styles.statIcon}
            >
              <X width={20} height={20} color='white' />
            </LinearGradient>
          </View>
          <Text style={styles.statValue}>{wrongCount}</Text>
          <Text style={styles.statLabel}>오답</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <LinearGradient
              colors={['#a855f7', '#8b5cf6']}
              style={styles.statIcon}
            >
              <Star width={20} height={20} color='white' />
            </LinearGradient>
          </View>
          <Text style={styles.statValue}>{getGrade()}</Text>
          <Text style={styles.statLabel}>등급</Text>
        </View>
      </View>
    );
  };

  /* ------------------------------------------------------------------
   * 10. 문제 리뷰 아이템 (points / streak 뱃지 추가)
   * ----------------------------------------------------------------*/

  const renderQuestionItem = ({
    item,
    index,
  }: {
    item: UserAnswer;
    index: number;
  }) => (
    <View style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionNumber}>문제 {index + 1}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {item.isCorrect ? (
            <View style={styles.correctBadge}>
              <Check width={14} height={14} color='white' />
              <Text style={styles.badgeText}>정답</Text>
            </View>
          ) : (
            <View style={styles.incorrectBadge}>
              <X width={14} height={14} color='white' />
              <Text style={styles.badgeText}>오답</Text>
            </View>
          )}
          {item.pointsEarned > 0 && (
            <View style={styles.pointsBadge}>
              <Star width={14} height={14} color='white' />
              <Text style={styles.pointsBadgeText}>
                +{item.pointsEarned} xp
              </Text>
            </View>
          )}
          {item.streakCount > 1 && (
            <View style={styles.streakBadge}>
              <Ionicons name='flame-outline' size={14} color='white' />
              <Text style={styles.streakBadgeText}>{item.streakCount}연속</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.questionText}>{item.question}</Text>

      <View style={styles.answerContainer}>
        <View style={styles.answerRow}>
          <Text style={styles.answerLabel}>정답:</Text>
          <Text style={styles.correctAnswer}>
            {Array.isArray(item?.correctAnswer)
              ? item?.correctAnswer.map((answer) => answer).join(' / ')
              : item?.correctAnswer}
          </Text>
        </View>

        {item?.userAnswer ? (
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>내 답변:</Text>
            <Text
              style={[
                styles.userAnswer,
                item?.isCorrect
                  ? styles.userAnswerCorrect
                  : styles.userAnswerIncorrect,
              ]}
            >
              {item?.userAnswer}
            </Text>
          </View>
        ) : (
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>내 답변:</Text>
            <Text style={styles.skippedAnswer}>건너뜀</Text>
          </View>
        )}
      </View>
    </View>
  );

  /* ------------------------------------------------------------------
   * 11. 화면 구성
   * ----------------------------------------------------------------*/

  useBlockNavigation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>퀴즈 결과</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ① 점수 카드 */}
        <Animated.View style={[styles.scoreCard, scoreCardStyle]}>
          <LinearGradient
            colors={['#ec4899', '#a855f7', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scoreGradient}
          >
            <Text style={styles.scorePercentage}>{percentage}%</Text>
            <Text style={styles.scoreText}>정답률</Text>
            <Text style={styles.scoreMessage}>{getResultMessage()}</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View style={[styles.progressBar, chartStyle]} />
              </View>
            </View>

            {/* 간단한 게임화 숫자 요약 */}
            <View style={styles.scoreGameInfo}>
              <View style={styles.scoreGameItem}>
                <Text style={styles.scoreGameLabel}>획득 경험치</Text>
                <Text style={styles.scoreGameValue}>
                  +{totalEarnedPoints} xp
                </Text>
              </View>
              {maxStreak > 1 && (
                <View style={styles.scoreGameItem}>
                  <Text style={styles.scoreGameLabel}>최대 연속 정답</Text>
                  <Text style={styles.scoreGameValue}>{maxStreak} 연속 🔥</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ★ NEW : 레벨 카드 */}
        {renderLevelCard()}

        {/* ★ NEW : 스트릭 & 업적 */}
        {renderStreakAndAchievements()}

        {/* ④ 퀴즈 설정 정보 / 결과 요약 / 문제 리뷰 */}
        {renderQuizInfo()}
        {renderSummary()}

        <Animated.View style={[styles.reviewSection, detailsStyle]}>
          <Text style={styles.sectionTitle}>📝 문제 리뷰</Text>

          <FlatList
            data={userAnswers}
            renderItem={renderQuestionItem}
            keyExtractor={(item) => item.questionId}
            scrollEnabled={false}
          />
        </Animated.View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            resetQuizData();
            router.push('/');
          }}
        >
          <Home width={20} height={20} color='#6b7280' />
          <Text style={styles.footerButtonText}>홈으로</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/')}
        >
          <TrendingUp width={20} height={20} color='#6b7280' />
          <Text style={styles.footerButtonText}>리더보드</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={styles.restartButton}
          onPress={() => {
            restartQuiz();
            router.push(
              `/quiz?quizType=${quizType}&category=${category}&difficulty=${difficulty}&questionFormat=${questionFormat}`
            );
          }}
        >
          <LinearGradient
            colors={['#60a5fa', '#3b82f6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.restartGradient}
          >
            <RefreshCw width={20} height={20} color='white' />
            <Text style={styles.restartButtonText}>다시 도전</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  scoreCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.3)', // 보라색 테두리
  },
  scoreGradient: {
    padding: 24,
    alignItems: 'center',
  },
  scorePercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreText: {
    fontSize: 18,
    color: 'white',
    marginTop: 8,
  },
  scoreMessage: {
    fontSize: 16,
    color: 'white',
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginVertical: 16,
  },
  progressBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  reviewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1', // 왼쪽 테두리 강조
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    marginBottom: 12,
  },
  incorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    marginBottom: 12,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },
  questionText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  answerContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 70,
  },
  correctAnswer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  userAnswer: {
    fontSize: 14,
    fontWeight: '600',
  },
  userAnswerCorrect: {
    color: '#22c55e',
  },
  userAnswerIncorrect: {
    color: '#ef4444',
  },
  skippedAnswer: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 24,
  },
  footerButtonText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 8,
  },
  restartButton: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  restartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  reviewButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  reviewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  levelCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginBottom: 24,
  },
  levelTitle: { fontSize: 22, fontWeight: '700', color: '#4f46e5' },
  levelPoints: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 6,
    color: '#111827',
  },
  levelPointsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginVertical: 6,
    color: '#111827',
  },
  expBarBg: {
    width: '100%',
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 4,
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
  },
  expLabel: { marginTop: 4, marginBottom: 20, fontSize: 12, color: '#6b7280' },

  /* ───────── 스트릭 & 업적 ───────── */
  // 배지 컨테이너
  badgeContainer: {
    alignItems: 'center',
  },

  // 새 배지 라벨
  newBadgeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 12,
    textAlign: 'center',
  },

  // 배지 행
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },

  // 개별 배지
  badge: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 120,
    maxWidth: 140,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // 배지 아이콘
  badgeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  // 배지 제목
  badgeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },

  // 배지 설명
  badgeDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },

  // 스트릭 카드
  streakCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },

  // 스트릭 그라디언트
  streakGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  // 스트릭 텍스트
  streakText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },

  /* ───────── 포인트/스트릭 뱃지 ───────── */
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#f59e0b', // 주황 계열로 강조
    marginBottom: 12,
  },
  pointsBadgeText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#8B0000', // 딥 버건디 계열
    marginBottom: 12,
  },
  streakBadgeText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
  },

  /* ───────── 결과 점수 요약 카드 ───────── */
  scoreGameInfo: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },

  scoreGameItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  scoreGameLabel: {
    fontSize: 14,
    color: '#6b7280',
  },

  scoreGameValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
