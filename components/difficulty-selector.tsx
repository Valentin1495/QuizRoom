import { Difficulty, useQuizSetup } from '@/context/quiz-setup-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ColorValue,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Award, CheckCircle, Coffee, Zap } from 'react-native-feather';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import GradientText from './gradient-text';

const { width } = Dimensions.get('window');

export default function DifficultySelector() {
  const { setup, setSetup } = useQuizSetup();
  const { difficulty } = setup;
  const router = useRouter();
  const { quizType } = useLocalSearchParams();

  const handleSelect = (difficulty: Difficulty) => {
    setSetup((prev) => ({
      ...prev,
      difficulty,
    }));
  };

  // Animation values for each difficulty option
  const scaleValues = {
    easy: useSharedValue(1),
    medium: useSharedValue(1),
    hard: useSharedValue(1),
    // expert: useSharedValue(1),
  };

  // Create animated styles for each option
  const animatedStyles = {
    easy: useAnimatedStyle(() => ({
      transform: [{ scale: scaleValues.easy.value }],
    })),
    medium: useAnimatedStyle(() => ({
      transform: [{ scale: scaleValues.medium.value }],
    })),
    hard: useAnimatedStyle(() => ({
      transform: [{ scale: scaleValues.hard.value }],
    })),
    // expert: useAnimatedStyle(() => ({
    //   transform: [{ scale: scaleValues.expert.value }],
    // })),
  };

  const handlePressIn = (difficulty: Difficulty) => {
    scaleValues[difficulty!].value = withSpring(0.98);
  };

  const handlePressOut = (difficulty: Difficulty) => {
    scaleValues[difficulty!].value = withSpring(1);
  };

  // Difficulty options configuration
  const difficultyOptions = [
    {
      value: 'easy' as Difficulty,
      label: '쉬움',
      description: '기본적인 지식을 테스트하는 간단한 문제',
      icon: Coffee,
      colors: ['#4ade80', '#22c55e'],
      selectedStyle: styles.selectedEasy,
    },
    {
      value: 'medium' as Difficulty,
      label: '보통',
      description: '약간의 도전이 필요한 중간 난이도 문제',
      icon: Zap,
      colors: ['#60a5fa', '#3b82f6'],
      selectedStyle: styles.selectedMedium,
    },
    {
      value: 'hard' as Difficulty,
      label: '어려움',
      description: '깊은 이해가 필요한 고난도 문제',
      icon: Award,
      colors: ['#f472b6', '#ec4899'],
      selectedStyle: styles.selectedHard,
    },
    // {
    //   value: "expert" as Difficulty,
    //   label: "전문가",
    //   description: "전문적인 지식이 필요한 최고 난이도 문제",
    //   icon: Flame,
    //   colors: ["#fb7185", "#e11d48"],
    //   selectedStyle: styles.selectedExpert,
    // },
  ];

  return (
    <View style={styles.container}>
      <GradientText text='난이도 선택' style={styles.title} />

      <View style={styles.optionsContainer}>
        {difficultyOptions.map((option) => (
          <Animated.View
            key={option.value}
            style={[
              styles.optionCard,
              animatedStyles[option.value!],
              difficulty === option.value ? option.selectedStyle : {},
            ]}
          >
            <TouchableOpacity
              style={styles.touchable}
              onPress={() => handleSelect(option.value)}
              onPressIn={() => handlePressIn(option.value)}
              onPressOut={() => handlePressOut(option.value)}
              activeOpacity={0.8}
            >
              {difficulty === option.value && (
                <View style={styles.checkIcon}>
                  <CheckCircle
                    width={20}
                    height={20}
                    color={option.colors[1]}
                  />
                </View>
              )}
              <View style={styles.optionContent}>
                <LinearGradient
                  colors={
                    option.colors as [ColorValue, ColorValue, ...ColorValue[]]
                  }
                  style={styles.iconBackground}
                >
                  <option.icon width={24} height={24} color='white' />
                </LinearGradient>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, { opacity: difficulty === null ? 0.5 : 1 }]}
        activeOpacity={0.8}
        disabled={difficulty === null}
        onPress={() => router.push(`/quiz/${quizType}/question`)}
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
  selectedEasy: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(220, 252, 231, 0.5)',
  },
  selectedMedium: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(219, 234, 254, 0.5)',
  },
  selectedHard: {
    borderColor: '#ec4899',
    backgroundColor: 'rgba(252, 231, 243, 0.5)',
  },
  selectedExpert: {
    borderColor: '#e11d48',
    backgroundColor: 'rgba(254, 226, 226, 0.5)',
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
