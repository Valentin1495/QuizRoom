import { GamificationHUD } from '@/context/gamification-HUD';
import { PointsAnimation } from '@/context/points-animation';
import { Doc } from '@/convex/_generated/dataModel';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { useQuizGamification } from '@/hooks/use-quiz-gamification';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight, Check, Home, Star } from 'react-native-feather';
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
import { LevelUpModal } from './level-up-modal';

const { width } = Dimensions.get('window');

export default function Questions() {
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
    initializeQuizTracking, // 새로 추가된 함수
    quizStats, // 디버깅용 (선택사항)
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
  const router = useRouter();

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
  }, []); // 컴포넌트 마운트 시 한 번만 실행

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

  const goToNextQuestion = async (): Promise<void> => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
      setSelectedOption('');
      setTextAnswer('');
      setSlideDirection('right');

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
                // 퀴즈 완료 (업적 자동 체크됨) 처리 후 결과 화면으로 이동
                const completionResult = await handleQuizCompletion();
                // 필요시 완료 결과 활용
                console.log('퀴즈 완료 결과:', completionResult);
                router.push('/quiz/result');
              },
            },
          ]
        );
      } else {
        const completionResult = await handleQuizCompletion();
        console.log('퀴즈 완료 결과:', completionResult);
        router.push('/quiz/result');
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
            router.push('/');
          },
        },
      ]
    );
  };

  useBlockNavigation();

  if (!currentQuestion) {
    return (
      <LinearGradient
        colors={['#FF416C', '#FF4B2B']}
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
      colors={['#8A2387', '#E94057', '#F27121']}
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
                <Star width={16} height={16} color='#fff' />
                <Text style={styles.category}>
                  {switchCategoryToLabel(currentQuestion.category)}
                </Text>
              </View>
              <TouchableOpacity style={styles.homeButton} onPress={goToHome}>
                <Home width={20} height={20} color='#fff' />
              </TouchableOpacity>
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
                  style={[
                    styles.textInput,
                    showFeedback && isCorrect && styles.correctTextInput,
                    showFeedback && !isCorrect && styles.wrongTextInput,
                  ]}
                  placeholder='답변을 입력하세요'
                  placeholderTextColor='rgba(0, 0, 0, 0.5)'
                  value={textAnswer}
                  onChangeText={setTextAnswer}
                  editable={!showFeedback}
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
                    ? `정답이에요! ${earnedPoints > 0 ? `+${earnedPoints}xp` : ''}`
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
                  <Check width={20} height={20} color='#fff' />
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
                    <ArrowLeft width={16} height={16} color='#fff' />
                    <Text style={styles.navigationButtonText}>이전</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.navigationButton, styles.nextButton]}
                onPress={goToNextQuestion}
              >
                <View style={styles.navigationButtonContent}>
                  <Text style={styles.navigationButtonText}>
                    {currentQuestionIndex === questions.length - 1
                      ? '결과 보기'
                      : showFeedback
                        ? '다음 문제'
                        : '스킵하기'}
                  </Text>
                  <ArrowRight width={16} height={16} color='#fff' />
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
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
    top: '40%', // 더 위쪽으로 위치 조정
    left: 0,
    right: 0,
    zIndex: 9999, // zIndex 값 증가
    alignItems: 'center',
    justifyContent: 'center',
    height: 100, // 명시적 높이 설정
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
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
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  questionCount: {
    color: '#fff',
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
    color: '#fff',
    fontSize: 15,
    marginLeft: 6,
    fontWeight: '500',
  },
  homeButton: {
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
    borderColor: '#8A2387',
    shadowColor: '#8A2387',
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
  optionText: {
    fontSize: 17,
    color: '#333',
  },
  selectedOptionText: {
    fontWeight: '600',
    color: '#8A2387',
  },
  correctOptionText: {
    fontWeight: '600',
    color: '#2ed573',
  },
  wrongOptionText: {
    fontWeight: '600',
    color: '#ff4757',
  },
  shortAnswerContainer: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#f7f7f7',
    padding: 16,
    borderRadius: 16,
    fontSize: 17,
    borderWidth: 2,
    borderColor: '#f7f7f7',
    color: '#333',
  },
  correctTextInput: {
    borderColor: '#2ed573',
    backgroundColor: 'rgba(46, 213, 115, 0.08)',
  },
  wrongTextInput: {
    borderColor: '#ff4757',
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
  },
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
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '600',
  },
  correctFeedback: {
    color: '#2ed573',
  },
  wrongFeedback: {
    color: '#ff4757',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 4,
    textAlign: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButton: {
    backgroundColor: '#8A2387',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#8A2387',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: '#bbb',
    shadowOpacity: 0.1,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navigationButton: {
    flex: 1,
    padding: 14,
    borderRadius: 50,
    alignItems: 'center',
    backgroundColor: '#E94057',
    marginHorizontal: 5,
  },
  nextButton: {
    backgroundColor: '#F27121',
    shadowColor: '#F27121',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  navigationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
});
