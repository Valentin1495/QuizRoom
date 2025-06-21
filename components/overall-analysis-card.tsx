import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

interface GrowthTrend {
  last7Days: number;
  last30Days: number;
  isImproving: boolean;
}

interface CategorySummary {
  category: string;
  skillLevel: string;
  skillScore: number;
  overallAccuracy: number;
  geminiSummary?: string;
  geminiSuggestions?: string[];
  growthTrend?: GrowthTrend;
}

interface SkillSummaryCardProps {
  categories: CategorySummary[];
}

const tierColors: Record<string, string> = {
  Iron: '#7f8c8d',
  Bronze: '#cd7f32',
  Silver: '#bdc3c7',
  Gold: '#f1c40f',
  Platinum: '#3498db',
  Diamond: '#9b59b6',
};

const SkillSummaryCard: React.FC<SkillSummaryCardProps> = ({ categories }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧠 실력 요약</Text>
      {categories.map((cat) => {
        const color = tierColors[cat.skillLevel] || '#ccc';
        return (
          <LinearGradient
            key={cat.category}
            colors={['#ffffff', color]}
            style={styles.card}
          >
            <Text style={styles.category}>{cat.category}</Text>
            <Text style={styles.tier}>
              🎖️ 티어:{' '}
              <Text style={{ fontWeight: 'bold' }}>{cat.skillLevel}</Text> ・
              정확도: {cat.overallAccuracy}%
            </Text>
            <Text style={styles.score}>📊 Skill Score: {cat.skillScore}</Text>

            {cat.geminiSummary && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔍 분석 요약</Text>
                <Text style={styles.summaryText}>{cat.geminiSummary}</Text>
              </View>
            )}

            {cat.geminiSuggestions && cat.geminiSuggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📌 개선 제안</Text>
                {cat.geminiSuggestions.map((sug, idx) => (
                  <Text key={idx} style={styles.bullet}>
                    • {sug}
                  </Text>
                ))}
              </View>
            )}

            {cat.growthTrend && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📈 최근 성장 추세</Text>
                <Text style={styles.growthText}>
                  7일 변화: {cat.growthTrend.last7Days}% ・ 30일 변화:{' '}
                  {cat.growthTrend.last30Days}%
                </Text>
                <Text
                  style={{
                    color: cat.growthTrend.isImproving ? '#27ae60' : '#e74c3c',
                  }}
                >
                  {cat.growthTrend.isImproving
                    ? '🚀 실력이 향상되고 있어요!'
                    : '⚠️ 실력 유지 또는 하락 중입니다'}
                </Text>
              </View>
            )}
          </LinearGradient>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#2c3e50',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  category: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#34495e',
  },
  tier: {
    fontSize: 14,
    color: '#2d3436',
    marginBottom: 2,
  },
  score: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  section: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 13,
    color: '#2c3e50',
  },
  bullet: {
    fontSize: 13,
    marginLeft: 8,
    color: '#34495e',
  },
  growthText: {
    fontSize: 13,
    color: '#34495e',
  },
});

export default SkillSummaryCard;
