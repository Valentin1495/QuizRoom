import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors as tokens } from '@/theme/tokens';

export default function LeaderboardScreen() {
  const leaderboard = useQuery(api.leaderboards.getWeeklyLeaderboard, { topN: 50 });

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.rank}>{index + 1}</Text>
      <Text style={styles.nickname}>{item.user?.nickname || 'Guest'}</Text>
      <Text style={styles.score}>{item.score.toLocaleString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Weekly Leaderboard</Text>
      {leaderboard === undefined && <ActivityIndicator color={tokens.accent} size="large" />}
      {leaderboard && leaderboard.length === 0 && (
        <Text style={styles.emptyText}>No one has played this week yet. Be the first!</Text>
      )}
      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: tokens.text,
    textAlign: 'center',
    marginVertical: 20,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tokens.subtext,
    width: 40,
  },
  nickname: {
    fontSize: 18,
    color: tokens.text,
    flex: 1,
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: tokens.accent,
  },
  emptyText: {
    color: tokens.subtext,
    textAlign: 'center',
    marginTop: 50,
  }
});
