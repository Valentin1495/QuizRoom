import { Colors } from '@/constants/Colors';
import { QuizType, useQuizSetup } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { getRandomElements } from '@/utils/get-random-elements';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ColorValue,
  Dimensions,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Award,
  BookOpen,
  ChevronRight,
  Film,
  HelpCircle,
  MessageSquare,
  Smile,
  Type,
  User,
} from 'react-native-feather';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const cardWidth = isTablet ? width * 0.4 : width * 0.8;
const cardHeight = cardWidth * 0.6;

// const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 퀴즈 타입 데이터를 컴포넌트 외부로 이동
const quizTypes = [
  {
    id: 'knowledge',
    title: '상식 퀴즈',
    description: '다양한 분야의 상식을 테스트하는 퀴즈',
    icon: HelpCircle,
    colors: ['#60a5fa', '#3b82f6'],
    image: require('@/assets/images/knowledge-quiz.jpg'),
  },
  {
    id: 'celebrity',
    title: '인물 퀴즈',
    description: '유명 인물을 맞추는 퀴즈',
    icon: User,
    colors: ['#f472b6', '#ec4899'],
    image: require('@/assets/images/celebrity-quiz.jpg'),
  },
  {
    id: 'four-character',
    title: '4글자 퀴즈',
    description: '4글자로 이루어진 단어나 문구를 맞추는 퀴즈',
    icon: Type,
    colors: ['#34d399', '#10b981'],
    image: require('@/assets/images/four-char-quiz.jpg'),
  },
  {
    id: 'movie-chain',
    title: '영화 제목 이어말하기',
    description: '한국/외국 영화 제목으로 이어말하기',
    icon: Film,
    colors: ['#a78bfa', '#8b5cf6'],
    image: require('@/assets/images/movie-quiz.jpg'),
  },
  {
    id: 'proverb-chain',
    title: '속담/명언 이어말하기',
    description: '속담/명언으로 이어말하기',
    icon: BookOpen,
    colors: ['#fb923c', '#f97316'],
    image: require('@/assets/images/proverb-quiz.jpg'),
  },
  {
    id: 'slang',
    title: '신조어 퀴즈',
    description: '최신 유행하는 줄임말과 신조어 맞추기',
    icon: MessageSquare,
    colors: ['#c084fc', '#a855f7'],
    image: require('@/assets/images/slang-quiz.jpg'),
  },
  {
    id: 'logo',
    title: '로고 퀴즈',
    description: '유명 브랜드와 회사의 로고 맞추기',
    icon: Award,
    colors: ['#facc15', '#eab308'],
    image: require('@/assets/images/logo-quiz.jpg'),
  },
  {
    id: 'nonsense',
    title: '넌센스 퀴즈',
    description: '기발한 발상과 창의력이 필요한 넌센스 문제',
    icon: Smile,
    colors: ['#f43f5e', '#d946ef'],
    image: require('@/assets/images/nonsense-quiz.jpg'),
  },
];

// 추천 퀴즈 카드 컴포넌트 - 별도 컴포넌트로 분리
const FeaturedCard = React.memo(
  ({
    item,
    onSelect,
  }: {
    item: (typeof quizTypes)[0];
    onSelect: (type: QuizType) => void;
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
        style={[styles.featuredCard, animatedStyle]}
        onPress={() => onSelect(item.id as QuizType)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <ImageBackground
          source={item.image}
          style={styles.cardBackground}
          imageStyle={styles.cardBackgroundImage}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              {/* <View style={styles.cardIconContainer}>
                <LinearGradient
                  colors={
                    item.colors as [ColorValue, ColorValue, ...ColorValue[]]
                  }
                  style={styles.cardIcon}
                >
                  <item.icon width={24} height={24} color='white' />
                </LinearGradient>
              </View> */}
              <Text style={styles.cardTitle}>{item.title}</Text>
              {/* <View style={styles.cardFooter}>
                <View style={styles.ratingContainer}>
                  <Star width={12} height={12} color='#facc15' fill='#facc15' />
                  <Star width={12} height={12} color='#facc15' fill='#facc15' />
                  <Star width={12} height={12} color='#facc15' fill='#facc15' />
                  <Star width={12} height={12} color='#facc15' fill='#facc15' />
                  <Star width={12} height={12} color='#facc15' fill='#facc15' />
                  <Text style={styles.ratingText}>5.0</Text>
                </View>
                <ChevronRight width={16} height={16} color='white' />
              </View> */}
            </View>
          </LinearGradient>
        </ImageBackground>
      </AnimatedPressable>
    );
  }
);

// 퀴즈 목록 아이템 컴포넌트 - 별도 컴포넌트로 분리
const QuizItem = React.memo(
  ({
    item,
    onSelect,
  }: {
    item: (typeof quizTypes)[0];
    onSelect: (type: QuizType) => void;
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
      <Animated.View style={[styles.quizCard, animatedStyle]}>
        <Pressable
          style={styles.quizCardTouchable}
          onPress={() => onSelect(item.id as QuizType)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
        >
          <LinearGradient
            colors={item.colors as [ColorValue, ColorValue, ...ColorValue[]]}
            style={styles.quizCardIcon}
          >
            <item.icon width={24} height={24} color='white' />
          </LinearGradient>
          <View style={styles.quizCardContent}>
            <Text style={styles.quizCardTitle}>{item.title}</Text>
            <Text style={styles.quizCardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <ChevronRight width={20} height={20} color='#9ca3af' />
        </Pressable>
      </Animated.View>
    );
  }
);

export default function HomeScreen() {
  const currentUser = useQuery(api.users.getCurrentUserByClerkId);

  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const { setSetup } = useQuizSetup();
  const router = useRouter();

  const handleSelect = (quizType: QuizType) => {
    setSetup((prev) => ({
      ...prev,
      quizType,
    }));

    router.push(`/quiz/${quizType}`);
  };

  // 추천 퀴즈 렌더링 함수
  const renderFeaturedItem = ({ item }: { item: (typeof quizTypes)[0] }) => {
    return <FeaturedCard item={item} onSelect={handleSelect} />;
  };

  // 모든 퀴즈 렌더링 함수
  const renderQuizItem = ({ item }: { item: (typeof quizTypes)[0] }) => {
    return <QuizItem item={item} onSelect={handleSelect} />;
  };

  const randomFour = getRandomElements(quizTypes, 4);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {currentUser?.fullName}님 환영해요! 🙌 {'\n'}
          다양한 퀴즈를 즐겨보세요~
        </Text>

        <View style={styles.coinContainer}>
          <Text style={styles.coinText}>{currentUser?.coins}</Text>
          <View style={styles.coinImageContainer}>
            <Image
              source={require('@/assets/images/coins5.png')}
              style={{ width: 24, height: 24 }}
            />
          </View>
        </View>
      </View>

      <View style={styles.featuredSection}>
        <Text style={styles.sectionTitle}>추천 퀴즈</Text>
        <Animated.FlatList
          data={randomFour}
          renderItem={renderFeaturedItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth}
          decelerationRate='fast'
          contentContainerStyle={styles.featuredList}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        />
      </View>

      <View style={styles.allQuizzesSection}>
        <Text style={styles.sectionTitle}>모든 퀴즈</Text>
        <FlatList
          data={quizTypes}
          renderItem={renderQuizItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.quizList}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 16,
  },
  coinContainer: {
    width: 68,
    height: 34,
    backgroundColor: Colors.light.tint,
    borderRadius: 200,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  coinText: {
    fontWeight: '700',
    fontSize: 12,
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  coinImageContainer: {
    width: 30,
    height: 30,
    borderRadius: 200,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  question: {
    fontWeight: '600',
    fontSize: 22,
    lineHeight: 30,
    color: Colors.light.primary,
    marginVertical: 24,
  },
  featuredSection: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  featuredList: {
    // paddingLeft: isTablet ? (width - cardWidth) / 2 : (width - cardWidth) / 2,
    // paddingRight: isTablet
    //   ? (width - cardWidth) / 2 + 16
    //   : (width - cardWidth) / 2 + 16,
  },
  featuredCard: {
    width: cardWidth,
    height: cardHeight,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBackground: {
    width: '100%',
    height: '100%',
  },
  cardBackgroundImage: {
    borderRadius: 16,
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
    top: -60,
    left: 16,
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: 'white',
    marginLeft: 4,
    fontSize: 12,
  },
  allQuizzesSection: {
    flex: 1,
  },
  quizList: {
    paddingBottom: 16,
  },
  quizCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quizCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  quizCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quizCardContent: {
    flex: 1,
  },
  quizCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  quizCardDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
});
