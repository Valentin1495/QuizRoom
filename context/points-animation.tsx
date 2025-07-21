import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface PointsAnimationProps {
  points: number;
  visible: boolean;
  onComplete: () => void;
}

export function PointsAnimation({
  points,
  visible,
  onComplete,
}: PointsAnimationProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 0.8;

      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1.2, { damping: 10, stiffness: 100 });
      translateY.value = withSequence(
        withSpring(-30, { damping: 15, stiffness: 300 }),
        withTiming(-60, { duration: 1000 }, (finished) => {
          if (finished) {
            opacity.value = withTiming(0, { duration: 200 }, () => {
              runOnJS(onComplete)();
            });
          }
        })
      );
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.pointsText}>+{points}포인트</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // 더 밝고 세련된 반투명 흰색
    padding: 14,
    borderRadius: 14,
    shadowColor: '#FFD700', // 골드 그림자
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  pointsText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700', // 더 밝고 선명한 골드
    textShadowColor: 'rgba(255, 215, 0, 0.55)', // 더 밝은 골드 그림자
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 1,
  },
});
