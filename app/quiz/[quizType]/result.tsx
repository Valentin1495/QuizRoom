import { useQuizSetup, UserAnswer } from '@/context/quiz-setup-context';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { switchDifficulty } from '@/utils/switch-difficulty';
import { switchQuestionFormat } from '@/utils/switch-question-format';
import { switchQuizType } from '@/utils/switch-quiz-type';
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
  // 정답 개수 계산
  const { setup } = useQuizSetup();
  const { userAnswers, quizType, category, difficulty, questionFormat } = setup;
  const correctCount = userAnswers.filter((a) => a?.isCorrect).length;
  const totalCount = userAnswers.length;
  const percentage = Math.round((correctCount / totalCount) * 100);
  const wrongCount = totalCount - correctCount;
  const router = useRouter();

  // 애니메이션 값
  const scoreOpacity = useSharedValue(0);
  const scoreScale = useSharedValue(0.8);
  const chartProgress = useSharedValue(0);
  const detailsOpacity = useSharedValue(0);

  // 결과 메시지 생성
  const getResultMessage = () => {
    if (percentage >= 90) return '훌륭해요! 당신은 전문가에요!';
    if (percentage >= 70) return '잘했어요! 거의 다 맞췄네요!';
    if (percentage >= 50) return '좋은 시도였어요! 다시 도전해보세요.';
    return '다음에는 더 잘할 수 있을 거예요!';
  };

  // 등급 계산
  const getGrade = () => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 60) return 'D+';
    if (percentage >= 55) return 'D';
    return 'F';
  };

  // 컴포넌트 마운트 시 애니메이션 시작
  useEffect(() => {
    // 점수 카드 애니메이션
    scoreOpacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(
        300,
        withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        })
      )
    );

    scoreScale.value = withSequence(
      withTiming(0.8, { duration: 0 }),
      withDelay(
        300,
        withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        })
      )
    );

    // 차트 애니메이션
    chartProgress.value = withDelay(
      1000,
      withTiming(percentage / 100, {
        duration: 1500,
        easing: Easing.out(Easing.quad),
      })
    );

    // 세부 정보 애니메이션
    detailsOpacity.value = withDelay(1500, withTiming(1, { duration: 800 }));
  }, []);

  // 애니메이션 스타일
  const scoreCardStyle = useAnimatedStyle(() => {
    return {
      opacity: scoreOpacity.value,
      transform: [{ scale: scoreScale.value }],
    };
  });

  const chartStyle = useAnimatedStyle(() => {
    return {
      width: `${chartProgress.value * 100}%`,
    };
  });

  const detailsStyle = useAnimatedStyle(() => {
    return {
      opacity: detailsOpacity.value,
    };
  });

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
                {switchCategoryToLabel(category)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          {questionFormat && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>문제 형식</Text>
              <Text style={styles.infoValue}>
                {switchQuestionFormat(questionFormat)}
              </Text>
            </View>
          )}

          {difficulty && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>난이도</Text>
              <Text style={styles.infoValue}>
                {switchDifficulty(difficulty)}
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
              colors={['#60a5fa', '#3b82f6']}
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

  // 문제 항목 렌더링
  const renderQuestionItem = ({
    item,
    index,
  }: {
    item: UserAnswer;
    index: number;
  }) => {
    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionNumber}>문제 {index + 1}</Text>
          {item?.isCorrect ? (
            <View style={styles.correctBadge}>
              <Check width={16} height={16} color='white' />
              <Text style={styles.badgeText}>정답</Text>
            </View>
          ) : (
            <View style={styles.incorrectBadge}>
              <X width={16} height={16} color='white' />
              <Text style={styles.badgeText}>오답</Text>
            </View>
          )}
        </View>

        <Text style={styles.questionText}>{item?.question}</Text>

        <View style={styles.answerContainer}>
          <View style={styles.answerRow}>
            <Text style={styles.answerLabel}>정답:</Text>
            <Text style={styles.correctAnswer}>{item?.correctAnswer}</Text>
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
  };

  useBlockNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>퀴즈 결과</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* 점수 카드 */}
        <Animated.View style={[styles.scoreCard, scoreCardStyle]}>
          <LinearGradient
            colors={['#ec4899', '#a855f7', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scoreGradient}
          >
            <Text style={styles.scorePercentage}>{percentage}%</Text>
            <Text style={styles.scoreText}>
              {correctCount}/{totalCount} 정답
            </Text>
            <Text style={styles.scoreMessage}>{getResultMessage()}</Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View style={[styles.progressBar, chartStyle]} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 퀴즈 정보 */}
        {renderQuizInfo()}

        {/* 결과 요약 */}
        {renderSummary()}

        {/* 문제 리뷰 */}
        <Animated.View style={[styles.reviewSection, detailsStyle]}>
          <Text style={styles.sectionTitle}>문제 리뷰</Text>

          <FlatList
            data={userAnswers}
            renderItem={renderQuestionItem}
            keyExtractor={(item) => item.questionId}
            scrollEnabled={false}
          />
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/')}
        >
          <Home width={20} height={20} color='#6b7280' />
          <Text style={styles.footerButtonText}>홈으로</Text>
        </TouchableOpacity>

        {/* {wrongCount > 0 && onReviewWrongAnswers && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={onReviewWrongAnswers}
          >
            <LinearGradient
              colors={['#f43f5e', '#e11d48']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.reviewGradient}
            >
              <BookOpen width={20} height={20} color='white' />
              <Text style={styles.reviewButtonText}>오답 복습</Text>
            </LinearGradient>
          </TouchableOpacity>
        )} */}

        <TouchableOpacity
          style={styles.restartButton}
          onPress={() => {
            router.push(`/quiz/${quizType}/question`);
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    marginTop: 16,
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  incorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
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
  },
  footerButtonText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 8,
  },
  restartButton: {
    borderRadius: 24,
    overflow: 'hidden',
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
});
