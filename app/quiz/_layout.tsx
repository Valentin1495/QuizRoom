import { Colors } from '@/constants/Colors';
import { Stack } from 'expo-router';

export default function QuizLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.light.background },
      }}
    >
      <Stack.Screen name='[quizType]/difficulty' />
      <Stack.Screen name='[quizType]/question-format' />
      <Stack.Screen name='[quizType]/question' />
      <Stack.Screen
        name='[quizType]/result'
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}
