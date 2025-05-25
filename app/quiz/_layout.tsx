import { Colors } from '@/constants/Colors';
import { Stack } from 'expo-router';

export default function QuizLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.light.background },
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name='index' />
      <Stack.Screen name='result' />
    </Stack>
  );
}
