import { UpdatedKnowledgeCategory } from '@/app/(tabs)/analysis';
import { Doc } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

// 난이도 타입
type Difficulty = 'easy' | 'medium' | 'hard';

// 스킬 레벨 타입
type SkillLevel =
  | 'beginner'
  | 'novice'
  | 'intermediate'
  | 'advanced'
  | 'expert';

// 난이도별 통계 데이터
interface DifficultyStats {
  total: number;
  correct: number;
  accuracy: number;
  avgTime?: number; // 밀리초 단위
}

// 스킬 레벨 정보 타입 (내부 사용)
interface SkillLevelInfo {
  text: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// 카테고리 맵 타입
type CategoryDisplayMap = {
  [key in UpdatedKnowledgeCategory]: string;
};

// 스킬 레벨 맵 타입
type SkillLevelMap = {
  [key in SkillLevel]: SkillLevelInfo;
};

// 난이도 색상 맵 타입
type DifficultyColorMap = {
  [key in Difficulty]: string;
};

// 컴포넌트 Props 타입
interface DifficultyAnalysisCardProps {
  category: UpdatedKnowledgeCategory;
  stats: Doc<'categoryStats'>;
  delay?: number;
}

export default function DifficultyAnalysisCard({
  category,
  stats,
  delay = 0,
}: DifficultyAnalysisCardProps) {
  const [expanded, setExpanded] = useState<boolean>(false);

  const getCategoryDisplayName = useCallback(
    (category: UpdatedKnowledgeCategory): string => {
      const categoryMap: CategoryDisplayMap = {
        'knowledge-history-culture': '역사 & 문화',
        'knowledge-science-tech': '과학 & 기술',
        'knowledge-kpop-music': 'K-pop & 음악',
        'knowledge-arts-literature': '예술 & 문학',
        'knowledge-sports': '스포츠',
        'knowledge-entertainment': '영화 & TV',
        'knowledge-general': '일반 상식',
        'knowledge-math-logic': '수학 & 논리',
        // 기존 매핑도 유지 (하위 호환성)
        'history-culture': '역사 & 문화',
        'science-tech': '과학 & 기술',
        'kpop-music': 'K-pop & 음악',
        'arts-literature': '예술 & 문학',
        sports: '스포츠',
        entertainment: '영화 & TV',
        general: '일반 상식',
        'math-logic': '수학 & 논리',
      };
      return categoryMap[category] || category; // fallback으로 원본 카테고리명 반환
    },
    []
  );

  const getSkillLevelInfo = useCallback((level: SkillLevel): SkillLevelInfo => {
    const levelMap: SkillLevelMap = {
      beginner: { text: '입문자', color: '#ff6b6b', icon: 'leaf-outline' },
      novice: { text: '초보자', color: '#feca57', icon: 'flower-outline' },
      intermediate: {
        text: '중급자',
        color: '#48dbfb',
        icon: 'partly-sunny-outline',
      },
      advanced: { text: '고급자', color: '#0be881', icon: 'sunny-outline' },
      expert: { text: '전문가', color: '#8c7ae6', icon: 'diamond-outline' },
    };
    return levelMap[level];
  }, []);

  const getDifficultyColor = useCallback((difficulty: Difficulty): string => {
    const colorMap: DifficultyColorMap = {
      easy: '#0be881',
      medium: '#feca57',
      hard: '#ff6b6b',
    };
    return colorMap[difficulty];
  }, []);

  const getDifficultyDisplayName = useCallback(
    (difficulty: Difficulty): string => {
      const displayMap = {
        easy: '쉬움',
        medium: '보통',
        hard: '어려움',
      } as const;
      return displayMap[difficulty];
    },
    []
  );

  const getRecommendedDifficultyDisplayName = useCallback(
    (difficulty: Difficulty): string => {
      const displayMap = {
        easy: '쉬움',
        medium: '보통',
        hard: '어려움',
      } as const;
      return displayMap[difficulty];
    },
    []
  );

  const skillLevelInfo = getSkillLevelInfo(stats.skillLevel);
  const overallAccuracy = Math.round(
    (stats.correctAnswers / stats.totalQuestions) * 100
  );

  // expanded가 true가 될 때 데이터 구조 확인
  const handleExpand = () => {
    // console.log('Stats data:', stats);
    // console.log('Difficulty stats:', stats.difficultyStats);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.analysisCard, { opacity: delay > 0 ? 0 : 1 }]}>
      <LinearGradient
        colors={['#ffffff', '#f8f9ff']}
        style={styles.cardGradient}
      >
        {/* 카테고리 헤더 */}
        <TouchableOpacity onPress={handleExpand} style={styles.cardHeader}>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>
              {getCategoryDisplayName(category)}
            </Text>
            <View style={styles.skillBadge}>
              <Ionicons
                name={skillLevelInfo.icon}
                size={14}
                color={skillLevelInfo.color}
              />
              <Text
                style={[styles.skillLevel, { color: skillLevelInfo.color }]}
              >
                {skillLevelInfo.text}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.overallAccuracy}>{overallAccuracy}%</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color='#666'
            />
          </View>
        </TouchableOpacity>

        {/* 난이도별 상세 통계 */}
        {expanded && (
          <View style={styles.detailsContainer}>
            {stats.difficultyStats &&
              (
                Object.entries(stats.difficultyStats) as [
                  Difficulty,
                  DifficultyStats,
                ][]
              ).map(([difficulty, diffStats]) => {
                const avgTimeInSeconds = diffStats.avgTime
                  ? Math.round(diffStats.avgTime / 1000)
                  : 0;

                return (
                  <View key={difficulty} style={styles.difficultyRow}>
                    <View style={styles.difficultyInfo}>
                      <View
                        style={[
                          styles.difficultyBadge,
                          { backgroundColor: getDifficultyColor(difficulty) },
                        ]}
                      >
                        <Text style={styles.difficultyText}>
                          {getDifficultyDisplayName(difficulty)}
                        </Text>
                      </View>
                      <Text style={styles.difficultyStats}>
                        {diffStats.correct}/{diffStats.total}
                      </Text>
                    </View>

                    {/* 진행률 바 */}
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${diffStats.accuracy}%`,
                              backgroundColor: getDifficultyColor(difficulty),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.accuracyText}>
                        {Math.round(diffStats.accuracy)}%
                      </Text>
                    </View>

                    {/* 평균 시간 */}
                    {avgTimeInSeconds > 0 && (
                      <Text style={styles.avgTime}>
                        평균 {avgTimeInSeconds}초
                      </Text>
                    )}
                  </View>
                );
              })}

            {/* 추천 사항 */}
            {stats.recommendedDifficulty && (
              <View style={styles.recommendationContainer}>
                <Ionicons name='bulb-outline' size={16} color='#666' />
                <Text style={styles.recommendationText}>
                  다음 추천 난이도:{' '}
                  {getRecommendedDifficultyDisplayName(
                    stats.recommendedDifficulty
                  )}
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  categorySection: {
    paddingHorizontal: 20,
  },
  analysisCard: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skillLevel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  headerRight: {
    alignItems: 'center',
  },
  overallAccuracy: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  detailsContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  difficultyRow: {
    marginBottom: 12,
  },
  difficultyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyStats: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    minWidth: 40,
  },
  avgTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  recommendationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
});
