import { Achievement } from '@/context/gamification-context';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onComplete: () => void;
}

export function AchievementNotification({ achievement, onComplete }: AchievementNotificationProps) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (achievement) {
      translateY.value = -100;
      opacity.value = 0;
      scale.value = 0.9;

      translateY.value = withSpring(0, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 10, stiffness: 100 });

      // 3초 후 사라짐
      setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 }, () => {
          runOnJS(onComplete)();
        });
      }, 3000);
    }
  }, [achievement]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!achievement) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.achievementCard}>
        <Text style={styles.achievementIcon}>{achievement.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.achievementTitle}>업적 달성!</Text>
          <Text style={styles.achievementName}>{achievement.title}</Text>
          <Text style={styles.achievementDescription}>{achievement.description}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  achievementCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  achievementIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  achievementName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
  },
});
