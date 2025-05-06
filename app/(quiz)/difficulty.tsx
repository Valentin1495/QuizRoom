import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DifficultyScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TouchableOpacity>
        <Text>쉬움</Text>
      </TouchableOpacity>
      <TouchableOpacity>
        <Text>보통</Text>
      </TouchableOpacity>
      <TouchableOpacity>
        <Text>어려움</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});
