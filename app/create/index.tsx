import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function CreateScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">퀴즈 만들기</ThemedText>
      <ThemedText>Gemini 기반 제작 워크플로우가 여기에서 시작됩니다.</ThemedText>
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
