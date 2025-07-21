import { Ionicons } from '@expo/vector-icons';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';

export default function SignOutButton() {
  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          try {
            signOut(getAuth()).then(() => {
              // console.log('signed out');
              GoogleSignin.revokeAccess();
            });
          } catch (error) {
            console.error('로그아웃 중 오류 발생:', error);
            Alert.alert('오류', '로그아웃 중 문제가 발생했습니다.');
          }
        },
      },
    ]);
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
