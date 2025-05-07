import { Doc } from '@/convex/_generated/dataModel';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from 'react-native-feather';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

type QuizScreenProps = {
  questions: Doc<'quizzes'>[];
  onComplete?: (results: QuizResult[]) => void;
  onExit?: () => void;
};

type QuizResult = {
  questionId: string;
  userAnswer: string | null;
  correct: boolean;
  question: string;
  correctAnswer: string;
};

export default function QuizContentScreen({
  questions,
  onComplete,
  onExit,
}: QuizScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);

  // 애니메이션 값
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.8);
  const progressWidth = useSharedValue(0);

  // 현재 문제
  const currentQuestion = questions[currentIndex];

  // 컴포넌트 마운트 시 애니메이션 시작
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 500 });
    cardScale.value = withSpring(1);
    updateProgressBar();
  }, []);

  // 현재 인덱스가 변경될 때마다 애니메이션 및 상태 초기화
  useEffect(() => {
    cardOpacity.value = 0;
    cardScale.value = 0.8;

    // 약간의 지연 후 새 문제 표시
    setTimeout(() => {
      cardOpacity.value = withTiming(1, { duration: 500 });
      cardScale.value = withSpring(1);
    }, 100);

    setSelectedOption(null);
    setIsAnswered(false);
    setShowFeedback(false);
    updateProgressBar();
  }, [currentIndex]);

  // 진행 상태 바 업데이트
  const updateProgressBar = () => {
    const progress = (currentIndex + 1) / questions.length;
    progressWidth.value = withTiming(progress, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  };

  // 애니메이션 스타일
  const cardAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: cardOpacity.value,
      transform: [{ scale: cardScale.value }],
    };
  });

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value * 100}%`,
    };
  });

  // 옵션 선택 처리
  const handleSelectOption = (option: string) => {
    if (isAnswered) return;

    setSelectedOption(option);
    setIsAnswered(true);

    // 결과 저장
    const isCorrect = option === currentQuestion.answer;
    const result: QuizResult = {
      questionId: currentQuestion._id,
      userAnswer: option,
      correct: isCorrect,
      question: currentQuestion.question,
      correctAnswer: currentQuestion.answer,
    };

    setResults([...results, result]);
    setShowFeedback(true);
  };

  // 다음 문제로 이동
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // 모든 문제 완료
      if (onComplete) {
        onComplete(results);
      }
    }
  };

  // 이전 문제로 이동
  const handlePrevious = () => {
    if (currentIndex > 0) {
      // 이전 결과 제거
      const newResults = [...results];
      newResults.pop();
      setResults(newResults);

      setCurrentIndex(currentIndex - 1);
    }
  };

  // 건너뛰기 처리
  const handleSkip = () => {
    const result: QuizResult = {
      questionId: currentQuestion._id,
      userAnswer: null,
      correct: false,
      question: currentQuestion.question,
      correctAnswer: currentQuestion.answer,
    };

    setResults([...results, result]);
    handleNext();
  };

  // 옵션 버튼 렌더링
  const renderOption = (option: string, index: number) => {
    const isSelected = selectedOption === option;
    const isCorrect = currentQuestion.answer === option;

    let backgroundColor = 'white';
    let borderColor = '#e5e7eb';

    if (showFeedback) {
      if (isCorrect) {
        backgroundColor = 'rgba(220, 252, 231, 0.5)'; // 연한 초록색
        borderColor = '#22c55e'; // 진한 초록색
      } else if (isSelected && !isCorrect) {
        backgroundColor = 'rgba(254, 226, 226, 0.5)'; // 연한 빨간색
        borderColor = '#ef4444'; // 진한 빨간색
      }
    } else if (isSelected) {
      backgroundColor = 'rgba(224, 231, 255, 0.5)'; // 연한 보라색
      borderColor = '#6366f1'; // 진한 보라색
    }

    return (
      <TouchableOpacity
        key={index}
        style={[styles.optionButton, { backgroundColor, borderColor }]}
        onPress={() => handleSelectOption(option)}
        disabled={isAnswered}
        activeOpacity={0.8}
      >
        <Text style={styles.optionText}>{option}</Text>

        {showFeedback && isCorrect && (
          <View style={styles.feedbackIcon}>
            <Check width={20} height={20} color='#22c55e' />
          </View>
        )}

        {showFeedback && isSelected && !isCorrect && (
          <View style={styles.feedbackIcon}>
            <X width={20} height={20} color='#ef4444' />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 바 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <ChevronLeft width={24} height={24} color='#6b7280' />
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <Animated.View
              style={[styles.progressBar, progressAnimatedStyle]}
            />
          </View>
          <Text style={styles.progressText}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>
      </View>

      {/* 문제 카드 */}
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>
        </View>

        <View style={styles.optionsContainer}>
          {currentQuestion.options?.map(renderOption)}
        </View>

        {showFeedback && (
          <View style={styles.feedbackContainer}>
            {selectedOption === currentQuestion.answer ? (
              <Text style={styles.correctText}>정답입니다!</Text>
            ) : (
              <View style={styles.incorrectContainer}>
                <AlertCircle width={16} height={16} color='#ef4444' />
                <Text style={styles.incorrectText}>
                  정답은{' '}
                  <Text style={styles.correctAnswerText}>
                    {currentQuestion.answer}
                  </Text>{' '}
                  입니다.
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        {currentIndex > 0 && (
          <TouchableOpacity style={styles.navButton} onPress={handlePrevious}>
            <ChevronLeft width={20} height={20} color='#6b7280' />
            <Text style={styles.navButtonText}>이전</Text>
          </TouchableOpacity>
        )}

        <View style={styles.footerSpacer} />

        {!isAnswered ? (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>건너뛰기</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <LinearGradient
              colors={['#ec4899', '#a855f7', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>
                {currentIndex < questions.length - 1 ? '다음' : '결과 보기'}
              </Text>
              <ChevronRight width={20} height={20} color='white' />
            </LinearGradient>
          </TouchableOpacity>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  exitButton: {
    padding: 8,
  },
  progressContainer: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 8,
  },
  card: {
    flex: 1,
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    lineHeight: 28,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  feedbackIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  correctText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    textAlign: 'center',
  },
  incorrectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incorrectText: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 4,
  },
  correctAnswerText: {
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  navButtonText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  footerSpacer: {
    flex: 1,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  nextButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 4,
  },
});
