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
      <Stack.Screen name='difficulty' options={{ title: 'Difficulty' }} />
      <Stack.Screen name='type' options={{ title: 'Type' }} />
      <Stack.Screen name='content' options={{ title: 'Content' }} />
      <Stack.Screen name='result' options={{ title: 'Result' }} />
    </Stack>
  );
}
