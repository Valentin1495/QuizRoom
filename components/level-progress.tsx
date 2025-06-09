import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

interface LevelProgressProps {
  currentLevel: number;
  currentExp: number;
  nextLevelExp: number;
  delay?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function LevelProgress({
  currentLevel,
  currentExp,
  nextLevelExp,
  delay = 0,
}: LevelProgressProps) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(0);

  const ratio = currentExp / (currentExp + nextLevelExp);
  const percentage = Math.min(Math.round(ratio * 100), 100);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(ratio));
    scale.value = withDelay(delay, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const percentageStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  let percentageColor = '#bdc3c7';
  let percentageExtra = '✨ 시작이 멋져요';

  if (percentage >= 95) {
    percentageColor = '#f39c12';
    percentageExtra = '🚀 마지막 한 걸음!';
  } else if (percentage >= 90) {
    percentageColor = '#e67e22';
    percentageExtra = '🔥 집중력 폭발 중!';
  } else if (percentage >= 70) {
    percentageColor = '#27ae60';
    percentageExtra = '💚 꾸준히 성장 중';
  } else if (percentage >= 50) {
    percentageColor = '#3498db';
    percentageExtra = '💙 중반 돌파!';
  } else if (percentage >= 20) {
    percentageColor = '#9b59b6';
    percentageExtra = '💫 시작이 반!';
  } else {
    percentageColor = '#95a5a6';
    percentageExtra = '🌱 첫걸음 응원해요';
  }

  return (
    <Animated.View style={[styles.levelContainer, animatedStyle]}>
      <View style={styles.levelHeader}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv.{currentLevel}</Text>
        </View>
        <Text style={styles.levelExp}>
          {currentExp}/{currentExp + nextLevelExp}점 ({nextLevelExp}점 to Lv.
          {currentLevel + 1})
        </Text>
      </View>

      <Animated.Text
        style={[
          styles.percentageText,
          { color: percentageColor },
          percentageStyle,
        ]}
      >
        {percentage}% {percentageExtra}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  levelContainer: {
    marginHorizontal: 20,
    marginVertical: 30,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelBadge: {
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  levelText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelExp: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  percentageText: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },
});
