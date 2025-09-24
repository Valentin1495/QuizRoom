import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useRefresh } from '@/hooks/use-refresh';
import { getAuth } from '@react-native-firebase/auth';
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
  const userId = getAuth().currentUser?.uid;
  const challenges = useQuery(api.challenges.getChallenges, userId ? { userId } : 'skip') || [];
  const generateDaily = useMutation(api.challenges.generateDailyChallenges);
  const generateWeekly = useMutation(api.challenges.generateWeeklyChallenges);

  // 애니메이션 값들
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef(
    Array(10)
      .fill(0)
      .map(() => new Animated.Value(0)),
  ).current;

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

  // 카드 입장 애니메이션
  useEffect(() => {
    const animations = cardAnimations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    Animated.stagger(50, animations).start();
  }, [selectedTab]);

  // 펄스 애니메이션 (긴급한 챌린지용)
  useEffect(() => {
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    startPulse();
  }, []);

  const dailyChallenges = challenges.filter((c) => c.type === 'daily');
  const weeklyChallenges = challenges.filter((c) => c.type === 'weekly');

  const currentChallenges = selectedTab === 'daily' ? dailyChallenges : weeklyChallenges;

  const getRewardText = (reward: Challenge['reward']) => {
    switch (reward.type) {
      case 'points':
        return `${reward.value}포인트`;
      case 'streak':
        return `${reward.value}일 연속`;
    }
  };

  const getTimeRemainingInfo = (expiresAt: number) => {
    const remaining = expiresAt - currentTime;

    if (remaining <= 0) {
      return {
        text: '만료',
        emoji: '⏰',
        color: '#FF3B30',
        urgency: 'expired',
        backgroundColor: '#FFE5E5',
      };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    let text = '';
    let emoji = '';
    let color = '';
    let urgency = '';
    let backgroundColor = '';

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      if (days === 1) {
        text = 'D-1';
        emoji = '🌅';
        color = '#FF9500';
        urgency = 'warning';
        backgroundColor = '#FFF3E0';
      } else {
        text = `D-${days}`;
        emoji = '📅';
        color = '#34C759';
        urgency = 'safe';
        backgroundColor = '#E8F8E8';
      }
    } else if (hours >= 1) {
      if (hours <= 3) {
        text = `${hours}시간 ${minutes}분`;
        emoji = '⚡';
        color = '#FF9500';
        urgency = 'warning';
        backgroundColor = '#FFF3E0';
      } else {
        text = `${hours}시간 ${minutes}분`;
        emoji = '⏱️';
        color = '#007AFF';
        urgency = 'normal';
        backgroundColor = '#E3F2FD';
      }
    } else if (minutes >= 1) {
      text = `${minutes}분 ${seconds}초`;
      emoji = '🔥';
      color = '#FF3B30';
      urgency = 'critical';
      backgroundColor = '#FFE5E5';
    } else {
      text = `${seconds}초`;
      emoji = '💥';
      color = '#FF3B30';
      urgency = 'critical';
      backgroundColor = '#FFE5E5';
    }

    return { text, emoji, color, urgency, backgroundColor };
  };

  const getProgressColor = (progress: number, completed: boolean): [string, string] => {
    if (completed) return ['#00D4AA', '#00C29A'];
    if (progress >= 0.8) return ['#FF6B6B', '#FF5252'];
    if (progress >= 0.5) return ['#FFD93D', '#FFC107'];
    return ['#667EEA', '#5A67D8'];
  };

  const renderChallenge = (challenge: Challenge, index: number) => {
    const progress = Math.min(challenge.currentCount / challenge.targetCount, 1);
    const progressWidth = `${progress * 100}%`;
    const timeInfo = getTimeRemainingInfo(challenge.expiresAt);
    const progressColors = getProgressColor(progress, challenge.completed);
    const shouldPulse = timeInfo.urgency === 'critical' && !challenge.completed;

    const cardAnimation = cardAnimations[index] || new Animated.Value(1);

    return (
      <Animated.View
        key={challenge._id}
        style={[
          styles.challengeCard,
          {
            opacity: cardAnimation,
            transform: [
              {
                translateY: cardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
              shouldPulse ? { scale: pulseAnim } : { scale: 1 },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={challenge.completed ? ['#E8FFF4', '#F0FFF8'] : ['#FFFFFF', '#FAFBFF']}
          style={styles.cardGradient}
        >
          {/* 상단 헤더 */}
          <View style={styles.challengeHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <View
                style={[
                  styles.statusChip,
                  challenge.completed ? styles.completedChip : styles.activeChip,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    challenge.completed ? styles.completedText : styles.activeText,
                  ]}
                >
                  {challenge.completed ? '✨ 완료' : '진행중'}
                </Text>
              </View>
            </View>

            <View style={styles.timeContainer}>
              <Text style={styles.timeEmoji}>{timeInfo.emoji}</Text>
              <Text style={[styles.timeText, { color: timeInfo.color }]}>{timeInfo.text}</Text>
            </View>
          </View>

          {/* 설명 */}
          <Text style={styles.challengeDescription}>{challenge.description}</Text>

          {/* 진행률 섹션 */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>진행률</Text>
              <Text style={styles.progressStats}>
                {challenge.currentCount}/{challenge.targetCount}
              </Text>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={progressColors}
                  style={[styles.progressFill, { width: progressWidth as DimensionValue }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={styles.progressPercentage}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>

          {/* 하단 푸터 */}
          <View style={styles.challengeFooter}>
            <View style={styles.rewardSection}>
              <Text style={styles.rewardLabel}>보상</Text>
              <View style={styles.rewardChip}>
                <Text style={styles.rewardIcon}>
                  {challenge.reward.type === 'points' ? '🏆' : '🔥'}
                </Text>
                <Text style={styles.rewardText}>{getRewardText(challenge.reward)}</Text>
              </View>
            </View>

            {challenge.completed && (
              <View style={styles.celebrationContainer}>
                <Text style={styles.celebrationEmoji}>🎉</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 헤더 */}
      <LinearGradient colors={Colors.light.gradientColors} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>챌린지</Text>
          <Text style={styles.headerSubtitle}>매일 성장하는 당신을 응원해요! 💪</Text>
        </View>
      </LinearGradient>

      {/* 탭 네비게이션 */}
      <View style={styles.tabWrapper}>
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
          <TouchableOpacity style={styles.tab} onPress={() => setSelectedTab('daily')}>
            <Text style={[styles.tabText, selectedTab === 'daily' && styles.activeTabText]}>
              🌅 일일 도전
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setSelectedTab('weekly')}>
            <Text style={[styles.tabText, selectedTab === 'weekly' && styles.activeTabText]}>
              📅 주간 도전
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 챌린지 리스트 */}
      <ScrollView
        style={styles.challengesList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {currentChallenges.length > 0 ? (
          currentChallenges.map((challenge, index) => renderChallenge(challenge, index))
        ) : (
          <View style={styles.emptyState}>
            <LinearGradient colors={Colors.light.gradientColors} style={styles.emptyStateIcon}>
              <Text style={styles.emptyStateEmoji}>{selectedTab === 'daily' ? '🌱' : '🗓️'}</Text>
            </LinearGradient>
            <Text style={styles.emptyStateTitle}>
              {selectedTab === 'daily'
                ? '새로운 일일 도전을 준비 중이에요'
                : '주간 도전을 준비 중이에요'}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              잠시만 기다려주세요. 곧 새로운 도전이 시작됩니다!
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
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.light.primary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.light.primary,
    opacity: 0.9,
    fontWeight: '500',
  },
  tabWrapper: {
    paddingHorizontal: 24,
    marginTop: -20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: Colors.light.secondary,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    zIndex: 1,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  challengesList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  challengeCard: {
    marginBottom: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardGradient: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  challengeHeader: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  challengeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 12,
    lineHeight: 26,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completedChip: {
    backgroundColor: '#DCFCE7',
  },
  activeChip: {
    backgroundColor: '#E0E7FF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  completedText: {
    color: '#16A34A',
  },
  activeText: {
    color: '#5B21B6',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  timeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  challengeDescription: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 24,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  progressStats: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667EEA',
    minWidth: 40,
    textAlign: 'right',
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardSection: {
    flex: 1,
  },
  rewardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  rewardIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
  },
  celebrationContainer: {
    padding: 8,
  },
  celebrationEmoji: {
    fontSize: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateEmoji: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
});
