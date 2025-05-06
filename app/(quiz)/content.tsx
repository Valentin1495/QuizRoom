import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Content() {
  return (
    <LinearGradient
      colors={['#272052', '#AF7EE7']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View></View>
        <Text>Content</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({});
