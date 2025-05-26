import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

export default function EmptyCategoryStats({ delay = 0 }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1));
    translateY.value = withDelay(delay, withSpring(0));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.emptyCategoryContainer, animatedStyle]}>
      <View style={styles.emptyCategoryIcon}>
        <Ionicons name='bar-chart-outline' size={64} color='#e0e0e0' />
      </View>
      <Text style={styles.emptyCategoryTitle}>
        카테고리 분석을 기다리고 있어요
      </Text>
      <Text style={styles.emptyCategorySubtitle}>
        다양한 카테고리의 퀴즈를 풀어보세요!{'\n'}각 분야별 실력을
        분석해드릴게요
      </Text>

      {/* Preview of what categories might look like */}
      <View style={styles.previewCategories}>
        {[
          '일반상식',
          '과학 & 기술',
          '역사 & 문화',
          'K-pop & 음악',
          '예술 & 문학',
          '스포츠',
          '영화 & TV',
          '수학 & 논리',
        ].map((category, index) => (
          <View key={category} style={styles.previewCategory}>
            <View style={styles.previewCategoryBar}>
              <View
                style={[
                  styles.previewCategoryProgress,
                  { width: `${(index + 1) * 10}%` },
                ]}
              />
            </View>
            <Text style={styles.previewCategoryName}>{category}</Text>
            <Text style={styles.previewCategoryText}>0/0 문제</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  emptyCategoryContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCategoryIcon: {
    marginBottom: 20,
  },
  emptyCategoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyCategorySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  previewCategories: {
    width: '100%',
  },
  previewCategory: {
    marginBottom: 16,
  },
  previewCategoryBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  previewCategoryProgress: {
    height: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
  },
  previewCategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
    marginBottom: 4,
  },
  previewCategoryText: {
    fontSize: 14,
    color: '#aaa',
  },
});
