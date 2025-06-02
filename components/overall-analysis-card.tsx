import { switchCategoryKey } from '@/utils/switch-category-key';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

// 카테고리 점수 정보
interface CategoryScore {
  category: string;
  skillScore: number;
}

// 종합 분석 데이터
interface OverallAnalysis {
  strongestCategories: CategoryScore[];
  weakestCategories: CategoryScore[];
}

interface OverallAnalysisCardProps {
  analysis: OverallAnalysis;
}

export default function OverallAnalysisCard({
  analysis,
}: OverallAnalysisCardProps) {
  return (
    <View style={styles.overallCard}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.overallGradient}
      >
        <Text style={styles.overallTitle}>종합 실력 분석</Text>

        {/* 강점 분야 */}
        <View style={styles.analysisSection}>
          <Text style={styles.sectionTitle}>🏆 강점 분야</Text>
          {analysis.strongestCategories.slice(0, 2).map((cat, index) => (
            <View
              key={`strong-${cat.category}-${index}`}
              style={styles.categoryItem}
            >
              <Text style={styles.categoryItemText}>
                {switchCategoryKey(cat.category)} ({Math.round(cat.skillScore)}
                점)
              </Text>
            </View>
          ))}
        </View>

        {/* 개선 필요 분야 */}
        <View style={styles.analysisSection}>
          <Text style={styles.sectionTitle}>📈 개선 필요 분야</Text>
          {analysis.weakestCategories.slice(0, 2).map((cat, index) => (
            <View
              key={`weak-${cat.category}-${index}`}
              style={styles.categoryItem}
            >
              <Text style={styles.categoryItemText}>
                {switchCategoryKey(cat.category)} ({Math.round(cat.skillScore)}
                점)
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overallCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overallGradient: {
    padding: 20,
  },
  overallTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  analysisSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  categoryItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 5,
  },
  categoryItemText: {
    color: 'white',
    fontSize: 14,
  },
});
