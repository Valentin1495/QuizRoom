import SignOutButton from '@/components/sign-out-button';
import { Colors } from '@/constants/Colors';
import {
  Difficulty,
  QuestionFormat,
  Subcategory,
  TopCategory,
  useQuizSetup,
} from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { useBlockNavigation } from '@/hooks/use-block-navigation';
import { useMyProfile } from '@/hooks/use-my-profile';
import { uploadQuizBatch } from '@/utils/upload-quiz';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Activity, AlertTriangle, Check, ChevronRight, Coffee } from 'react-native-feather';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const cardWidth = isTablet ? width * 0.4 : width * 0.85;
const cardHeight = cardWidth * 0.6;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 난이도 정보
const difficultyLevels: {
  id: Difficulty;
  title: string;
  description: string;
  icon: any;
  colors: any;
}[] = [
  {
    id: 'easy',
    title: '쉬움',
    description: '기본적인 지식을 테스트하는 간단한 문제',
    icon: Coffee,
    colors: ['#4ade80', '#22c55e'],
  },
  {
    id: 'medium',
    title: '보통',
    description: '약간의 도전이 필요한 중간 난이도 문제',
    icon: Activity,
    colors: ['#60a5fa', '#3b82f6'],
  },
  {
    id: 'hard',
    title: '어려움',
    description: '깊은 이해가 필요한 고난도 문제',
    icon: AlertTriangle,
    colors: ['#f472b6', '#ec4899'],
  },
];

// 1차 카테고리 (testQuestions.category)
const categories: {
  id: TopCategory;
  title: string;
  description: string;
  iconName: any;
  colors: any;
  image: any;
  disabled?: boolean;
}[] = [
  {
    id: 'general',
    title: '상식',
    description: '다양한 분야의 기본 지식',
    iconName: 'book',
    colors: ['#a78bfa', '#8b5cf6'],
    image: require('@/assets/images/knowledge.jpg'),
  },
  {
    id: 'entertainment',
    title: '연예',
    description: '영화, 드라마, 예능',
    iconName: 'film',
    colors: ['#6366f1', '#4f46e5'],
    image: require('@/assets/images/entertainment.jpg'),
  },
  {
    id: 'slang',
    title: '신조어',
    description: '곧 제공 예정',
    iconName: 'chatbubbles',
    colors: ['#22d3ee', '#06b6d4'],
    image: require('@/assets/images/blah.jpg'),
    disabled: true,
  },
  {
    id: 'capitals',
    title: '수도',
    description: '곧 제공 예정',
    iconName: 'earth',
    colors: ['#34d399', '#10b981'],
    image: require('@/assets/images/knowledge.jpg'),
    disabled: true,
  },
  {
    id: 'four-character-idioms',
    title: '사자성어',
    description: '곧 제공 예정',
    iconName: 'document-text',
    colors: ['#f472b6', '#ec4899'],
    image: require('@/assets/images/four.jpg'),
    disabled: true,
  },
];

// 문제 형식 정보
const questionTypesByTopCategory: Record<
  TopCategory,
  { id: QuestionFormat; title: string; description: string; iconName: any; colors: any }[]
> = {
  general: [
    {
      id: 'multiple',
      title: '객관식',
      description: '여러 선택지 중에서 정답을 고르는 방식',
      iconName: 'list-outline',
      colors: ['#a855f7', '#8b5cf6'],
    },
    {
      id: 'short',
      title: '주관식',
      description: '직접 답변을 입력하는 방식',
      iconName: 'chatbox-ellipses-outline',
      colors: ['#3b82f6', '#2563eb'],
    },
  ],
  entertainment: [
    {
      id: 'true_false',
      title: 'O / X',
      description: '맞으면 O, 틀리면 X',
      iconName: 'checkmark-done-outline',
      colors: ['#22c55e', '#16a34a'],
    },
    {
      id: 'filmography',
      title: '필모그래피',
      description: '작품 이력으로 맞히기',
      iconName: 'videocam-outline',
      colors: ['#f59e0b', '#d97706'],
    },
  ],
  slang: [],
  capitals: [],
  'four-character-idioms': [],
};

// 추천 퀴즈 카드 컴포넌트
const FeaturedCard = React.memo(
  ({
    item,
    onSelect,
    isSelected,
  }: {
    item: (typeof categories)[0];
    onSelect: (category: TopCategory) => void;
    isSelected: boolean;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const handlePressIn = () => {
      scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1);
    };

    return (
      <AnimatedPressable
        style={[
          styles.featuredCard,
          animatedStyle,
          isSelected && styles.selectedFeaturedCard,
          item.disabled && { opacity: 0.5 },
        ]}
        onPress={() => {
          if (item.disabled) return;
          onSelect(item.id);
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.featuredCardInnerContainer}>
          <ImageBackground
            source={item.image}
            style={styles.cardBackground}
            imageStyle={styles.cardBackgroundImage}
          >
            <LinearGradient
              colors={
                isSelected
                  ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']
                  : ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']
              }
              style={styles.cardGradient}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardIconContainer}>
                  <LinearGradient colors={item.colors} style={styles.cardIcon}>
                    <Ionicons name={item.iconName} size={24} color="white" />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>
                  {item.title}
                  {item.disabled ? ' (Coming soon)' : ''}
                </Text>
                {isSelected && (
                  <View style={styles.selectedCardIndicator}>
                    <Check width={20} height={20} color="white" />
                  </View>
                )}
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>
      </AnimatedPressable>
    );
  },
);

// 문제 형식 카드 컴포넌트
const QuestionTypeCard = React.memo(
  ({
    item,
    onSelect,
    isSelected,
  }: {
    item: (typeof questionTypesByTopCategory)['general'][0];
    onSelect: (type: QuestionFormat) => void;
    isSelected: boolean;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const handlePressIn = () => {
      scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1);
    };

    return (
      <AnimatedPressable
        style={[styles.typeCard, animatedStyle, isSelected && styles.selectedCard]}
        onPress={() => onSelect(item.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient colors={item.colors} style={styles.typeIcon}>
          <Ionicons name={item.iconName} size={24} color="white" />
        </LinearGradient>
        <View style={styles.typeContent}>
          <Text style={styles.typeTitle}>{item.title}</Text>
          <Text style={styles.typeDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: item.colors[1] }]}>
            <Check width={16} height={16} color="white" />
          </View>
        )}
      </AnimatedPressable>
    );
  },
);

// 난이도 카드 컴포넌트
const DifficultyCard = React.memo(
  ({
    item,
    onSelect,
    isSelected,
  }: {
    item: (typeof difficultyLevels)[0];
    onSelect: (difficulty: Difficulty) => void;
    isSelected: boolean;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const handlePressIn = () => {
      scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1);
    };

    return (
      <AnimatedPressable
        style={[styles.difficultyCard, animatedStyle, isSelected && styles.selectedCard]}
        onPress={() => onSelect(item.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient colors={item.colors} style={styles.difficultyIcon}>
          <item.icon width={24} height={24} color="white" />
        </LinearGradient>
        <View style={styles.difficultyContent}>
          <Text style={styles.difficultyTitle}>{item.title}</Text>
          <Text style={styles.difficultyDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: item.colors[1] }]}>
            <Check width={16} height={16} color="white" />
          </View>
        )}
      </AnimatedPressable>
    );
  },
);

export default function HomeScreen() {
  const { setSetup, setup } = useQuizSetup();
  const { topCategory, subcategory, difficulty, questionFormat } = setup;
  const insertQuizBatch = useMutation(api.quizzes.insertQuizBatch);
  const { myProfile } = useMyProfile();
  const handleBatchUpload = async () => {
    await uploadQuizBatch(insertQuizBatch);
  };

  const router = useRouter();
  useBlockNavigation();

  const handleSelectCategory = (category: TopCategory) => {
    setSetup((prev) => ({
      ...prev,
      topCategory: category,
      subcategory: null,
      questionFormat: null,
      difficulty: null,
    }));
  };

  const handleSelectQuestionType = (type: QuestionFormat) => {
    if (!topCategory) return;
    setSetup((prev) => ({ ...prev, questionFormat: type }));
  };

  const handleSelectDifficulty = (difficulty: Difficulty) => {
    setSetup((prev) => ({ ...prev, difficulty }));
  };

  const requiresSubcategory = topCategory === 'general' || topCategory === 'entertainment';
  const requiresDifficulty = topCategory === 'general';
  const isSelectionComplete =
    !!topCategory &&
    (!requiresSubcategory || !!subcategory) &&
    (!requiresDifficulty || !!difficulty) &&
    !!questionFormat;

  const handleStartQuiz = () => {
    if (!topCategory) return;
    const params = new URLSearchParams();
    if (subcategory) params.set('category', subcategory);
    if (topCategory === 'general' && difficulty) params.set('difficulty', difficulty);
    if (questionFormat) params.set('questionFormat', questionFormat);
    params.set('dev', '1'); // ← 이 한 줄 추가
    router.push(`/quiz?${params.toString()}`);
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 헤더 */}
          <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>
                  {topCategory === 'general'
                    ? '상식 퀴즈'
                    : topCategory === 'entertainment'
                      ? '연예 퀴즈'
                      : '퀴즈 선택'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {myProfile?.displayName ? (
                    <Text
                      style={{
                        color: Colors.light.primary,
                        fontWeight: 'bold',
                      }}
                    >
                      {myProfile.displayName}
                    </Text>
                  ) : (
                    <View
                      style={{
                        height: 20,
                        width: 80,
                        backgroundColor: '#eee',
                        borderRadius: 6,
                        marginTop: 4,
                      }}
                    />
                  )}
                  님 환영해요! 🙌 {'\n'}
                  다양한 분야의 지식을 테스트해 보세요.
                </Text>
              </View>
              <SignOutButton />
              {/* <Pressable onPress={handleBatchUpload}>
                <Text>생성</Text>
              </Pressable> */}
            </View>
          </Animated.View>

          {/* 카테고리 섹션 */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(200)}
            style={styles.sectionContainer}
          >
            <Text style={styles.sectionTitle}>카테고리 선택</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              decelerationRate="fast"
              snapToInterval={cardWidth + 16}
            >
              {categories.map((item) => (
                <FeaturedCard
                  key={item.id}
                  item={item}
                  onSelect={handleSelectCategory}
                  isSelected={topCategory === item.id}
                />
              ))}
            </ScrollView>
          </Animated.View>

          {/* 서브카테고리 섹션 (상식/연예만) */}
          {!!topCategory && (topCategory === 'general' || topCategory === 'entertainment') && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(230)}
              style={styles.sectionContainer}
            >
              <Text style={styles.sectionTitle}>서브카테고리 선택</Text>
              <View style={styles.typeContainer}>
                {(topCategory === 'general'
                  ? [
                      { id: 'general', title: '일반 상식' },
                      { id: 'history-culture', title: '역사 & 문화' },
                      { id: 'arts-literature', title: '예술 & 문학' },
                      { id: 'sports', title: '스포츠' },
                      { id: 'science-tech', title: '과학 & 기술' },
                      { id: 'math-logic', title: '수학 & 논리' },
                      { id: 'kpop-music', title: 'K팝 & 음악' },
                    ]
                  : [
                      { id: 'movies', title: '영화' },
                      { id: 'drama-variety', title: '드라마 & 예능' },
                    ]
                ).map((sc) => (
                  <TouchableOpacity
                    key={sc.id}
                    style={[
                      styles.typeCard,
                      subcategory === (sc.id as Subcategory) && styles.selectedCard,
                    ]}
                    onPress={() =>
                      setSetup((prev) => ({ ...prev, subcategory: sc.id as Subcategory }))
                    }
                  >
                    <View style={styles.typeContent}>
                      <Text style={styles.typeTitle}>{sc.title}</Text>
                    </View>
                    {subcategory === (sc.id as Subcategory) && (
                      <View
                        style={[
                          styles.selectedIndicator,
                          { backgroundColor: Colors.light.primary },
                        ]}
                      >
                        <Check width={16} height={16} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* 문제 형식 섹션 (카테고리 선택 후 노출) */}
          {topCategory && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(250)}
              style={styles.sectionContainer}
            >
              <Text style={styles.sectionTitle}>문제 형식 선택</Text>
              <View style={styles.typeContainer}>
                {questionTypesByTopCategory[topCategory].length === 0 && (
                  <Text style={styles.typeDescription}>곧 제공 예정입니다.</Text>
                )}
                {questionTypesByTopCategory[topCategory].length > 0 &&
                  questionTypesByTopCategory[topCategory].map((item) => (
                    <QuestionTypeCard
                      key={item.id}
                      item={item}
                      onSelect={handleSelectQuestionType}
                      isSelected={questionFormat === item.id}
                    />
                  ))}
              </View>
            </Animated.View>
          )}

          {/* 난이도 섹션 (상식에서만 노출) */}
          {topCategory === 'general' && (
            <Animated.View
              entering={FadeInDown.duration(600).delay(300)}
              style={styles.sectionContainer}
            >
              <Text style={styles.sectionTitle}>난이도 선택</Text>
              <View style={styles.difficultyContainer}>
                {difficultyLevels.map((item) => (
                  <DifficultyCard
                    key={item.id}
                    item={item}
                    onSelect={handleSelectDifficulty}
                    isSelected={difficulty === item.id}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* 시작 버튼 */}
          {isSelectionComplete && (
            <Animated.View entering={FadeInUp.duration(600)} style={styles.startButtonContainer}>
              <TouchableOpacity style={styles.startButton} onPress={handleStartQuiz}>
                <LinearGradient
                  colors={Colors.light.gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startButtonGradient}
                >
                  <Text style={styles.startButtonText}>퀴즈 시작하기</Text>
                  <ChevronRight width={20} height={20} color={Colors.light.secondary} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    paddingBottom: 80,
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.secondary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.secondary,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  featuredList: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  featuredCard: {
    width: cardWidth,
    height: cardHeight,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  featuredCardInnerContainer: {
    flex: 1,
    padding: 8, // 테두리와 내부 콘텐츠 사이 패딩
  },
  cardBackground: {
    flex: 1, // width와 height를 100%에서 flex: 1로 변경
    borderRadius: 12, // 내부 컨테이너에 맞는 더 작은 borderRadius
  },
  cardBackgroundImage: {
    borderRadius: 12, // 내부 이미지의 모서리도 둥글게
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    borderRadius: 16,
  },
  cardContent: {
    width: '100%',
  },
  cardIconContainer: {
    position: 'absolute',
    top: -50,
    left: 0,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  typeContainer: {
    paddingHorizontal: 20,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondary,
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  difficultyContainer: {
    paddingHorizontal: 20,
  },
  difficultyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  difficultyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  difficultyContent: {
    flex: 1,
  },
  difficultyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.secondary,
    marginBottom: 4,
  },
  difficultyDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonContainer: {
    paddingHorizontal: 20,
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.secondary,
    marginRight: 8,
  },
  selectedFeaturedCard: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'rgba(111, 29, 27, 0.1)',
  },
  selectedCardIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.light.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCardText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'rgba(111, 29, 27, 0.1)',
  },
});
