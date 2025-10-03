import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';

type Props = {
  visible: boolean;
  currentScore: number;
  onConfirm: () => void;
  onDecline: () => void;
};

const AnimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

export default function DoubleDownModal({ visible, currentScore, onConfirm, onDecline }: Props) {
  const backdropOpacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0.8, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      <AnimatedBlurView
        intensity={10}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, animatedBackdropStyle]}
      />
      <View style={styles.container}>
        <Reanimated.View style={[styles.card, animatedCardStyle]}>
          <Text style={styles.title}>더블다운!</Text>
          <Text style={styles.description}>
            마지막 한 문제! 성공 시 최종 점수가 <Text style={styles.highlight}>2배</Text>가 되고, 실패 시 <Text style={styles.highlight}>0점</Text>이 됩니다.
          </Text>
          <Text style={styles.scoreInfo}>현재 점수: {currentScore}</Text>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.declineButton]} onPress={onDecline}>
              <Text style={[styles.buttonText, styles.declineButtonText]}>이대로 끝내기</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
              <Text style={styles.buttonText}>도전하기!</Text>
            </Pressable>
          </View>
        </Reanimated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: 'rgba(30, 30, 40, 0.8)',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    ...Typography.h1,
    color: Colors.accent,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    color: Colors.subtext,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    fontSize: 16,
    lineHeight: 24,
  },
  highlight: {
    color: Colors.text,
    fontWeight: 'bold',
  },
  scoreInfo: {
    ...Typography.body,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.xl,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.subtext,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.text,
  },
  declineButtonText: {
    color: Colors.subtext,
  },
});
