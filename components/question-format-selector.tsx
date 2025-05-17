import { useQuizSetup } from '@/context/quiz-setup-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle, List, MessageSquare } from 'react-native-feather';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import GradientText from './gradient-text';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

export default function QuestionFormatSelector() {
  const { setup, setSetup } = useQuizSetup();
  const { questionFormat } = setup;
  const router = useRouter();
  const { quizType } = useLocalSearchParams();

  const handleSelect = (questionFormat: 'multiple' | 'short') => {
    setSetup((prev) => ({
      ...prev,
      questionFormat,
    }));
  };

  const multipleChoiceScale = useSharedValue(1);
  const shortAnswerScale = useSharedValue(1);

  const multipleChoiceAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: multipleChoiceScale.value }],
    };
  });

  const shortAnswerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: shortAnswerScale.value }],
    };
  });

  const handlePressIn = (questionFormat: 'multiple' | 'short') => {
    if (questionFormat === 'multiple') {
      multipleChoiceScale.value = withSpring(0.98);
    } else {
      shortAnswerScale.value = withSpring(0.98);
    }
  };

  const handlePressOut = (questionFormat: 'multiple' | 'short') => {
    if (questionFormat === 'multiple') {
      multipleChoiceScale.value = withSpring(1);
    } else {
      shortAnswerScale.value = withSpring(1);
    }
  };

  return (
    <View style={styles.container}>
      <GradientText text='문제 형식 선택' style={styles.title} />

      <View style={styles.optionsContainer}>
        <Animated.View
          style={[
            styles.optionCard,
            multipleChoiceAnimatedStyle,
            questionFormat === 'multiple' ? styles.selectedMultipleChoice : {},
          ]}
        >
          <TouchableOpacity
            style={styles.touchable}
            onPress={() => handleSelect('multiple')}
            onPressIn={() => handlePressIn('multiple')}
            onPressOut={() => handlePressOut('multiple')}
            activeOpacity={0.8}
          >
            {questionFormat === 'multiple' && (
              <View style={styles.checkIcon}>
                <CheckCircle width={20} height={20} color='#a855f7' />
              </View>
            )}
            <View style={styles.optionContent}>
              <LinearGradient
                colors={['#f472b6', '#a855f7']}
                style={styles.iconBackground}
              >
                <List width={24} height={24} color='white' />
              </LinearGradient>
              <Text style={styles.optionTitle}>객관식</Text>
              <Text style={styles.optionDescription}>
                여러 선택지 중에서 정답을 고르는 방식
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.optionCard,
            shortAnswerAnimatedStyle,
            questionFormat === 'short' ? styles.selectedShortAnswer : {},
          ]}
        >
          <TouchableOpacity
            style={styles.touchable}
            onPress={() => handleSelect('short')}
            onPressIn={() => handlePressIn('short')}
            onPressOut={() => handlePressOut('short')}
            activeOpacity={0.8}
          >
            {questionFormat === 'short' && (
              <View style={styles.checkIcon}>
                <CheckCircle width={20} height={20} color='#6366f1' />
              </View>
            )}
            <View style={styles.optionContent}>
              <LinearGradient
                colors={['#818cf8', '#3b82f6']}
                style={styles.iconBackground}
              >
                <MessageSquare width={24} height={24} color='white' />
              </LinearGradient>
              <Text style={styles.optionTitle}>주관식</Text>
              <Text style={styles.optionDescription}>
                직접 답변을 입력하는 방식
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[
          styles.nextButton,
          { opacity: questionFormat === null ? 0.5 : 1 },
        ]}
        activeOpacity={0.8}
        disabled={questionFormat === null}
        onPress={() => router.push(`/quiz/${quizType}/difficulty`)}
      >
        <LinearGradient
          colors={['#ec4899', '#a855f7', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nextButtonGradient}
        >
          <Text style={styles.nextButtonText}>다음</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#a855f7',
    marginBottom: 24,
  },
  optionsContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 16,
  },
  optionCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  selectedMultipleChoice: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(243, 232, 255, 0.5)',
  },
  selectedShortAnswer: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(224, 231, 255, 0.5)',
  },
  touchable: {
    width: '100%',
    padding: 24,
  },
  optionContent: {
    alignItems: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  nextButton: {
    marginTop: 24,
    alignSelf: 'center',
  },
  nextButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
});
