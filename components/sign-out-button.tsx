import { useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function SignOutButton() {
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
    <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
      <Ionicons name='log-out-outline' size={24} color='#6b7280' />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  signOutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
});
