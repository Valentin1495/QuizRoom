import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function QuizScreen() {
  const { sessionId } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Quiz Session: {sessionId}</Text>
    </View>
  );
}
