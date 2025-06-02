import { switchCategoryKey } from '@/utils/switch-category-key';
import { StyleSheet, Text, View } from 'react-native';

type Difficulty = 'easy' | 'medium' | 'hard';

interface QuizRecommendation {
  category: string;
  recommendedDifficulty: Difficulty;
  reason: string;
  priority: number;
  currentAccuracy: number;
}

export default function QuizRecommendationCard({
  recommendations,
}: {
  recommendations: QuizRecommendation[];
}) {
  return (
    <View style={styles.recommendationCard}>
      <Text style={styles.recommendationCardTitle}>🎯 맞춤 퀴즈 추천</Text>
      {recommendations.slice(0, 3).map((rec, index) => (
        <View
          key={`rec-${rec.category}-${index}`}
          style={styles.recommendationItem}
        >
          <View style={styles.recommendationHeader}>
            <Text style={styles.recommendationCategory}>
              {switchCategoryKey(rec.category)}
            </Text>
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor:
                    rec.priority >= 3
                      ? '#ff6b6b'
                      : rec.priority >= 2
                        ? '#feca57'
                        : '#48dbfb',
                },
              ]}
            >
              <Text style={styles.priorityText}>
                {rec.priority >= 3
                  ? '긴급'
                  : rec.priority >= 2
                    ? '권장'
                    : '보통'}
              </Text>
            </View>
          </View>
          <Text style={styles.recommendationReason}>{rec.reason}</Text>
          <Text style={styles.recommendationAccuracy}>
            현재 정확도: {rec.currentAccuracy}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  recommendationCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  recommendationCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  recommendationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  recommendationCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationReason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  recommendationAccuracy: {
    fontSize: 12,
    color: '#999',
  },
});
