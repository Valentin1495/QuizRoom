import { useQuery } from 'convex/react';
import { getAuth } from 'firebase/auth';
import React from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Text, View } from 'react-native';
import { api } from '../convex/_generated/api';

interface UserProfileProps {
  // 추가 props가 필요한 경우 여기에 정의
}

const UserProfile: React.FC<UserProfileProps> = () => {
  const [user, loading, error] = useAuthState(getAuth());
  const userData = useQuery(
    api.users.getUserByFirebaseUid,
    user ? { firebaseUid: user.uid } : 'skip',
  );

  if (loading) return <Text>인증 확인 중...</Text>;
  if (error) return <Text>인증 오류: {error.message}</Text>;
  if (!user) return <Text>로그인이 필요합니다</Text>;
  if (userData === undefined) return <Text>로딩 중...</Text>;
  if (userData === null) return <Text>사용자 정보를 찾을 수 없습니다</Text>;

  return (
    <View>
      <Text>이름: {userData.displayName || '이름 없음'}</Text>
      <Text>이메일: {userData.email}</Text>
      <Text>마지막 로그인: {new Date(userData.lastLoginAt).toLocaleString()}</Text>
      <Text>가입일: {new Date(userData._creationTime).toLocaleString()}</Text>
    </View>
  );
};

export default UserProfile;
