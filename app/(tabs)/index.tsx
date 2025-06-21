import SignOutButton from '@/components/sign-out-button';
import {
  Difficulty,
  KnowledgeCategory,
  QuestionFormatByQuizType,
  useQuizSetup,
} from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { useQuizGamification } from '@/hooks/use-quiz-gamification';
import { uploadQuizBatch } from '@/utils/upload-quiz';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
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
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Coffee,
} from 'react-native-feather';
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

// 카테고리 정보
const categories: {
  id: KnowledgeCategory;
  title: string;
  description: string;
  iconName: any;
  colors: any;
  image: any;
}[] = [
  {
    id: 'general',
    title: '일반 상식',
    description: '다양한 분야의 기본 지식',
    iconName: 'book-outline',
    colors: ['#a78bfa', '#8b5cf6'],
    image: require('@/assets/images/knowledge.jpg'),
  },
  {
    id: 'science-tech',
    title: '과학 & 기술',
    description: '과학, 기술, 발명에 관한 지식',
    iconName: 'bulb-outline',
    colors: ['#60a5fa', '#3b82f6'],
    image: require('@/assets/images/science.jpg'),
  },
  {
    id: 'history-culture',
    title: '역사 & 문화',
    description: '역사적 사건과 문화 지식',
    iconName: 'hourglass-outline',
    colors: ['#f97316', '#ea580c'],
    image: require('@/assets/images/history.jpg'),
  },
  {
    id: 'kpop-music',
    title: 'K-pop & 음악',
    description: 'K-pop과 음악에 관한 지식',
    iconName: 'musical-notes-outline',
    colors: ['#f59e0b', '#d97706'],
    image: require('@/assets/images/music.jpg'),
  },
  {
    id: 'arts-literature',
    title: '예술 & 문학',
    description: '예술 작품과 문학 작품에 관한 지식',
    iconName: 'brush-outline',
    colors: ['#ec4899', '#db2777'],
    image: require('@/assets/images/arts.jpg'),
  },
  {
    id: 'sports',
    title: '스포츠',
    description: '다양한 스포츠와 경기에 관한 지식',
    iconName: 'basketball-outline',
    colors: ['#10b981', '#059669'],
    image: require('@/assets/images/sports.jpg'),
  },
  {
    id: 'entertainment',
    title: '영화 & TV',
    description: '영화, 드라마, 연예인에 관한 지식',
    iconName: 'film-outline',
    colors: ['#6366f1', '#4f46e5'],
    image: require('@/assets/images/entertainment.jpg'),
  },
  {
    id: 'math-logic',
    title: '수학 & 논리',
    description: '수학 문제와 논리적 사고력을 테스트하는 문제',
    iconName: 'calculator-outline',
    colors: ['#9333ea', '#7e22ce'],
    image: require('@/assets/images/math.jpg'),
  },
];

// 문제 형식 정보
const questionTypes: {
  id: QuestionFormatByQuizType<'knowledge'>;
  title: string;
  description: string;
  iconName: any;
  colors: any;
}[] = [
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
];

// 추천 퀴즈 카드 컴포넌트
const FeaturedCard = React.memo(
  ({
    item,
    onSelect,
    isSelected,
  }: {
    item: (typeof categories)[0];
    onSelect: (category: KnowledgeCategory) => void;
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
        ]}
        onPress={() => onSelect(item.id)}
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
                    <Ionicons name={item.iconName} size={24} color='white' />
                  </LinearGradient>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {isSelected && (
                  <View style={styles.selectedCardIndicator}>
                    <Check width={20} height={20} color='white' />
                  </View>
                )}
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>
      </AnimatedPressable>
    );
  }
);

// 문제 형식 카드 컴포넌트
const QuestionTypeCard = React.memo(
  ({
    item,
    onSelect,
    isSelected,
  }: {
    item: (typeof questionTypes)[0];
    onSelect: (type: QuestionFormatByQuizType<'knowledge'>) => void;
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
          styles.typeCard,
          animatedStyle,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => onSelect(item.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient colors={item.colors} style={styles.typeIcon}>
          <Ionicons name={item.iconName} size={24} color='white' />
        </LinearGradient>
        <View style={styles.typeContent}>
          <Text style={styles.typeTitle}>{item.title}</Text>
          <Text style={styles.typeDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        {isSelected && (
          <View
            style={[
              styles.selectedIndicator,
              { backgroundColor: item.colors[1] },
            ]}
          >
            <Check width={16} height={16} color='white' />
          </View>
        )}
      </AnimatedPressable>
    );
  }
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
        style={[
          styles.difficultyCard,
          animatedStyle,
          isSelected && styles.selectedCard,
        ]}
        onPress={() => onSelect(item.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient colors={item.colors} style={styles.difficultyIcon}>
          <item.icon width={24} height={24} color='white' />
        </LinearGradient>
        <View style={styles.difficultyContent}>
          <Text style={styles.difficultyTitle}>{item.title}</Text>
          <Text style={styles.difficultyDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        {isSelected && (
          <View
            style={[
              styles.selectedIndicator,
              { backgroundColor: item.colors[1] },
            ]}
          >
            <Check width={16} height={16} color='white' />
          </View>
        )}
      </AnimatedPressable>
    );
  }
);

export default function HomeScreen() {
  const { setSetup, setup } = useQuizSetup();
  const { category, difficulty, questionFormat, quizType } = setup;
  const { resetQuizData } = useQuizGamification();
  const insertQuizBatch = useMutation(api.quizzes.insertQuizBatch);
  const handleBatchUpload = async () => {
    await uploadQuizBatch(insertQuizBatch);
  };

  useEffect(() => {
    resetQuizData();
  }, []);

  const router = useRouter();

  const handleSelectCategory = (category: KnowledgeCategory) => {
    setSetup((prev) => ({ ...prev, category }));
  };

  const handleSelectQuestionType = (
    type: QuestionFormatByQuizType<'knowledge'>
  ) => {
    setSetup((prev) => ({ ...prev, questionFormat: type }));
  };

  const handleSelectDifficulty = (difficulty: Difficulty) => {
    setSetup((prev) => ({ ...prev, difficulty }));
  };

  // 모든 선택이 완료되었는지 확인
  const isSelectionComplete =
    category && difficulty && questionFormat && quizType;

  const handleStartQuiz = () => {
    router.push(
      `/quiz?quizType=${quizType}&category=${category}&difficulty=${difficulty}&questionFormat=${questionFormat}`
    );
  };

  const currentUser = useQuery(api.users.getCurrentUserByClerkId);
  // const quizzes = useQuery(api.quizzes.getQuestionsByQuizType, {
  //   category: 'kpop-music',
  //   quizType: 'knowledge',
  //   questionFormat: 'multiple',
  //   difficulty: 'hard',
  // });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(100)}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>상식 퀴즈</Text>
              <Text style={styles.headerSubtitle}>
                {currentUser?.fullName}님 환영해요! 🙌 {'\n'}
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
            decelerationRate='fast'
            snapToInterval={cardWidth + 16}
          >
            {categories.map((item) => (
              <FeaturedCard
                key={item.id}
                item={item}
                onSelect={handleSelectCategory}
                isSelected={category === item.id}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* 문제 형식 섹션 */}
        <Animated.View
          entering={FadeInDown.duration(600).delay(250)}
          style={styles.sectionContainer}
        >
          <Text style={styles.sectionTitle}>문제 형식 선택</Text>
          <View style={styles.typeContainer}>
            {questionTypes.map((item) => (
              <QuestionTypeCard
                key={item.id}
                item={item}
                onSelect={handleSelectQuestionType}
                isSelected={questionFormat === item.id}
              />
            ))}
          </View>
        </Animated.View>

        {/* 난이도 섹션 */}
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

        {/* 시작 버튼 */}
        {isSelectionComplete && (
          <Animated.View
            entering={FadeInUp.duration(600)}
            style={styles.startButtonContainer}
          >
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartQuiz}
            >
              <LinearGradient
                colors={['#8E2DE2', '#4A00E0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButtonGradient}
              >
                <Text style={styles.startButtonText}>퀴즈 시작하기</Text>
                <ChevronRight width={20} height={20} color='white' />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    color: '#111827',
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
    color: '#111827',
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
    color: '#111827',
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
    color: '#111827',
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
    color: 'white',
    marginRight: 8,
  },
  selectedFeaturedCard: {
    borderWidth: 2,
    borderColor: '#8E2DE2',
    backgroundColor: 'rgba(142, 45, 226, 0.05)',
  },
  selectedCardIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#8E2DE2',
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
    borderColor: '#8E2DE2',
    backgroundColor: 'rgba(142, 45, 226, 0.05)',
  },
});
