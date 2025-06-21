import { api } from '@/convex/_generated/api';
import { formatDate } from '@/utils/format-date';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

interface LevelProgressProps {
  currentLevel: number;
  currentExp: number;
  nextLevelExp: number;
  delay?: number;
  unlockedCount?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function LevelProgress({
  currentLevel,
  currentExp,
  nextLevelExp,
  delay = 0,
  unlockedCount,
}: LevelProgressProps) {
  const currentUser = useQuery(api.users.getCurrentUserByClerkId);
  const { _creationTime, fullName, profileImage } = currentUser || {};
  const completedChallenges = useQuery(
    api.challenges.getChallengeStats,
    currentUser ? { userId: currentUser.clerkId } : 'skip'
  );

  const progress = useSharedValue(0);
  const scale = useSharedValue(0);
  const profileScale = useSharedValue(0);

  const ratio = currentExp / (currentExp + nextLevelExp);
  const percentage = Math.min(Math.round(ratio * 100), 100);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(ratio));
    scale.value = withDelay(delay, withSpring(1));
    profileScale.value = withDelay(delay + 200, withSpring(1));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const profileAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: profileScale.value }],
  }));

  const percentageStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  let percentageColor = '#bdc3c7';
  let percentageExtra = '✨ 시작이 멋져요';

  if (percentage >= 95) {
    percentageColor = '#f39c12';
    percentageExtra = '🚀 마지막 한 걸음!';
  } else if (percentage >= 90) {
    percentageColor = '#e67e22';
    percentageExtra = '🔥 집중력 폭발 중!';
  } else if (percentage >= 70) {
    percentageColor = '#27ae60';
    percentageExtra = '💚 꾸준히 성장 중';
  } else if (percentage >= 50) {
    percentageColor = '#3498db';
    percentageExtra = '💙 중반 돌파!';
  } else if (percentage >= 20) {
    percentageColor = '#9b59b6';
    percentageExtra = '💫 시작이 반!';
  } else {
    percentageColor = '#95a5a6';
    percentageExtra = '🌱 첫걸음 응원해요';
  }

  return (
    <Animated.View style={[styles.levelContainer, animatedStyle]}>
      {/* 사용자 프로필 섹션 */}
      <Animated.View style={[styles.profileSection, profileAnimatedStyle]}>
        <View style={styles.profileImageContainer}>
          <Image source={{ uri: profileImage }} style={styles.profileImage} />
          <View style={styles.levelBadgeSmall}>
            <Text style={styles.levelTextSmall}>{currentLevel}</Text>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.userSubInfo}>
            🏆 {completedChallenges?.totalCompleted}개 챌린지 완료 • 🏅{' '}
            {unlockedCount}개 배지 획득
          </Text>
          <Text style={styles.joinDate}>
            {formatDate(_creationTime)}부터 함께하는 중
          </Text>
        </View>
      </Animated.View>

      {/* 기존 레벨 진행도 섹션 */}
      <View style={styles.levelHeader}>
        <Text style={styles.levelExp}>
          {currentExp.toLocaleString()}/
          {(currentExp + nextLevelExp).toLocaleString()}포인트 (
          {nextLevelExp.toLocaleString()}
          포인트 to Lv.
          {currentLevel + 1})
        </Text>
      </View>

      <Animated.Text
        style={[
          styles.percentageText,
          { color: percentageColor },
          percentageStyle,
        ]}
      >
        {percentage}% {percentageExtra}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  levelContainer: {
    marginHorizontal: 20,
    marginVertical: 30,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#6c5ce7',
  },
  levelBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  levelTextSmall: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  userSubInfo: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  joinDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  levelHeader: {
    marginBottom: 20,
    alignSelf: 'center',
  },
  levelExp: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  percentageText: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },
});
