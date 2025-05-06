import { Colors } from '@/constants/Colors';
import { Category, useQuizSetup } from '@/context/quiz-setup-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ColorValue,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  BookOpen,
  CheckCircle,
  Cpu,
  Film,
  Globe,
  Music,
  TrendingUp,
  Zap,
} from 'react-native-feather';
import Animated, {
  AnimatedStyle,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

export default function CategorySelector() {
  const { setup, setSetup } = useQuizSetup();
  const { category } = setup;
  const router = useRouter();

  const handleSelect = (category: Category) => {
    setSetup((prev) => ({ ...prev, category }));
  };

  // Category options configuration
  const categoryOptions = [
    {
      value: 'kpop-music' as Category,
      label: 'K-pop & 음악',
      icon: Music,
      colors: ['#f472b6', '#ec4899'],
    },
    {
      value: 'movies-drama' as Category,
      label: '영화 & 드라마',
      icon: Film,
      colors: ['#818cf8', '#6366f1'],
    },
    {
      value: 'world-knowledge' as Category,
      label: '세계 상식',
      icon: Globe,
      colors: ['#34d399', '#10b981'],
    },
    {
      value: 'trivia-tmi' as Category,
      label: '잡학 & TMI',
      icon: BookOpen,
      colors: ['#fb923c', '#f97316'],
    },
    {
      value: 'memes-trends' as Category,
      label: '인터넷 밈 & 트렌드',
      icon: TrendingUp,
      colors: ['#c084fc', '#a855f7'],
    },
    {
      value: 'sports' as Category,
      label: '스포츠',
      icon: Activity,
      colors: ['#60a5fa', '#3b82f6'],
    },
    {
      value: 'science-tech' as Category,
      label: '과학 & 테크',
      icon: Zap,
      colors: ['#4ade80', '#22c55e'],
    },
    {
      value: 'math-logic' as Category,
      label: '수학 & 논리',
      icon: Cpu,
      colors: ['#facc15', '#eab308'],
    },
  ];

  // Create animation values for each category
  const scaleValues = useRef(
    categoryOptions.reduce(
      (acc, category) => {
        acc[category.value] = useSharedValue(1);
        return acc;
      },
      {} as Record<Category, SharedValue<number>>
    )
  ).current;

  // Create animated styles for each category
  const animatedStyles = useRef(
    categoryOptions.reduce(
      (acc, category) => {
        acc[category.value] = useAnimatedStyle(() => ({
          transform: [{ scale: scaleValues[category.value].value }],
        }));
        return acc;
      },
      {} as Record<Category, AnimatedStyle<any>>
    )
  ).current;

  const handlePressIn = (category: Category) => {
    scaleValues[category].value = withSpring(0.95);
  };

  const handlePressOut = (category: Category) => {
    scaleValues[category].value = withSpring(1);
  };
  console.log(setup);
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {categoryOptions.map((c) => (
            <Animated.View
              key={c.value}
              style={[
                styles.categoryCard,
                animatedStyles[c.value],
                category === c.value && styles.selectedCard,
              ]}
            >
              <TouchableOpacity
                style={styles.touchable}
                onPress={() => handleSelect(c.value)}
                onPressIn={() => handlePressIn(c.value)}
                onPressOut={() => handlePressOut(c.value)}
                activeOpacity={0.8}
              >
                {category === c.value && (
                  <View style={styles.checkIcon}>
                    <CheckCircle
                      width={16}
                      height={16}
                      color={Colors.light.tint}
                    />
                  </View>
                )}
                <LinearGradient
                  colors={c.colors as [ColorValue, ColorValue, ...ColorValue[]]}
                  style={styles.iconBackground}
                >
                  <c.icon width={20} height={20} color='white' />
                </LinearGradient>
                <Text style={styles.categoryLabel}>{c.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextButton, { opacity: category === null ? 0.5 : 1 }]}
        activeOpacity={0.8}
        disabled={category === null}
        onPress={() => router.push('/(quiz)/type')}
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
    paddingBottom: 60,
    height: '100%',
  },
  scrollView: {
    width: '100%',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  categoryCard: {
    width: isTablet ? '48%' : '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  selectedCard: {
    borderColor: Colors.light.tint,
    backgroundColor: 'rgba(224, 231, 255, 0.5)',
  },
  touchable: {
    width: '100%',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
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
