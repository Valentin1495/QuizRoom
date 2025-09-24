import AchievementList from '@/components/achievement-list';
import StatCardList from '@/components/stat-card-list';
import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { getAuth } from '@react-native-firebase/auth';
import { useQuery } from 'convex/react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MyStatsScreen() {
  const userId = getAuth().currentUser?.uid;
  const insets = useSafeAreaInsets();
  const userAchievements = useQuery(api.gamification.getAchievements, userId ? { userId } : 'skip');
  const unlockedCount = userAchievements?.filter((ua) => ua.unlockedAt).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 정보</Text>
      </View>

      {userAchievements ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <StatCardList userId={userId} unlockedCount={unlockedCount} />
          <AchievementList userAchievements={userAchievements} />

          {/* Bottom Padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        <ActivityIndicator size="large" color={Colors.light.secondary} />
      )}
    </View>
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
    paddingVertical: 12,
    paddingTop: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.secondary,
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
