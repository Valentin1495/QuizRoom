import AchievementList from '@/components/achievement-list';
import StatCardList from '@/components/stat-card-list';
import { api } from '@/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyStatsScreen() {
  const { userId } = useAuth();
  const userAchievements = useQuery(
    api.gamification.getAchievements,
    userId ? { userId } : 'skip'
  );
  const unlockedCount = userAchievements?.filter((ua) => ua.unlockedAt).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 정보</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <StatCardList userId={userId} unlockedCount={unlockedCount} />
        <AchievementList userAchievements={userAchievements} />

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  masteryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 35,
  },
  bottomPadding: {
    height: 20,
  },
});
