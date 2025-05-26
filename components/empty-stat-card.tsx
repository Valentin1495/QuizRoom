import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

export default function EmptyStatsCard({ delay = 0 }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1));
    opacity.value = withDelay(delay, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle]}>
      <LinearGradient
        colors={['#a8edea', '#fed6e3']}
        style={styles.emptyStatsCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons
          name='school-outline'
          size={48}
          color='#065f46'
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyTitle}>아직 데이터가 없어요!</Text>
        <Text style={styles.emptySubtitle}>
          첫 퀴즈를 완료하면{'\n'}여기에 멋진 통계가 나타날 거예요
        </Text>
        <View style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>첫 퀴즈 시작하기 🚀</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  emptyStatsCard: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#b83280',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#065f46',
    fontSize: 16,
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emptyButtonText: {
    color: '#b83280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
