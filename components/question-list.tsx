import { Colors } from '@/constants/Colors';
import { GamificationHUD } from '@/context/gamification-HUD';
import { PointsAnimation } from '@/context/points-animation';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { useChallenges } from '@/hooks/use-challenges';
import { useQuizGamification } from '@/hooks/use-quiz-gamification';
import { log } from '@/utils/log';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { switchDifficulty } from '@/utils/switch-difficulty';
import { getAuth } from '@react-native-firebase/auth';
import { useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Flag,
  Folder,
  Home,
} from 'react-native-feather';
import Animated, {
  Easing,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDifficultyIcon } from './get-difficulty-icon';
import { LevelUpModal } from './level-up-modal';

const { width } = Dimensions.get('window');

export default function QuestionList() {
  const {
    totalPoints,
    level,
    streak,
    pointsToNextLevel,
    setup,
    handleAnswer,
    handleQuizCompletion,
    handlePointsAnimationComplete,
    currentStreak,
    showPointsAnimation,
    earnedPoints,
    initializeQuizTracking,
    setQuizStartTime,
    setTotalTime,
  } = useQuizGamification();

  const { questions, questionFormat, userAnswers } = setup;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>(
    'right'
  );
  const [prevLevel, setPrevLevel] = useState(level);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [maxPerfectStreak, setMaxPerfectStreak] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  // 퀴즈 시작 시간과 각 문제별 시간 추적
  const [quizStartTime, setQuizStartTimeLocal] = useState<number>(() =>
    Date.now()
  );

  const router = useRouter();
  const userId = getAuth().currentUser?.uid;
  const { onQuizCompleted } = useChallenges(userId ? userId : 'skip') || {};

  // 애니메이션을 위한 값
  const scale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  const progressAnimatedStyles = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  // 퀴즈 시작 시 업적 추적 초기화
  useEffect(() => {
    initializeQuizTracking();
    setQuizStartTime(quizStartTime); // context의 setQuizStartTime 호출
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (level > prevLevel) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
      setPrevLevel(level);
    }
  }, [level]);

  useEffect(() => {
    // 진행률 업데이트 시 애니메이션
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressWidth.value = withTiming(progress, {
      duration: 600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [currentQuestionIndex, questions.length]);

  const currentQuestion: Doc<'quizzes'> = questions[currentQuestionIndex];

  const createReport = useMutation(api.reports.createReport);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<
    '정답 오류' | '문제 불명확' | '기타' | ''
  >('');
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 답변 처리 (통합된 훅 사용)
  const onSubmitAnswer = (): void => {
    let userAnswer: string = '';

    if (questionFormat === 'multiple') {
      userAnswer = selectedOption;
    } else {
      userAnswer = textAnswer.trim();
    }

    // 애니메이션 효과
    scale.value = withTiming(
      1.05,
      { duration: 200, easing: Easing.bounce },
      () => {
        scale.value = withTiming(1, { duration: 200 });
      }
    );

    // 통합된 answer 핸들러 사용
    const result = handleAnswer(
      currentQuestion,
      currentQuestionIndex,
      userAnswer,
      questionFormat
    );

    setIsCorrect(result.isCorrect);
    setShowFeedback(true);
  };

  const goToPreviousQuestion = (): void => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowFeedback(false);
      setSlideDirection('left');

      // 이전 답변이 있으면 복원
      const previousAnswer = userAnswers[currentQuestionIndex - 1];
      if (previousAnswer && previousAnswer.userAnswer) {
        if (questionFormat === 'multiple') {
          setSelectedOption(previousAnswer.userAnswer);
        } else {
          setTextAnswer(previousAnswer.userAnswer);
        }
        setIsCorrect(previousAnswer.isCorrect);
        setShowFeedback(true);
      } else {
        setSelectedOption('');
        setTextAnswer('');
        setShowFeedback(false);
      }
    }
  };

  const checkUnansweredQuestions = (): boolean => {
    return userAnswers.some((answer) => {
      // 현재 문제가 마지막이고 아직 답변하지 않은 경우 체크
      if (currentQuestionIndex === questions.length - 1 && !showFeedback) {
        return true;
      }
      // 다른 문제들 중 답변하지 않은 문제가 있는지 체크
      return answer.userAnswer === '';
    });
  };

  // 퀴즈 완료 처리 함수
  const completeQuiz = async (maxStreak: number) => {
    // 게이미피케이션 퀴즈 완료 처리
    const completionResult = await handleQuizCompletion();

    // 퀴즈 통계 계산
    // const correctCount = userAnswers.filter(
    //   (answer) => answer.isCorrect
    // ).length;
    // 마지막 정답 여부
    // const lastAnswerCorrect =
    // userAnswers[userAnswers.length - 1]?.isCorrect || false;

    const totalTime = (Date.now() - quizStartTime) / 1000; // 전체 소요 시간 (초)
    setTotalTime(totalTime);
    const avgTimePerQuestion = totalTime / questions.length;

    // 도전과제 업데이트 (최고 연속 정답 수 사용)
    if (onQuizCompleted) {
      await onQuizCompleted(
        currentQuestion.category ?? undefined, // 카테고리, null이나 undefined일 때 기본값 사용
        avgTimePerQuestion, // 평균 답변 시간 (초)
        maxPerfectStreak // 최고 연속 정답 수
      );
    }

    log('퀴즈 완료 결과:', completionResult);
    router.push('/quiz/result');
  };

  const goToNextQuestion = async (): Promise<void> => {
    if (isCompleting) return; // 중복 방지
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
      setSelectedOption('');
      setTextAnswer('');
      setSlideDirection('right');
      setMaxPerfectStreak((prev) => Math.max(prev, currentStreak));

      // 다음 답변이 있으면 복원
      const nextAnswer = userAnswers[currentQuestionIndex + 1];
      if (nextAnswer && nextAnswer.userAnswer) {
        if (questionFormat === 'multiple') {
          setSelectedOption(nextAnswer.userAnswer);
        } else {
          setTextAnswer(nextAnswer.userAnswer);
        }
        setIsCorrect(nextAnswer.isCorrect);
        setShowFeedback(true);
      }
    } else {
      // 결과 화면으로 이동하기 전에 모든 문제가 답변되었는지 확인
      if (checkUnansweredQuestions()) {
        Alert.alert(
          '답변하지 않은 문제가 있어요',
          '확인을 누르면 답변하지 않은 문제는 오답 처리돼요.',
          [
            {
              text: '취소',
              style: 'cancel',
            },
            {
              text: '확인',
              onPress: async () => {
                setIsCompleting(true);
                await completeQuiz(maxPerfectStreak);
                setIsCompleting(false);
              },
            },
          ]
        );
      } else {
        setIsCompleting(true);
        await completeQuiz(maxPerfectStreak);
        setIsCompleting(false);
      }
    }
  };

  const goToHome = (): void => {
    Alert.alert(
      '퀴즈 종료',
      '퀴즈를 종료하고 홈으로 돌아가시겠어요?\n현재 진행 상황은 저장되지 않아요.',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '확인',
          onPress: () => {
            router.push('/(tabs)');
          },
        },
      ]
    );
  };

  const goToResult = async (): Promise<void> => {
    if (isCompleting) return;

    // 답변하지 않은 문제가 있는지 확인
    if (checkUnansweredQuestions()) {
      Alert.alert(
        '답변하지 않은 문제가 있어요',
        '확인을 누르면 답변하지 않은 문제는 오답 처리돼요.',
        [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '확인',
            onPress: async () => {
              setIsCompleting(true);
              await completeQuiz(maxPerfectStreak);
              setIsCompleting(false);
            },
          },
        ]
      );
    } else {
      setIsCompleting(true);
      await completeQuiz(maxPerfectStreak);
      setIsCompleting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportReason) return;
    setIsSubmittingReport(true);
    try {
      await createReport({
        questionId: currentQuestion._id,
        userId: userId!,
        reason: reportReason,
        detail: reportReason === '기타' ? reportDetail : undefined,
      });
      setShowReportModal(false);
      setReportReason('');
      setReportDetail('');
      Alert.alert(
        '신고가 접수되었습니다',
        '검토 후 조치하겠습니다. 감사합니다!'
      );
    } catch (e) {
      Alert.alert(
        '신고 실패',
        '신고 중 오류가 발생했습니다. 다시 시도해 주세요.'
      );
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useBlockNavigation();

  if (!currentQuestion) {
    return (
      <LinearGradient
        colors={Colors.light.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      </LinearGradient>
    );
  }

  // 현재 문제에 대한 답변 상태 확인
  const canSubmit =
    questionFormat === 'multiple' ? selectedOption : textAnswer.trim();

  return (
    <LinearGradient
      colors={Colors.light.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <LevelUpModal visible={showLevelUp} level={level} />

      <SafeAreaView style={styles.safeArea}>
        {/* 포인트 애니메이션 */}
        {showPointsAnimation && (
          <View style={styles.pointsAnimationContainer}>
            <PointsAnimation
              points={earnedPoints}
              visible={showPointsAnimation}
              onComplete={handlePointsAnimationComplete}
            />
          </View>
        )}

        {/* 게임화 HUD */}
        <GamificationHUD
          visible={true}
          gamification={{ totalPoints, level, streak, pointsToNextLevel }}
        />

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[styles.progressBar, progressAnimatedStyles]}
                />
              </View>
              <Text style={styles.questionCount}>
                {currentQuestionIndex + 1}/{questions.length}
              </Text>
            </View>
            <View style={styles.topButtons}>
              <View style={styles.categoryContainer}>
                <Folder width={16} height={16} color={Colors.light.secondary} />
                <Text style={styles.category}>
                  {switchCategoryToLabel(currentQuestion.category)}
                </Text>
                {currentQuestion.difficulty && (
                  <View style={styles.difficultyBadge}>
                    {getDifficultyIcon(currentQuestion.difficulty)}
                    <Text style={styles.difficulty}>
                      {switchDifficulty(currentQuestion.difficulty)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.reportButton}
                  onPress={() => setShowReportModal(true)}
                >
                  <Flag width={18} height={18} color={Colors.light.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resultButton}
                  onPress={goToResult}
                  disabled={isCompleting}
                >
                  <CheckCircle
                    width={18}
                    height={18}
                    color={Colors.light.secondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeButton} onPress={goToHome}>
                  <Home width={20} height={20} color={Colors.light.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Animated.View
            key={`${currentQuestion._id}-${currentQuestionIndex}`}
            entering={
              slideDirection === 'right'
                ? SlideInRight.duration(300)
                : SlideInLeft.duration(300)
            }
            exiting={
              slideDirection === 'right'
                ? SlideOutLeft.duration(300)
                : SlideOutRight.duration(300)
            }
            style={styles.questionContainer}
          >
            <Text style={styles.question}>{currentQuestion.question}</Text>

            {questionFormat === 'multiple' ? (
              <View style={styles.optionsContainer}>
                {currentQuestion.options?.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      selectedOption === option && styles.selectedOption,
                      showFeedback &&
                        selectedOption === option &&
                        isCorrect &&
                        styles.correctOption,
                      showFeedback &&
                        selectedOption === option &&
                        !isCorrect &&
                        styles.wrongOption,
                      showFeedback &&
                        selectedOption !== option &&
                        option === currentQuestion.answer &&
                        styles.correctOption,
                    ]}
                    onPress={() => {
                      if (!showFeedback) {
                        setSelectedOption(option);
                      }
                    }}
                    disabled={showFeedback}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedOption === option && styles.selectedOptionText,
                        showFeedback &&
                          ((selectedOption === option && isCorrect) ||
                            option === currentQuestion.answer) &&
                          styles.correctOptionText,
                        showFeedback &&
                          selectedOption === option &&
                          !isCorrect &&
                          styles.wrongOptionText,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.shortAnswerContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder='답변을 입력하세요'
                  placeholderTextColor='#888'
                  value={textAnswer}
                  onChangeText={setTextAnswer}
                  editable={!showFeedback}
                  multiline={false} // 명시적으로 단일 줄
                  allowFontScaling={false} // (선택)
                />
              </View>
            )}

            {showFeedback && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[
                  styles.feedbackContainer,
                  isCorrect
                    ? styles.correctFeedbackContainer
                    : styles.wrongFeedbackContainer,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    isCorrect ? styles.correctFeedback : styles.wrongFeedback,
                  ]}
                >
                  {isCorrect
                    ? `정답이에요! ${earnedPoints > 0 ? `+${earnedPoints}포인트` : ''}`
                    : questionFormat === 'multiple'
                      ? `오답이에요. 정답은 "${currentQuestion.answer}" 입니다`
                      : `오답이에요. 정답은 "${currentQuestion.answers![0]}" 입니다`}
                </Text>
                {isCorrect && currentStreak > 1 && (
                  <Text style={styles.streakText}>
                    🔥 {currentStreak}연속 정답!
                  </Text>
                )}
              </Animated.View>
            )}

            {!showFeedback && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !canSubmit && styles.disabledButton,
                ]}
                onPress={onSubmitAnswer}
                disabled={!canSubmit}
              >
                <View style={styles.submitButtonContent}>
                  <Text style={styles.submitButtonText}>제출하기</Text>
                  <Check width={20} height={20} color={'#ffffff'} />
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.navigationContainer}>
              {currentQuestionIndex > 0 && (
                <TouchableOpacity
                  style={styles.navigationButton}
                  onPress={goToPreviousQuestion}
                >
                  <View style={styles.navigationButtonContent}>
                    <ArrowLeft width={16} height={16} color={'#ffffff'} />
                    <Text style={styles.navigationButtonText}>이전</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.navigationButton,
                  styles.nextButton,
                  isCompleting && styles.disabledButton,
                ]}
                onPress={goToNextQuestion}
                disabled={isCompleting}
              >
                <View style={styles.navigationButtonContent}>
                  <Text style={styles.navigationButtonText}>
                    {currentQuestionIndex === questions.length - 1
                      ? '결과 보기'
                      : showFeedback
                        ? '다음 문제'
                        : '스킵하기'}
                  </Text>
                  <ArrowRight width={16} height={16} color={'#ffffff'} />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* 개선된 신고 모달 */}
      <Modal
        visible={showReportModal}
        transparent
        animationType='fade'
        onRequestClose={() => setShowReportModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Flag width={24} height={24} color={Colors.light.secondary} />
              <Text style={styles.modalTitle}>문제 신고</Text>
            </View>

            <Text style={styles.modalSubtitle}>어떤 문제가 있나요?</Text>

            <View style={styles.radioGroup}>
              {[
                { key: '정답 오류', label: '정답이 틀렸어요', icon: '❌' },
                {
                  key: '문제 불명확',
                  label: '문제가 이해하기 어려워요',
                  icon: '❓',
                },
                { key: '기타', label: '기타 문제', icon: '💬' },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.radioOption,
                    reportReason === item.key && styles.selectedRadioOption,
                  ]}
                  onPress={() => setReportReason(item.key as any)}
                >
                  <View style={styles.radioContent}>
                    <Text style={styles.radioIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.radioLabel,
                        reportReason === item.key && styles.selectedRadioLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <View style={styles.radioCircle}>
                    {reportReason === item.key && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            {reportReason === '기타' && (
              <TextInput
                style={styles.modalInput}
                placeholder='구체적인 문제를 알려주세요'
                placeholderTextColor='rgba(0, 0, 0, 0.5)'
                value={reportDetail}
                onChangeText={setReportDetail}
                editable={!isSubmittingReport}
                multiline
                numberOfLines={3}
                textAlignVertical='top'
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDetail('');
                }}
                disabled={isSubmittingReport}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitReportButton,
                  (!reportReason ||
                    (reportReason === '기타' && !reportDetail.trim()) ||
                    isSubmittingReport) &&
                    styles.disabledSubmitButton,
                ]}
                onPress={handleReportSubmit}
                disabled={
                  isSubmittingReport ||
                  !reportReason ||
                  (reportReason === '기타' && !reportDetail.trim())
                }
              >
                <Text
                  style={[
                    styles.submitReportButtonText,
                    (!reportReason ||
                      (reportReason === '기타' && !reportDetail.trim()) ||
                      isSubmittingReport) &&
                      styles.disabledSubmitButtonText,
                  ]}
                >
                  {isSubmittingReport ? '신고 중...' : '신고하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  pointsAnimationContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40, // 추가 bottom padding
  },
  header: {
    marginBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    flex: 1,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
  },
  questionCount: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  category: {
    color: Colors.light.secondary,
    fontSize: 15,
    marginLeft: 6,
    fontWeight: '500',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  difficulty: {
    color: Colors.light.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  question: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 24,
    lineHeight: 30,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: '#f7f7f7',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f7f7f7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedOption: {
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.2,
    elevation: 3,
  },
  correctOption: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
    borderColor: '#2ed573',
    shadowColor: '#2ed573',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 0,
  },
  wrongOption: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
    borderColor: '#ff4757',
    shadowColor: '#ff4757',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 0,
  },

  // 옵션 텍스트 스타일들
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  selectedOptionText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  correctOptionText: {
    color: '#2ed573',
    fontWeight: '600',
  },
  wrongOptionText: {
    color: '#ff4757',
    fontWeight: '600',
  },

  // 단답형 입력 관련 스타일들
  shortAnswerContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#ececec',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    fontSize: 17,
    lineHeight: 22,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    color: '#333',
    height: 44, // minHeight 대신 height로 고정
  },
  correctTextInput: {
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
    borderColor: '#2ed573',
  },
  wrongTextInput: {
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
    borderColor: '#ff4757',
  },

  // 피드백 관련 스타일들
  feedbackContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  correctFeedbackContainer: {
    backgroundColor: 'rgba(46, 213, 115, 0.1)',
    borderColor: '#2ed573',
  },
  wrongFeedbackContainer: {
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderColor: '#ff4757',
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  correctFeedback: {
    color: '#2ed573',
  },
  wrongFeedback: {
    color: '#ff4757',
  },
  streakText: {
    fontSize: 14,
    color: '#ff6b35',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },

  // 제출 버튼 스타일들
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    shadowOpacity: 0.1,
    elevation: 0,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },

  // 네비게이션 버튼 스타일들
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  navigationButton: {
    backgroundColor: Colors.light.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButton: {
    backgroundColor: Colors.light.secondary,
    shadowColor: Colors.light.secondary,
    shadowOpacity: 0.3,
  },
  navigationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 6,
  },

  // 로딩 스타일들
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.light.primary,
    fontSize: 18,
    fontWeight: '600',
  },

  // 모달 스타일들
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.secondary,
    marginLeft: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  radioGroup: {
    marginBottom: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedRadioOption: {
    backgroundColor: 'rgba(111, 29, 27, 0.1)',
    borderColor: Colors.light.primary,
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedRadioLabel: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  modalInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitReportButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledSubmitButton: {
    backgroundColor: '#e9ecef',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitReportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledSubmitButtonText: {
    color: '#6c757d',
  },
});
