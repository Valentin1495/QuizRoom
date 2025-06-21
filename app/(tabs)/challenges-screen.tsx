import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useRefresh } from '@/hooks/use-refresh';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Challenge = Doc<'challenges'>;

export default function ChallengesScreen() {
  const [selectedTab, setSelectedTab] = useState<'daily' | 'weekly'>('daily');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { onRefresh, refreshing } = useRefresh();
  const { userId } = useAuth();
  const challenges =
    useQuery(api.challenges.getChallenges, userId ? { userId } : 'skip') || [];
  const generateDaily = useMutation(api.challenges.generateDailyChallenges);
  const generateWeekly = useMutation(api.challenges.generateWeeklyChallenges);

  // 애니메이션 값들
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 탭 컨테이너의 너비를 계산하기 위한 상태
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    // 도전과제 자동 생성
    if (!userId) return;

    generateDaily({ userId });
    generateWeekly({ userId });
  }, [userId]);

  // 실시간 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 탭 전환 애니메이션
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedTab === 'daily' ? 0 : 1,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [selectedTab]);

  // 펄스 애니메이션 (긴급한 챌린지용)
  useEffect(() => {
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulse();
  }, []);

  const dailyChallenges = challenges.filter((c) => c.type === 'daily');
  const weeklyChallenges = challenges.filter((c) => c.type === 'weekly');

  const currentChallenges =
    selectedTab === 'daily' ? dailyChallenges : weeklyChallenges;

  const getRewardText = (reward: Challenge['reward']) => {
    switch (reward.type) {
      case 'points':
        return `🏆 ${reward.value}포인트`;
      case 'streak':
        return `🔥 ${reward.value}일 연속`;
    }
  };

  const getTimeRemainingInfo = (expiresAt: number) => {
    const remaining = expiresAt - currentTime;

    if (remaining <= 0) {
      return {
        text: '⏰ 만료됨',
        color: '#FF3B30',
        urgency: 'expired',
        backgroundColor: '#FFE5E5',
      };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    let text = '';
    let color = '';
    let urgency = '';
    let backgroundColor = '';

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      if (days === 1) {
        text = '🗓️ D-1';
        color = '#FF9500';
        urgency = 'warning';
        backgroundColor = '#FFF3E0';
      } else {
        text = `📅 D-${days}`;
        color = '#34C759';
        urgency = 'safe';
        backgroundColor = '#E8F8E8';
      }
    } else if (hours >= 1) {
      if (hours <= 3) {
        text = `⚡ ${hours}시간 ${minutes}분`;
        color = '#FF9500';
        urgency = 'warning';
        backgroundColor = '#FFF3E0';
      } else {
        text = `⏰ ${hours}시간 ${minutes}분`;
        color = '#007AFF';
        urgency = 'normal';
        backgroundColor = '#E3F2FD';
      }
    } else if (minutes >= 1) {
      text = `🔥 ${minutes}분 ${seconds}초`;
      color = '#FF3B30';
      urgency = 'critical';
      backgroundColor = '#FFE5E5';
    } else {
      text = `💥 ${seconds}초`;
      color = '#FF3B30';
      urgency = 'critical';
      backgroundColor = '#FFE5E5';
    }

    return { text, color, urgency, backgroundColor };
  };

  const getProgressColor = (
    progress: number,
    completed: boolean
  ): [string, string] => {
    if (completed) return ['#4CAF50', '#45A049'];
    if (progress >= 0.8) return ['#FF6B6B', '#FF5252'];
    if (progress >= 0.5) return ['#FFD93D', '#FFC107'];
    return ['#6C5CE7', '#5A52D3'];
  };

  const renderChallenge = (challenge: Challenge, index: number) => {
    const progress = Math.min(
      challenge.currentCount / challenge.targetCount,
      1
    );
    const progressWidth = `${progress * 100}%`;
    const timeInfo = getTimeRemainingInfo(challenge.expiresAt);
    const progressColors = getProgressColor(progress, challenge.completed);
    const isLastCard = index === currentChallenges.length - 1;

    const cardTransform = {
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -10],
          }),
        },
      ],
    };

    const shouldPulse = timeInfo.urgency === 'critical' && !challenge.completed;

    return (
      <Animated.View
        key={challenge._id}
        style={[
          styles.challengeCard,
          cardTransform,
          shouldPulse && { transform: [{ scale: pulseAnim }] },
          isLastCard && { marginBottom: 0 },
        ]}
      >
        <LinearGradient
          colors={
            challenge.completed
              ? ['#E8F8E8', '#F0FFF0']
              : ['#FFFFFF', '#FAFBFF']
          }
          style={styles.cardGradient}
        >
          <View style={styles.challengeHeader}>
            <View style={styles.titleSection}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              {challenge.completed && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>✨ 완료</Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.timeChip,
                { backgroundColor: timeInfo.backgroundColor },
              ]}
            >
              <Text style={[styles.timeText, { color: timeInfo.color }]}>
                {timeInfo.text}
              </Text>
            </View>
          </View>

          <Text style={styles.challengeDescription}>
            {challenge.description}
          </Text>

          <View style={styles.progressSection}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={progressColors}
                  style={[
                    styles.progressFill,
                    { width: progressWidth as DimensionValue },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressText}>
                  {challenge.currentCount}/{challenge.targetCount}
                </Text>
                <Text style={styles.progressPercentage}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.challengeFooter}>
            <View style={styles.rewardChip}>
              <Text style={styles.rewardText}>
                {getRewardText(challenge.reward)}
              </Text>
            </View>
            {challenge.completed && (
              <View style={styles.celebrationEmoji}>
                <Text style={styles.emojiText}>🎉</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>챌린지</Text>
          <Text style={styles.headerSubtitle}>오늘도 힘내세요!</Text>
        </View>
      </LinearGradient>

      <View
        style={styles.tabContainer}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setTabWidth(width);
        }}
      >
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, tabWidth ? tabWidth / 2 : 0],
                  }),
                },
              ],
            },
          ]}
        />
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'daily' && styles.activeTab]}
          onPress={() => setSelectedTab('daily')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'daily' && styles.activeTabText,
            ]}
          >
            🌅 일일 도전
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'weekly' && styles.activeTab]}
          onPress={() => setSelectedTab('weekly')}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 'weekly' && styles.activeTabText,
            ]}
          >
            📅 주간 도전
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.challengesList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentChallenges.length > 0 ? (
          currentChallenges.map((challenge, index) =>
            renderChallenge(challenge, index)
          )
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>
              {selectedTab === 'daily' ? '🌱' : '🗓️'}
            </Text>
            <Text style={styles.emptyStateTitle}>
              {selectedTab === 'daily'
                ? '새로운 도전을 기다리는 중'
                : '주간 도전 준비 중'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              곧 새로운 도전과제가 등장할 예정이에요!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  headerGradient: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 25,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    marginRight: 4,
    backgroundColor: '#667eea',
    borderRadius: 25,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 25,
    zIndex: 1,
  },
  activeTab: {},
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  challengesList: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  challengeCard: {
    marginBottom: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardGradient: {
    borderRadius: 20,
    padding: 24,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  completedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  completedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  challengeDescription: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 20,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
  },
  progressBar: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardChip: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
  },
  celebrationEmoji: {
    padding: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
  },
});
