import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SwipeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">스와이프 스택</ThemedText>
      <ThemedText>무한 퀴즈 피드가 곧 연결됩니다.</ThemedText>
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
