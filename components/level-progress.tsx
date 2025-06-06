import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
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

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(currentExp / nextLevelExp));
    scale.value = withDelay(delay, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [0, screenWidth - 80]);
    return {
      width,
    };
  });

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

      <View style={styles.levelProgressContainer}>
        <View style={styles.levelProgressBackground}>
          <Animated.View style={[progressStyle]}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.levelProgressBar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  levelContainer: {
    marginHorizontal: 20,
    marginVertical: 30,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  levelBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  levelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelExp: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  levelProgressContainer: {
    marginTop: 10,
  },
  levelProgressBackground: {
    height: 8,
    backgroundColor: '#e8eaf6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
});
