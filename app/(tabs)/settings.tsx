import { Colors } from '@/constants/Colors';
import { useClerk } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Settings() {
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to your desired page
      Linking.openURL(Linking.createURL('/(auth)/sign-in'));
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleSignOut}>
        <Text>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
