import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PartyScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">파티 라이브</ThemedText>
      <ThemedText>방 생성과 실시간 리더보드가 준비됩니다.</ThemedText>
    </ThemedView>
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
