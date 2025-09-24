import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

export default function LeaderboardScreen() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = useQuery(api.leaderboard.getTopByDate, { date: today, limit: 100 });
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Stack.Screen options={{ headerShown: true, title: '리더보드' }} />
      <FlatList
        data={entries ?? []}
        keyExtractor={(item: any) => item._id}
        renderItem={({ item, index }) => (
          <View
            style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={{ fontWeight: '700' }}>{index + 1}</Text>
            <Text>{item.handle || 'player'}</Text>
            <Text style={{ fontWeight: '700' }}>{item.score}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />
    </View>
  );
}
