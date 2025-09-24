import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/use-auth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

const demoQuestions: Question[] = [
  {
    id: 1,
    question: '2024년 파리 올림픽에서 한국의 금메달 개수는?',
    options: ['13개', '15개', '17개', '19개'],
    correctAnswer: 0,
  },
  {
    id: 2,
    question: 'ChatGPT를 개발한 회사는?',
    options: ['Google', 'Microsoft', 'OpenAI', 'Meta'],
    correctAnswer: 2,
  },
  {
    id: 3,
    question: '넷플릭스 오리지널 중 전 세계적으로 가장 흥행한 한국 드라마는?',
    options: ['킹덤', '오징어 게임', '사랑의 불시착', '이태원 클라쓰'],
    correctAnswer: 1,
  },
  {
    id: 4,
    question: '한국의 최고봉은?',
    options: ['지리산', '한라산', '설악산', '태백산'],
    correctAnswer: 1,
  },
  {
    id: 5,
    question: '비트코인을 만든 익명의 인물 이름은?',
    options: ['사토시 나카모토', '일론 머스크', '마크 저커버그', '빌 게이츠'],
    correctAnswer: 0,
  },
  {
    id: 6,
    question: '한국 최초의 우주인은?',
    options: ['이소연', '고산', '박재민', '김연아'],
    correctAnswer: 0,
  },
  {
    id: 7,
    question: '2023년부터 세계 인구 1위 국가는?',
    options: ['중국', '인도', '미국', '인도네시아'],
    correctAnswer: 1,
  },
  {
    id: 8,
    question: '한국의 국화는?',
    options: ['장미', '무궁화', '진달래', '벚꽃'],
    correctAnswer: 1,
  },
  {
    id: 9,
    question: '세계에서 가장 긴 강은?',
    options: ['나일강', '아마존강', '양쯔강', '미시시피강'],
    correctAnswer: 0,
  },
  {
    id: 10,
    question: '아이폰을 만든 회사는?',
    options: ['삼성', '구글', '애플', '마이크로소프트'],
    correctAnswer: 2,
  },
  {
    id: 11,
    question: '미국의 화폐단위는?',
    options: ['원', '엔', '달러', '위안'],
    correctAnswer: 2,
  },
  {
    id: 12,
    question: '2024년 한국 대통령은?',
    options: ['문재인', '윤석열', '이재명', '홍준표'],
    correctAnswer: 1,
  },
  {
    id: 13,
    question: '지구에서 달까지의 거리는 약?',
    options: ['38만km', '48만km', '28만km', '58만km'],
    correctAnswer: 0,
  },
  {
    id: 14,
    question: '김치의 주재료는?',
    options: ['무', '배추', '당근', '양파'],
    correctAnswer: 1,
  },
  {
    id: 15,
    question: '세계에서 가장 높은 산은?',
    options: ['K2', '에베레스트', '칸첸중가', '로체'],
    correctAnswer: 1,
  },
];

type Screen = 'welcome' | 'demo' | 'result';

const WelcomeScreen: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [score, setScore] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const DEMO_QUESTION_COUNT = 10; // 데모에서 보여줄 문제 수
  const { handleGoogleButtonPress, isSigningIn } = useAuth();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 랜덤하게 문제 선택하는 함수
  const selectRandomQuestions = () => {
    const shuffled = [...demoQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, DEMO_QUESTION_COUNT);
  };

  const startDemo = () => {
    const randomQuestions = selectRandomQuestions();
    setSelectedQuestions(randomQuestions);
    setCurrentScreen('demo');
  };

  const handleAnswer = (selectedAnswer: number) => {
    if (selectedAnswer === selectedQuestions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }

    if (currentQuestion < selectedQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setCurrentScreen('result');
    }
  };

  const resetDemo = () => {
    setCurrentQuestion(0);
    setScore(0);
    setSelectedQuestions([]);
    setCurrentScreen('welcome');
  };

  const GoogleLoginButton = () => (
    <TouchableOpacity
      style={styles.googleButton}
      onPress={handleGoogleButtonPress}
      disabled={isSigningIn}
    >
      <View style={styles.googleButtonContent}>
        <Ionicons name="logo-google" size={20} color="#ffffff" />
        <Text style={styles.googleButtonText}>
          {isSigningIn ? '로그인 중...' : 'Google로 시작하기'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (currentScreen === 'welcome') {
    return (
      <LinearGradient colors={Colors.light.gradientColors} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>QZY</Text>
                <View style={styles.logoAccent} />
              </View>
              <Text style={styles.tagline}>진짜 나를 찾는 퀴즈</Text>
            </View>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.feature}>
                <Ionicons name="library" size={24} color={Colors.light.secondary} />
                <Text style={styles.featureText}>다양한 상식 퀴즈</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="flash" size={24} color="#4ECDC4" />
                <Text style={styles.featureText}>일일/주간 챌린지</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="analytics" size={24} color="#FF6B6B" />
                <Text style={styles.featureText}>AI 실력 분석</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="medal" size={24} color="#FFA500" />
                <Text style={styles.featureText}>통계 & 배지</Text>
              </View>
            </View>

            {/* Demo Info */}
            <View style={styles.demoInfo}>
              <Text style={styles.demoInfoText}>🎯 {DEMO_QUESTION_COUNT}문제 테스트</Text>
              <Text style={styles.demoInfoSubtext}>
                최신 트렌드와 상식을 반영한 문제로 랜덤 출제!
              </Text>
            </View>

            {/* CTA Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.demoButton} onPress={startDemo}>
                <Text style={styles.demoButtonText}>테스트 해보기</Text>
              </TouchableOpacity>

              <GoogleLoginButton />
            </View>

            <Text style={styles.disclaimer}>
              * 로그인하면 더 많은 문제를 통해 정확한 실력을 확인할 수 있어요
            </Text>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (currentScreen === 'demo') {
    return (
      <LinearGradient colors={Colors.light.gradientColors} style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.quizContainer}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${((currentQuestion + 1) / selectedQuestions.length) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {currentQuestion + 1} / {selectedQuestions.length}
              </Text>
            </View>

            {/* Question */}
            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>
                {selectedQuestions[currentQuestion]?.question}
              </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {selectedQuestions[currentQuestion]?.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.optionButton}
                  onPress={() => handleAnswer(index)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Result Screen
  return (
    <LinearGradient colors={Colors.light.gradientColors} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <Text style={styles.kangkangEmoji}>🧠</Text>
            <Text style={styles.resultTitle}>테스트 완료!</Text>

            {/* 깡깡 지수 계산 (틀린 문제 수 기반) */}
            {(() => {
              const wrongAnswers = selectedQuestions.length - score;
              const kangkangIndex = Math.round((wrongAnswers / selectedQuestions.length) * 100);
              const correctRate = (score / selectedQuestions.length) * 100;

              let message = '';

              if (correctRate >= 90) {
                message = '🏆 상식왕 등극! 당신은 진짜 똑똑이예요!';
              } else if (correctRate >= 70) {
                message = '📚 상식 고수! 웬만한 건 다 아시는군요 😊';
              } else if (correctRate >= 50) {
                message = '🤔 평균 이상! 조금만 더 공부하면 상식왕이에요';
              } else if (correctRate >= 30) {
                message = '😅 깡깡이 기질 발견! 귀여운 실수들이 많네요';
              } else {
                message = '🤣 완전 깡깡이! 양세찬의 진정한 후계자 출현!';
              }

              return (
                <>
                  <Text style={styles.kangkangIndex}>정답률: {kangkangIndex}%</Text>

                  <Text style={styles.resultMessage}>{message}</Text>
                </>
              );
            })()}

            <Text style={styles.loginPrompt}>
              로그인하고 더 많은 문제를 도전하여{'\n'}
              진짜 상식왕 타이틀을 획득해보세요! 🏆
            </Text>

            <GoogleLoginButton />

            <TouchableOpacity style={styles.retryButton} onPress={resetDemo}>
              <Text style={styles.retryButtonText}>다시 도전하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 2,
  },
  logoAccent: {
    width: 40,
    height: 4,
    backgroundColor: '#6f1d1b',
    borderRadius: 2,
    marginTop: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 0.9,
    textAlign: 'center',
    fontWeight: '500',
  },
  featuresContainer: {
    alignItems: 'center',
    gap: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 200,
  },
  featureText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 16,
  },
  googleButton: {
    backgroundColor: '#6f1d1b',
    borderRadius: 12,
    padding: 16,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 12,
  },
  demoInfo: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  demoInfoText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  demoInfoSubtext: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 14,
    opacity: 0.9,
  },
  demoButton: {
    borderWidth: 2,
    borderColor: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    borderRadius: 12,
    paddingVertical: 16,
  },
  demoButtonText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disclaimer: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 0.8,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  // Quiz Styles
  quizContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6f1d1b',
    borderRadius: 3,
  },
  progressText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 14,
    fontWeight: '600',
  },
  questionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  questionText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  optionText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Result Styles
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  loginPrompt: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#6f1d1b',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    fontSize: 16,
    fontWeight: '600',
  },
  kangkangEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  kangkangIndex: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FF6B6B',
    marginBottom: 8,
  },
});

export default WelcomeScreen;
