import { switchCategoryKey } from '@/utils/switch-category-key';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ColorValue, Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { MasteryLevelBadge } from './mastery-level-display';

interface CategoryStat {
  totalQuestions: number;
  correctAnswers: number;
  masteryLevel: number;
}

interface CategoryBarProps {
  category: string;
  stats: CategoryStat;
  delay?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function CategoryBar({
  category,
  stats,
  delay = 0,
}: CategoryBarProps) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(stats.masteryLevel / 100));
    opacity.value = withDelay(delay, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [0, screenWidth - 80]);
    return {
      width,
    };
  });

  const accuracy = Math.round(
    (stats.correctAnswers / stats.totalQuestions) * 100
  );

  const getBarColor = () => {
    if (stats.masteryLevel >= 80) return ['#4CAF50', '#66BB6A'];
    if (stats.masteryLevel >= 65) return ['#FF9800', '#FFB74D'];
    return ['#F44336', '#EF5350'];
  };

  return (
    <Animated.View style={[styles.categoryContainer, animatedStyle]}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{switchCategoryKey(category)}</Text>
        <View style={styles.categoryStats}>
          <Text style={styles.categoryAccuracy}>{accuracy}%</Text>
          <MasteryLevelBadge score={Math.floor(stats.masteryLevel / 10)} />
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[progressStyle]}>
            <LinearGradient
              colors={
                getBarColor() as [ColorValue, ColorValue, ...ColorValue[]]
              }
              style={styles.progressBar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
      </View>

      <Text style={styles.categoryDetails}>
        {stats.correctAnswers}/{stats.totalQuestions} 문제 정답
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  categoryContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryAccuracy: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 12,
  },
  categoryLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },

  categoryDetails: {
    fontSize: 14,
    color: '#888',
  },
});
