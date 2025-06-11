import { Doc } from '@/convex/_generated/dataModel';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// 타입 정의
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
type Category =
  | 'basic'
  | 'streak'
  | 'accuracy'
  | 'progress'
  | 'mastery'
  | 'special'
  | 'speed';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: Category;
  rarity: Rarity;
}

interface CategoryFilter {
  id: string;
  label: string;
}

interface RarityColor {
  primary: string;
  secondary: string;
}

interface AchievementBadgeProps {
  achievement: Achievement;
  userProgress?: Doc<'achievements'>;
  onPress: (achievement: Achievement) => void;
  animatedValue: Animated.Value;
}

interface CategoryFilterProps {
  categories: CategoryFilter[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
}

interface AchievementModalProps {
  achievement: Achievement | null;
  userProgress?: Doc<'achievements'>;
  visible: boolean;
  onClose: () => void;
}

type AchievementListProps = {
  userAchievements?: Doc<'achievements'>[];
};

const defaultAchievements: Achievement[] = [
  {
    id: 'first_quiz',
    title: '첫 걸음',
    description: '첫 번째 퀴즈 완료',
    icon: '🏁',
    category: 'basic',
    rarity: 'common',
  },
  {
    id: 'streak_3',
    title: '시작이 반',
    description: '3일 연속 퀴즈 풀기',
    icon: '🔥',
    category: 'streak',
    rarity: 'common',
  },
  {
    id: 'streak_7',
    title: '꾸준히 하기',
    description: '7일 연속 퀴즈 풀기',
    icon: '🔥',
    category: 'streak',
    rarity: 'uncommon',
  },
  {
    id: 'streak_30',
    title: '월간 도전자',
    description: '30일 연속 퀴즈 풀기',
    icon: '🚀',
    category: 'streak',
    rarity: 'rare',
  },
  {
    id: 'perfect_quiz',
    title: '완벽주의자',
    description: '퀴즈에서 모든 문제 정답',
    icon: '🎯',
    category: 'accuracy',
    rarity: 'uncommon',
  },
  {
    id: 'perfect_streak_5',
    title: '완벽한 연승',
    description: '5번 연속으로 완벽한 점수 달성',
    icon: '💫',
    category: 'accuracy',
    rarity: 'epic',
  },
  {
    id: 'accuracy_king',
    title: '정확도 왕',
    description: '전체 정답률 95% 이상 달성',
    icon: '👑',
    category: 'accuracy',
    rarity: 'legendary',
  },
  {
    id: 'quiz_beginner',
    title: '퀴즈 입문자',
    description: '10개의 퀴즈 완료',
    icon: '📚',
    category: 'progress',
    rarity: 'common',
  },
  {
    id: 'quiz_enthusiast',
    title: '퀴즈 애호가',
    description: '50개의 퀴즈 완료',
    icon: '🎓',
    category: 'progress',
    rarity: 'uncommon',
  },
  {
    id: 'quiz_master',
    title: '퀴즈 마스터',
    description: '100개의 퀴즈 완료',
    icon: '👑',
    category: 'progress',
    rarity: 'rare',
  },
  {
    id: 'quiz_legend',
    title: '퀴즈 전설',
    description: '500개의 퀴즈 완료',
    icon: '🏆',
    category: 'progress',
    rarity: 'legendary',
  },
  {
    id: 'category_expert',
    title: '카테고리 전문가',
    description: '한 카테고리에서 90% 이상 정답률 달성',
    icon: '🧠',
    category: 'mastery',
    rarity: 'epic',
  },
  {
    id: 'multi_category',
    title: '다재다능',
    description: '3개 이상 카테고리에서 80% 이상 정답률 달성',
    icon: '🌟',
    category: 'mastery',
    rarity: 'rare',
  },
  {
    id: 'category_master',
    title: '올라운더',
    description: '모든 카테고리(8개)에서 70% 이상 정답률 달성',
    icon: '🎭',
    category: 'mastery',
    rarity: 'epic',
  },
  {
    id: 'category_completionist',
    title: '탐험가',
    description: '모든 카테고리에서 최소 1개 이상의 퀴즈 완료',
    icon: '🗺️',
    category: 'mastery',
    rarity: 'rare',
  },
  {
    id: 'balanced_learner',
    title: '균형잡힌 학습자',
    description: '모든 카테고리에서 최소 3개 이상의 퀴즈 완료',
    icon: '⚖️',
    category: 'mastery',
    rarity: 'epic',
  },
  {
    id: 'speed_demon',
    title: '번개같은 속도',
    description: '평균 답변 시간 3초 이하로 퀴즈 완료',
    icon: '⚡',
    category: 'speed',
    rarity: 'epic',
  },
  {
    id: 'quick_thinker',
    title: '빠른 사고',
    description: '평균 답변 시간 5초 이하로 퀴즈 완료',
    icon: '🧩',
    category: 'speed',
    rarity: 'rare',
  },
  {
    id: 'comeback_king',
    title: '역전의 제왕',
    description: '처음 3문제를 틀렸지만 나머지는 모두 정답',
    icon: '💪',
    category: 'special',
    rarity: 'uncommon',
  },
  {
    id: 'night_owl',
    title: '밤의 학자',
    description: '자정부터 오전 5시 전까지 퀴즈 10개 완료',
    icon: '🦉',
    category: 'special',
    rarity: 'rare',
  },
  {
    id: 'early_bird',
    title: '아침형 인간',
    description: '오전 5시부터 오전 10시 전까지 퀴즈 10개 완료',
    icon: '🐦',
    category: 'special',
    rarity: 'rare',
  },
  {
    id: 'weekend_warrior',
    title: '주말 전사',
    description: '주말에만 50개 퀴즈 완료',
    icon: '🏖️',
    category: 'special',
    rarity: 'epic',
  },
  {
    id: 'improvement_seeker',
    title: '발전하는 마음',
    description: '한 카테고리 정답률을 50%에서 80%로 향상',
    icon: '📈',
    category: 'progress',
    rarity: 'rare',
  },
  {
    id: 'lucky_guess',
    title: '행운의 추측',
    description: '연속으로 5문제 맞히기',
    icon: '🍀',
    category: 'streak',
    rarity: 'uncommon',
  },
  // {
  //   id: 'persistent_player',
  //   title: '끈기의 승부사',
  //   description: '한 번에 20문제 이상 연속 풀기',
  //   icon: '🎯',
  //   category: 'streak',
  //   rarity: 'rare',
  // },
];

const RARITY_COLORS: Record<Rarity, RarityColor> = {
  common: { primary: '#6B7280', secondary: '#9CA3AF' },
  uncommon: { primary: '#10B981', secondary: '#34D399' },
  rare: { primary: '#3B82F6', secondary: '#60A5FA' },
  epic: { primary: '#8B5CF6', secondary: '#A78BFA' },
  legendary: { primary: '#F59E0B', secondary: '#FCD34D' },
};

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  userProgress,
  onPress,
  animatedValue,
}) => {
  const isUnlocked = Boolean(userProgress?.unlockedAt);
  const progress = userProgress?.progress || 0;
  const colors = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;

  const badgeStyle = [
    styles.badge,
    {
      backgroundColor: isUnlocked ? '#FFFFFF' : '#F3F4F6',
      borderColor: isUnlocked ? colors.primary : '#E5E7EB',
      borderWidth: isUnlocked ? 3 : 2,
      // Scale and opacity for visual emphasis
      transform: [{ scale: isUnlocked ? 1.05 : 0.95 }],
      opacity: isUnlocked ? 1 : 0.6,
    },
  ];

  return (
    <Animated.View
      style={[
        { transform: [{ scale: animatedValue }], opacity: animatedValue },
      ]}
    >
      <TouchableOpacity onPress={() => onPress(achievement)} style={badgeStyle}>
        {/* 희귀도 표시 */}
        <View style={[styles.rarityDot, { backgroundColor: colors.primary }]} />

        {/* 언락 글로우 효과 */}
        {isUnlocked && (
          <View
            style={[
              styles.glowEffect,
              { backgroundColor: `${colors.primary}20` },
            ]}
          />
        )}

        {/* 아이콘 */}
        <Text style={[styles.badgeIcon, { opacity: isUnlocked ? 1 : 0.4 }]}>
          {achievement.icon}
        </Text>

        {/* 제목 */}
        <Text
          style={[
            styles.badgeTitle,
            { color: isUnlocked ? '#1F2937' : '#9CA3AF' },
          ]}
        >
          {achievement.title}
        </Text>

        {/* 진행도 바 */}
        {!isUnlocked && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(progress * 10, 100)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const CategoryFilterComponent: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelect,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryContainer}
      contentContainerStyle={styles.categoryContent}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category.id}
          onPress={() => onSelect(category.id)}
          style={[
            styles.categoryButton,
            {
              backgroundColor:
                selectedCategory === category.id ? '#3B82F6' : '#F3F4F6',
              borderColor:
                selectedCategory === category.id ? '#3B82F6' : '#E5E7EB',
            },
          ]}
        >
          <Text
            style={[
              styles.categoryText,
              {
                color: selectedCategory === category.id ? '#FFFFFF' : '#6B7280',
              },
            ]}
          >
            {category.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const AchievementModal: React.FC<AchievementModalProps> = ({
  achievement,
  userProgress,
  visible,
  onClose,
}) => {
  const isUnlocked = Boolean(userProgress?.unlockedAt);
  const unlockedDate =
    isUnlocked && userProgress?.unlockedAt
      ? new Date(userProgress.unlockedAt).toLocaleDateString('ko-KR')
      : null;

  if (!achievement) return null;

  return (
    <Modal
      visible={visible}
      animationType='fade'
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalIcon}>{achievement.icon}</Text>

          <Text style={styles.modalTitle}>{achievement.title}</Text>

          <Text style={styles.modalDescription}>{achievement.description}</Text>

          {isUnlocked && unlockedDate && (
            <View style={styles.unlockedBadge}>
              <Text style={styles.unlockedText}>🎉 {unlockedDate}에 달성!</Text>
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function AchievementList({
  userAchievements,
}: AchievementListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [animatedValues] = useState<Animated.Value[]>(
    defaultAchievements.map(() => new Animated.Value(0))
  );
  // 애니메이션 실행 여부를 추적하는 ref
  const hasAnimatedRef = useRef<boolean>(false);

  const categories: CategoryFilter[] = [
    { id: 'all', label: '전체' },
    { id: 'basic', label: '기본' },
    { id: 'streak', label: '연속' },
    { id: 'accuracy', label: '정확도' },
    { id: 'progress', label: '진행도' },
    { id: 'mastery', label: '마스터' },
    { id: 'special', label: '특별' },
    { id: 'speed', label: '속도' },
  ];

  const filteredAchievements = defaultAchievements.filter(
    (achievement) =>
      selectedCategory === 'all' || achievement.category === selectedCategory
  );

  if (!userAchievements) return null;

  const unlockedCount = userAchievements.filter((ua) => ua.unlockedAt).length;
  const totalCount = defaultAchievements.length;

  useEffect(() => {
    // 처음 로드될 때만 애니메이션 실행
    if (!hasAnimatedRef.current && userAchievements) {
      // 이전 애니메이션 리셋
      animatedValues.forEach((value) => value.setValue(0));

      // 순차적 애니메이션
      const animations = filteredAchievements.map((_, index) => {
        return Animated.timing(animatedValues[index], {
          toValue: 1,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        });
      });

      Animated.stagger(50, animations).start();
      hasAnimatedRef.current = true;
    }
  }, [userAchievements]); // 처음 로드 시에만

  // 카테고리 변경 시 별도 useEffect
  useEffect(() => {
    if (hasAnimatedRef.current) {
      // 이전 애니메이션 리셋
      animatedValues.forEach((value) => value.setValue(0));

      // 순차적 애니메이션
      const animations = filteredAchievements.map((_, index) => {
        return Animated.timing(animatedValues[index], {
          toValue: 1,
          duration: 300,
          delay: index * 50,
          useNativeDriver: true,
        });
      });

      Animated.stagger(50, animations).start();
    }
  }, [selectedCategory]); // 카테고리 변경 시에만

  const handleAchievementPress = (achievement: Achievement): void => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  const handleModalClose = (): void => {
    setModalVisible(false);
  };

  const handleCategorySelect = (categoryId: string): void => {
    setSelectedCategory(categoryId);
  };

  return (
    <View>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>배지 컬렉션</Text>

        <View style={styles.statsCard}>
          <View style={styles.statsText}>
            <Text style={styles.statsLabel}>달성한 배지</Text>
            <Text style={styles.statsValue}>
              {unlockedCount} / {totalCount}
            </Text>
          </View>

          <View style={styles.statsIcon}>
            <Text style={styles.statsEmoji}>🏅</Text>
          </View>
        </View>
      </View>

      {/* 카테고리 필터 */}
      <CategoryFilterComponent
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
      />

      {/* 배지 그리드 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {filteredAchievements.map((achievement, index) => {
            const userProgress = userAchievements.find(
              (ua) => ua.achievementId === achievement.id
            );

            return (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                userProgress={userProgress}
                onPress={handleAchievementPress}
                animatedValue={animatedValues[index]}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* 배지 상세 모달 */}
      <AchievementModal
        achievement={selectedAchievement}
        userProgress={userAchievements.find(
          (ua) => ua.achievementId === selectedAchievement?.id
        )}
        visible={modalVisible}
        onClose={handleModalClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // 헤더 스타일
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsText: {
    flex: 1,
  },
  statsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
  },
  statsIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsEmoji: {
    fontSize: 24,
  },

  // 카테고리 필터 스타일
  categoryContainer: {
    marginBottom: 20,
  },
  categoryContent: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 25,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // 배지 스타일
  badge: {
    width: (screenWidth - 60) / 2,
    aspectRatio: 1,
    margin: 8,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rarityDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  glowEffect: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    zIndex: -1,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    width: '80%',
    marginTop: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // 그리드 스타일
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  unlockedBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
  },
  unlockedText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 16,
    minWidth: 120,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
