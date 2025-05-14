import { Doc } from '@/convex/_generated/dataModel';
import { switchCategoryToLabel } from '@/utils/switch-category-to-label';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight, Check, Star } from 'react-native-feather';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type Props = {
  questions: Doc<'quizzes'>[];
  questionFormat: 'multiple' | 'short' | null;
};

type UserAnswer = {
  answer: string;
  isCorrect: boolean;
};

export default function Questions({ questions, questionFormat }: Props) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<(UserAnswer | null)[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>(
    'right'
  );

  // 애니메이션을 위한 값
  const scale = useSharedValue(1);
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  useEffect(() => {
    // 사용자 답변 배열 초기화
    const initialAnswers: (UserAnswer | null)[] = Array(questions.length).fill(
      null
    );

    setUserAnswers(initialAnswers);
  }, []);

  const currentQuestion: Doc<'quizzes'> | undefined =
    questions[currentQuestionIndex];

  const handleAnswer = (): void => {
    let answer: string = '';
    let correct: boolean = false;

    if (questionFormat === 'multiple') {
      answer = selectedOption || '';
      correct = selectedOption === currentQuestion?.answer;
    } else {
      answer = textAnswer.trim();
      correct = answer.toLowerCase() === currentQuestion?.answer.toLowerCase();
    }

    // 애니메이션 효과
    scale.value = withSpring(1.05, { damping: 10 }, () => {
      scale.value = withSpring(1);
    });

    // 사용자 답변 업데이트
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIndex] = {
      answer: answer,
      isCorrect: correct,
    };

    setUserAnswers(newUserAnswers);
    setIsCorrect(correct);
    setShowFeedback(true);
  };

  const goToPreviousQuestion = (): void => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowFeedback(false);
      setSlideDirection('left');

      // 이전 답변이 있으면 복원
      const previousAnswer = userAnswers[currentQuestionIndex - 1];
      if (previousAnswer) {
        if (questionFormat === 'multiple') {
          setSelectedOption(previousAnswer.answer);
        } else {
          setTextAnswer(previousAnswer.answer);
        }
        setIsCorrect(previousAnswer.isCorrect);
        setShowFeedback(true);
      } else {
        setSelectedOption(null);
        setTextAnswer('');
      }
    }
  };

  const goToNextQuestion = (): void => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
      setSelectedOption(null);
      setTextAnswer('');
      setSlideDirection('right');

      // 다음 답변이 있으면 복원
      const nextAnswer = userAnswers[currentQuestionIndex + 1];
      if (nextAnswer) {
        if (questionFormat === 'multiple') {
          setSelectedOption(nextAnswer.answer);
        } else {
          setTextAnswer(nextAnswer.answer);
        }
        setIsCorrect(nextAnswer.isCorrect);
        setShowFeedback(true);
      }
    } else {
      // 결과 화면으로 이동
      console.log('테스트 완료');
    }
  };

  // 진행률 계산
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (!currentQuestion) {
    // 로딩 상태나 질문이 없는 경우
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

  return (
    <LinearGradient
      colors={['#8A2387', '#E94057', '#F27121']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    { width: `${progress}%` },
                    animatedStyles,
                  ]}
                />
              </View>
              <Text style={styles.questionCount}>
                {currentQuestionIndex + 1}/{questions.length}
              </Text>
            </View>
            <View style={styles.categoryContainer}>
              <Star width={16} height={16} color='#fff' />
              <Text style={styles.category}>
                {switchCategoryToLabel(currentQuestion.category)}
              </Text>
            </View>
          </View>

          <Animated.View
            key={currentQuestionIndex}
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
                {currentQuestion.options?.map((option, index) => (
                  <TouchableOpacity
                    key={index}
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
                    ? '정답이에요! 🔥'
                    : `오답이에요. 정답은 "${currentQuestion.answer}" 입니다`}
                </Text>
              </Animated.View>
            )}

            {!showFeedback && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (questionFormat === 'multiple' && !selectedOption) ||
                  (questionFormat === 'short' && !textAnswer.trim())
                    ? styles.disabledButton
                    : {},
                ]}
                onPress={handleAnswer}
                disabled={
                  questionFormat === 'multiple'
                    ? !selectedOption
                    : !textAnswer.trim()
                }
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
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  submitButton: {
    backgroundColor: '#F27121',
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#F27121',
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
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 5,
  },
  nextButton: {
    backgroundColor: '#8A2387',
    shadowColor: '#8A2387',
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
