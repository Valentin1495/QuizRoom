import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'react-native-feather';
import Animated, { FadeIn } from 'react-native-reanimated';

interface GamificationHUDProps {
  visible?: boolean;
  gamification: {
    totalPoints: number;
    level: number;
    streak: number;
    pointsToNextLevel: number;
  };
}

export function GamificationHUD({
  visible = true,
  gamification,
}: GamificationHUDProps) {
  const { totalPoints, level, streak, pointsToNextLevel } = gamification;

  if (!visible) return null;

  return (
    <>
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <View style={styles.hudRow}>
          {/* 포인트 */}
          <View style={styles.statContainer}>
            <Star width={16} height={16} color='#FFD700' />
            <Text style={styles.statValue}>{totalPoints.toLocaleString()}</Text>
          </View>

          {/* 레벨 */}
          <View style={styles.statContainer}>
            <Ionicons name='diamond-outline' size={16} color='#FF6B6B' />
            <Text style={styles.statValue}>Lv.{level}</Text>
          </View>

          {/* 스트릭 */}
          <View style={styles.statContainer}>
            <Ionicons name='flame-outline' size={16} color='#FF4757' />
            <Text style={styles.statValue}>{streak}</Text>
          </View>
        </View>

        {/* 레벨 진행도 */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {pointsToNextLevel.toLocaleString()}포인트 to Lv.{level + 1}
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    zIndex: 1000,
  },
  hudRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    color: Colors.light.primary,
    fontSize: 12,
    marginTop: 4,
  },
});
