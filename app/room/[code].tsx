import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PartyRoomScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const partyCode = (params.code ?? '?????').toString().toUpperCase();

  return (
    <>
      <Stack.Screen options={{ title: `파티 ${partyCode}` }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title">실시간 파티룸</ThemedText>
        <ThemedText>
          코드 {partyCode} 방의 참가자, 문제, 리더보드가 여기서 표시될 예정입니다.
        </ThemedText>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
});
