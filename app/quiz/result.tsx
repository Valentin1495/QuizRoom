import { Difficulty, UserAnswer } from '@/context/quiz-setup-context';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { useQuizGamification } from '@/hooks/use-quiz-gamification';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { switchDifficulty } from '@/utils/switch-difficulty';
import { switchQuestionFormat } from '@/utils/switch-question-format';
import { switchQuizType } from '@/utils/switch-quiz-type';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Info,
  RefreshCw,
  Star,
  X,
} from 'react-native-feather';
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

// 타입 정의
type CategoryType =
  | 'kpop-music'
  | 'general'
  | 'history-culture'
  | 'arts-literature'
  | 'sports'
  | 'science-tech'
  | 'math-logic'
  | 'entertainment'
  | 'korean-movie'
  | 'foreign-movie'
  | 'korean-celebrity'
  | 'foreign-celebrity'
  | null
  | undefined;

type QuizType =
  | 'knowledge'
  | 'celebrity'
  | 'four-character'
  | 'movie-chain'
  | 'proverb-chain'
  | 'slang'
  | 'logo'
  | 'nonsense'
  | null;

// Helper to format seconds as mm:ss
function formatSecondsToMMSS(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  if (min > 0) {
    return `${min}분 ${sec}초`;
  }
  return `${sec}초`;
}

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
    quizStats,
  } = useQuizGamification();
  const totalTime = setup.totalTime ?? quizStats.totalTimeSpent;

  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<
    number | null
  >(null);
  // 추가: 각 문제별로 정답 더보기 상태 관리
  const [expandedAnswers, setExpandedAnswers] = useState<{
    [key: number]: boolean;
  }>({});

  /* ------------------------------------------------------------------
   * 포인트 계산 로직
   * ----------------------------------------------------------------*/
  const getCategoryBonus = useCallback((category: CategoryType): number => {
    const bonusMap: Record<string, number> = {
      'math-logic': 8,
      'science-tech': 6,
      'history-culture': 4,
      'arts-literature': 4,
      'foreign-movie': 3,
      'foreign-celebrity': 3,
      'kpop-music': 2,
      entertainment: 2,
      'korean-movie': 2,
      'korean-celebrity': 2,
      sports: 1,
      general: 0,
    };
    return (category && bonusMap[category]) || 0;
  }, []);

  const getTypeBonus = useCallback((quizType: QuizType): number => {
    const bonusMap: Record<string, number> = {
      nonsense: 4,
      'four-character': 3,
      'proverb-chain': 3,
      'movie-chain': 2,
      logo: 2,
      slang: 2,
      knowledge: 0,
      celebrity: 0,
    };
    return (quizType && bonusMap[quizType]) || 0;
  }, []);

  const getPointsBreakdown = useCallback(
    (
      difficulty: Difficulty,
      category: CategoryType,
      quizType: QuizType,
      questionFormat: string | null,
      streakCount: number
    ): { items: string[]; total: number } => {
      const breakdown: string[] = [];
      let total = 0;

      // 기본 포인트
      const basePoints =
        difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 25;
      breakdown.push(
        `기본 포인트 (${'난이도 ' + switchDifficulty(difficulty)}): ${basePoints}포인트`
      );
      total += basePoints;

      // 카테고리 보너스
      const categoryBonus = getCategoryBonus(category);
      if (categoryBonus > 0) {
        breakdown.push(`카테고리 보너스: +${categoryBonus}포인트`);
        total += categoryBonus;
      }

      // 퀴즈 타입 보너스
      const typeBonus = getTypeBonus(quizType);
      if (typeBonus > 0) {
        breakdown.push(`퀴즈 타입 보너스: +${typeBonus}포인트`);
        total += typeBonus;
      }

      // 주관식 보너스
      if (questionFormat === 'short') {
        breakdown.push(`주관식 보너스: +3포인트`);
        total += 3;
      }

      // 연속 정답 보너스
      if (streakCount >= 3) {
        const streakBonus = Math.min(Math.floor(streakCount / 3) * 3, 15);
        breakdown.push(
          `연속 정답 보너스 (${streakCount}연속): +${streakBonus}포인트`
        );
        total += streakBonus;
      }

      // 특별 콤보 보너스
      if (
        difficulty === 'hard' &&
        ['math-logic', 'science-tech'].includes(category as string)
      ) {
        breakdown.push(`콤보 보너스 (고난이도): +5포인트`);
        total += 5;
      }

      return { items: breakdown, total };
    },
    [getCategoryBonus, getTypeBonus]
  );

  /* ------------------------------------------------------------------
   * 기본 통계 계산
   * ----------------------------------------------------------------*/
  const { userAnswers, quizType, category, difficulty, questionFormat } = setup;
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const totalCount = userAnswers.length;
  const percentage = Math.round((correctCount / totalCount) * 100);
  const wrongCount = totalCount - correctCount;

  /* ------------------------------------------------------------------
   * 추가 게임화 값
   * ----------------------------------------------------------------*/
  const totalEarnedPoints = userAnswers.reduce(
    (sum, a) => sum + (a as UserAnswer).pointsEarned,
    0
  );
  const maxStreak = userAnswers.reduce(
    (m, a) => Math.max(m, (a as UserAnswer).streakCount),
    0
  );

  const wasPerfect = percentage === 100;

  /* ------------------------------------------------------------------
   * 애니메이션용 shared values
   * ----------------------------------------------------------------*/
  const scoreOpacity = useSharedValue(0);
  const scoreScale = useSharedValue(0.8);
  const chartProgress = useSharedValue(0);
  const detailsOpacity = useSharedValue(0);
  const pointsCountUp = useSharedValue(0);
  const expProgress = useSharedValue(0);

  /* ------------------------------------------------------------------
   * 컴포넌트 마운트 애니메이션
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
    pointsCountUp.value = withDelay(
      1200,
      withTiming(totalEarnedPoints, {
        duration: 1500,
        easing: Easing.out(Easing.quad),
      })
    );
    expProgress.value = withDelay(
      1800,
      withTiming((totalPoints % 1000) / 1000, { duration: 1000 })
    );
    detailsOpacity.value = withDelay(2000, withTiming(1, { duration: 800 }));
  }, []);

  /* ------------------------------------------------------------------
   * 애니메이션 style
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
   * 결과 메시지 / 등급
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
    if (percentage >= 50) return 'D';
    return 'F';
  };

  /* ------------------------------------------------------------------
   * 포인트 계산 예시 섹션 렌더링
   * ----------------------------------------------------------------*/
  const renderPointsExample = () => {
    // 실제 정답 문제들 중에서 가장 높은 포인트를 받은 문제 찾기
    const correctAnswers = userAnswers.filter((answer) => answer.isCorrect);
    const highestPointQuestion = correctAnswers.reduce(
      (prev, current) =>
        prev.pointsEarned > current.pointsEarned ? prev : current,
      correctAnswers[0]
    );

    // 평균 포인트 계산
    const averagePoints =
      correctAnswers.length > 0
        ? Math.round(
            correctAnswers.reduce(
              (sum, answer) => sum + answer.pointsEarned,
              0
            ) / correctAnswers.length
          )
        : 0;

    // 대표 예시로 사용할 문제 (높은 포인트 문제 또는 첫 번째 정답 문제)
    const exampleQuestion = highestPointQuestion || correctAnswers[0];

    // 예시 문제가 없으면 현재 설정 기반으로 계산
    const breakdown = exampleQuestion
      ? getPointsBreakdown(
          difficulty,
          category,
          quizType,
          questionFormat,
          exampleQuestion.streakCount
        )
      : getPointsBreakdown(
          difficulty,
          category,
          quizType,
          questionFormat,
          maxStreak
        );

    return (
      <View style={styles.exampleCard}>
        <TouchableOpacity
          style={styles.exampleHeader}
          onPress={() => setShowPointsBreakdown(!showPointsBreakdown)}
        >
          <View style={styles.exampleTitleContainer}>
            <Info width={20} height={20} color='#6366f1' />
            <Text style={styles.exampleTitle}>포인트 계산 분석</Text>
          </View>
          {showPointsBreakdown ? (
            <ChevronUp width={20} height={20} color='#6b7280' />
          ) : (
            <ChevronDown width={20} height={20} color='#6b7280' />
          )}
        </TouchableOpacity>

        {showPointsBreakdown && (
          <View style={styles.exampleContent}>
            {/* 실제 퀴즈 포인트 통계 */}
            <View style={styles.statisticsContainer}>
              <Text style={styles.exampleSubtitle}>
                📊 이번 퀴즈 포인트 통계
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{totalEarnedPoints}</Text>
                  <Text style={styles.statText}>총 획득</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{averagePoints}</Text>
                  <Text style={styles.statText}>평균 포인트</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {highestPointQuestion?.pointsEarned || 0}
                  </Text>
                  <Text style={styles.statText}>최고 포인트</Text>
                </View>
              </View>
            </View>

            {/* 포인트 계산 방식 설명 */}
            <Text style={styles.exampleSubtitle}>
              🔍 포인트 계산 방식 ({exampleQuestion ? '실제 예시' : '설정 기준'}
              ):
            </Text>

            {exampleQuestion && (
              <View style={styles.exampleQuestionContainer}>
                <Text style={styles.exampleQuestionText}>
                  예시 문제: "
                  {exampleQuestion.question.length > 50
                    ? exampleQuestion.question.substring(0, 50) + '...'
                    : exampleQuestion.question}
                  "
                </Text>
                <Text style={styles.exampleQuestionInfo}>
                  {exampleQuestion.streakCount}연속 정답 시 →{' '}
                  {exampleQuestion.pointsEarned}포인트 획득
                </Text>
              </View>
            )}

            <View style={styles.breakdownContainer}>
              {breakdown.items.map((item, index) => (
                <View key={index} style={styles.breakdownItem}>
                  <Text style={styles.breakdownText}>• {item}</Text>
                </View>
              ))}
              <View style={styles.breakdownTotal}>
                <Text style={styles.breakdownTotalText}>
                  = 총 {breakdown.total}포인트 (정답 시)
                </Text>
              </View>
            </View>

            {/* 개선된 팁 섹션 */}
            <View style={styles.exampleNote}>
              <Text style={styles.exampleNoteText}>
                💡{' '}
                <Text style={styles.exampleNoteTitle}>
                  다음 퀴즈에서 더 높은 포인트를 받으려면:
                </Text>
                {'\n'}• 연속 정답을 유지하세요 (3연속마다 보너스 +3포인트)
                {maxStreak < 9 && '\n• 이번에 놓친 연속 보너스가 있었어요!'}
                {difficulty !== 'hard' &&
                  '\n• 어려운 난이도에 도전해보세요 (최대 +10포인트 추가)'}
                {!['math-logic', 'science-tech'].includes(category as string) &&
                  '\n• 수학·논리, 과학·기술 카테고리는 높은 보너스를 제공해요'}
                {questionFormat !== 'short' &&
                  '\n• 주관식 문제는 추가 +3포인트 보너스가 있어요'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  /* ------------------------------------------------------------------
   * 개별 문제 포인트 상세 보기
   * ----------------------------------------------------------------*/
  const renderQuestionPointsDetail = (item: UserAnswer, index: number) => {
    if (!item.isCorrect || selectedQuestionIndex !== index) return null;

    // 해당 문제의 실제 포인트 계산 내역
    const breakdown = getPointsBreakdown(
      difficulty || 'medium',
      category,
      quizType,
      questionFormat,
      item.streakCount
    );

    // 실제 획득 포인트와 계산된 포인트의 차이 확인
    const calculatedPoints = breakdown.total;
    const actualPoints = item.pointsEarned;
    const pointsDifference = actualPoints - calculatedPoints;

    return (
      <View style={styles.questionPointsDetail}>
        <Text style={styles.pointsDetailTitle}>📊 포인트 상세 내역</Text>

        {/* 문제 정보 */}
        <View style={styles.questionInfoContainer}>
          <Text style={styles.questionInfoText}>
            문제:{' '}
            {item.question.length > 60
              ? item.question.substring(0, 60) + '...'
              : item.question}
          </Text>
          <Text style={styles.questionInfoText}>
            연속 정답: {item.streakCount}회 연속
          </Text>
        </View>

        {/* 포인트 계산 내역 */}
        {breakdown.items.map((breakdownItem, idx) => (
          <Text key={idx} style={styles.pointsDetailItem}>
            • {breakdownItem}
          </Text>
        ))}

        <View style={styles.pointsDetailTotal}>
          <Text style={styles.pointsDetailCalculated}>
            계산된 포인트: {calculatedPoints}포인트
          </Text>
          <Text style={styles.pointsDetailTotalText}>
            실제 획득: {actualPoints}포인트
          </Text>
          {pointsDifference !== 0 && (
            <Text style={styles.pointsDetailDifference}>
              {pointsDifference > 0 ? '추가 보너스' : '차이'}:{' '}
              {pointsDifference > 0 ? '+' : ''}
              {pointsDifference}포인트
            </Text>
          )}
        </View>

        {/* 성과 분석 */}
        {item.streakCount >= 6 && (
          <View style={styles.achievementNote}>
            <Text style={styles.achievementText}>
              🔥 연속 정답 달성! 높은 보너스를 받았어요!
            </Text>
          </View>
        )}
      </View>
    );
  };

  /* ------------------------------------------------------------------
   * 레벨 카드 렌더링
   * ----------------------------------------------------------------*/
  const renderLevelCard = () => {
    const expToNext = getPointsForNextLevel();
    const progress = totalPoints / (totalPoints + expToNext);

    return (
      <View style={styles.levelCard}>
        <Text style={styles.levelTitle}>Lv. {level}</Text>
        <Text style={styles.levelPoints}>
          <Text style={styles.levelPointsLabel}>다음 레벨까지</Text>{' '}
          <Text style={{ fontStyle: 'italic' }}>
            {expToNext.toLocaleString()}포인트
          </Text>
        </Text>
        <View style={styles.expBarBg}>
          <View style={[styles.expBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.expLabel}>
          {totalPoints.toLocaleString()}/
          {(totalPoints + expToNext).toLocaleString()}포인트
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

  /* ------------------------------------------------------------------
   * 스트릭 & 업적 요약
   * ----------------------------------------------------------------*/
  const renderStreakAndAchievements = () => {
    const recentBadges = newlyUnlockedAchievements;

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
   * 문제 리뷰 아이템 (포인트 상세 토글 기능 추가)
   * ----------------------------------------------------------------*/
  const renderQuestionItem = ({
    item,
    index,
  }: {
    item: UserAnswer;
    index: number;
  }) => {
    // 정답 배열 처리
    const correctAnswers = Array.isArray(item?.correctAnswer)
      ? item?.correctAnswer
      : [item?.correctAnswer];
    const isExpanded = expandedAnswers[index];
    const showMore = correctAnswers.length > 3 && !isExpanded;
    const showLess = correctAnswers.length > 3 && isExpanded;
    const answersToShow = showMore
      ? correctAnswers.slice(0, 3)
      : correctAnswers;

    return (
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
              <TouchableOpacity
                style={styles.pointsBadge}
                onPress={() =>
                  setSelectedQuestionIndex(
                    selectedQuestionIndex === index ? null : index
                  )
                }
              >
                <Star width={14} height={14} color='white' />
                <Text style={styles.pointsBadgeText}>
                  +{item.pointsEarned}포인트
                </Text>
              </TouchableOpacity>
            )}
            {item.streakCount > 1 && (
              <View style={styles.streakBadge}>
                <Ionicons name='flame-outline' size={14} color='white' />
                <Text style={styles.streakBadgeText}>
                  {item.streakCount}연속
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.questionText}>{item.question}</Text>

        <View style={styles.answerContainer}>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>정답:</Text>
            <View style={{ flex: 1 }}>
              {answersToShow.map((answer, idx) => (
                <Text key={idx} style={styles.correctAnswer}>
                  {answer}
                </Text>
              ))}
              {showMore && (
                <TouchableOpacity
                  onPress={() =>
                    setExpandedAnswers((prev) => ({ ...prev, [index]: true }))
                  }
                >
                  <Text
                    style={{ color: '#2563eb', marginTop: 2, fontSize: 13 }}
                  >
                    +{correctAnswers.length - 3}개 더보기
                  </Text>
                </TouchableOpacity>
              )}
              {showLess && (
                <TouchableOpacity
                  onPress={() =>
                    setExpandedAnswers((prev) => ({ ...prev, [index]: false }))
                  }
                >
                  <Text
                    style={{ color: '#2563eb', marginTop: 2, fontSize: 13 }}
                  >
                    접기
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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

        {/* 포인트 상세 내역 */}
        {renderQuestionPointsDetail(item, index)}
      </View>
    );
  };

  /* ------------------------------------------------------------------
   * 화면 구성
   * ----------------------------------------------------------------*/
  useBlockNavigation();
  const router = useRouter();

  const averageTime =
    setup.questions && setup.questions.length > 0
      ? totalTime / setup.questions.length
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>퀴즈 결과</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ① 포인트 카드 */}
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

            <View style={styles.scoreGameInfo}>
              {wasPerfect && (
                <View style={styles.bonusPointsItem}>
                  <Text style={styles.bonusPointsText}>
                    🎯 완벽한 정답률! 보너스 20포인트
                  </Text>
                </View>
              )}

              <View style={styles.scoreGameItem}>
                <Text style={styles.scoreGameLabel}>획득 포인트</Text>
                <Text style={styles.scoreGameValue}>
                  +{totalEarnedPoints}포인트
                </Text>
              </View>

              {maxStreak > 1 && (
                <View style={styles.scoreGameItem}>
                  <Text style={styles.scoreGameLabel}>최대 연속 정답</Text>
                  <Text style={styles.scoreGameValue}>{maxStreak}연속 🔥</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ② 레벨 카드 */}
        {renderLevelCard()}

        {/* ③ 스트릭 & 업적 */}
        {renderStreakAndAchievements()}

        {/* ★ NEW: 포인트 계산 예시 섹션 */}
        {renderPointsExample()}

        {/* ④ 퀴즈 설정 정보 / 결과 요약 */}
        {renderQuizInfo()}
        {renderSummary()}

        {/* ⑤ 총 소요 시간 */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 15, color: '#374151', fontWeight: '600' }}>
            🕒 총 소요 시간: {formatSecondsToMMSS(totalTime)}
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            평균 시간: {formatSecondsToMMSS(averageTime)}
          </Text>
        </View>

        {/* ⑥ 문제 리뷰 */}
        <Animated.View style={[styles.reviewSection, detailsStyle]}>
          <Text style={styles.sectionTitle}>📝 문제 리뷰</Text>
          <Text style={styles.reviewSubtitle}>
            💡 포인트 배지를 터치하면 상세 내역을 볼 수 있어요
          </Text>

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
            router.push('/(tabs)');
          }}
        >
          <Home width={20} height={20} color='#6b7280' />
          <Text style={styles.footerButtonText}>홈으로</Text>
        </TouchableOpacity>

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

  // 포인트 계산 예시 섹션 스타일
  exampleCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    overflow: 'hidden',
  },
  exampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  exampleTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  exampleContent: {
    padding: 16,
  },
  exampleSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  breakdownContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 4,
  },
  breakdownText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  breakdownTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  breakdownTotalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  exampleNote: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  exampleNoteText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 16,
  },
  exampleNoteTitle: {
    fontWeight: '600',
  },
  statisticsContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  exampleQuestionContainer: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftColor: '#3b82f6',
    borderLeftWidth: 4,
  },
  exampleQuestionText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  exampleQuestionInfo: {
    fontSize: 12,
    color: '#3730a3',
    marginTop: 4,
    fontStyle: 'italic',
  },
  questionInfoContainer: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  questionInfoText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  pointsDetailCalculated: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  pointsDetailDifference: {
    fontSize: 12,
    color: '#059669',
    fontStyle: 'italic',
  },
  achievementNote: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  achievementText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
  },

  // 문제별 포인트 상세 스타일
  questionPointsDetail: {
    marginTop: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  pointsDetailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  pointsDetailItem: {
    fontSize: 12,
    color: '#075985',
    marginBottom: 4,
    lineHeight: 16,
  },
  pointsDetailTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  pointsDetailTotalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0c4a6e',
  },

  // 리뷰 섹션 스타일
  reviewSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
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
  levelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4f46e5',
  },
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
  expLabel: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 12,
    color: '#6b7280',
  },

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

  /* ───────── 결과 포인트 요약 카드 ───────── */
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
    marginBottom: 8,
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

  bonusPointsItem: {
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef3c7', // 연한 노란색 배경
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24', // 노란색 테두리
  },

  bonusPointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e', // 갈색 텍스트
    textAlign: 'center',
  },
});
