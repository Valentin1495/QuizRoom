import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors } from '@/theme/tokens';
import * as Haptics from 'expo-haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 60;
const STROKE_WIDTH = 5;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  msTotal: number;
  msLeft: number;
};

export default function RadialTimer({ msTotal, msLeft }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const newProgress = msLeft > 0 ? msLeft / msTotal : 0;
    progress.value = withTiming(newProgress, { duration: 250 });

    if (msLeft > 0 && msLeft <= 5000) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [msLeft, msTotal]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const color = msLeft <= 5000 ? '#FF6B6B' : Colors.accent;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={Colors.card}
          strokeWidth={STROKE_WIDTH}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
  },
});