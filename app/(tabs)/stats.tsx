import AchievementList from '@/components/achievement-list';
import StatCardList from '@/components/stat-card-list';
import { useAuth } from '@clerk/clerk-expo';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatsScreen() {
  const { userId } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>통계</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <StatCardList userId={userId} />
        <AchievementList userId={userId} />

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
