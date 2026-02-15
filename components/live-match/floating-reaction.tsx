import { useEffect } from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { runOnJS } from 'react-native-worklets';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TRAVEL_DISTANCE = SCREEN_HEIGHT * 0.35;

export type FloatingReactionProps = {
  id: string;
  emoji: string;
  x: number;
  duration: number;
  scale: number;
  wiggle: number;
  onComplete: (id: string) => void;
};

export function FloatingReaction({
  id,
  emoji,
  x,
  duration,
  scale: initialScale,
  wiggle,
  onComplete,
}: FloatingReactionProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      {
        duration,
        easing: Easing.out(Easing.quad),
      },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)(id);
        }
      }
    );
  }, [duration, id, onComplete, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [0, -TRAVEL_DISTANCE]);

    // Wiggle effect: sine wave motion
    const wigglePhase = progress.value * Math.PI * 2;
    const translateX = Math.sin(wigglePhase) * wiggle;

    // Scale animation: pop in, stay, then shrink
    const scale = interpolate(
      progress.value,
      [0, 0.15, 0.7, 1],
      [0.3, initialScale * 1.2, initialScale, initialScale * 0.6]
    );

    // Opacity: fade out near the end
    const opacity = interpolate(progress.value, [0, 0.1, 0.75, 1], [0, 1, 1, 0]);

    return {
      transform: [{ translateY }, { translateX }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.container, { left: x }, animatedStyle]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120,
  },
  emoji: {
    fontSize: 32,
    textAlign: 'center',
  },
});
