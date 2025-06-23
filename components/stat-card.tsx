import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ColorValue, Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  delay?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  delay = 0,
}: StatCardProps) {
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
        colors={color as [ColorValue, ColorValue, ...ColorValue[]]}
        style={styles.statCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.statCardHeader}>
          <Ionicons name={icon} size={24} color='white' />
          <Text style={styles.statCardTitle}>{title}</Text>
        </View>
        <Text style={styles.statCardValue}>{value}</Text>
        {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: (screenWidth - 60) / 2,
    margin: 10,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statCardTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    opacity: 0.9,
  },
  statCardValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statCardSubtitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
