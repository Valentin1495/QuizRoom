import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../theme/tokens';
import { useGameStore } from '../../store/gameStore';
import { useEffect } from 'react';

export default function ResultScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { score, reset } = useGameStore();

  useEffect(() => {
    // 컴포넌트가 언마운트될 때 스토어 리셋
    return () => {
      reset();
    };
  }, [reset]);

  const handleRetry = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>퀴즈 완료!</Text>
        <Text style={styles.scoreLabel}>최종 점수</Text>
        <Text style={styles.scoreValue}>{score}</Text>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={handleRetry}>
          <Text style={styles.buttonText}>다시하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  scoreLabel: {
    ...Typography.body,
    color: Colors.subtext,
    fontSize: 20,
  },
  scoreValue: {
    ...Typography.h1,
    color: Colors.accent,
    fontSize: 80,
    fontWeight: 'bold',
    marginBottom: Spacing.xl,
  },
  footer: {
    padding: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  buttonText: {
    ...Typography.button,
    color: Colors.background,
  },
});