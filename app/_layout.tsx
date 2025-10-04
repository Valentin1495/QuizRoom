import 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import { FirebaseAuthTypes, getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Google Sign-In 설정
GoogleSignin.configure({
  webClientId: '819818280538-emjirg8e17j6cc4qhbe98dcsgmshk586.apps.googleusercontent.com',
});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initializing, setInitializing] = useState(true);
  console.log('user', user);
  // 2. Convex 인증 함수를 useCallback으로 감싸 안정적인 참조 유지
  const getFirebaseIdToken = useCallback(async () => {
    // user 상태가 변경될 때마다 새로운 토큰을 가져오도록 함
    const token = await user?.getIdToken();
    return token ?? null;
  }, [user]);

  // 3. user 상태가 변경될 때마다 Convex 인증을 다시 설정
  useEffect(() => {
    convex.setAuth(getFirebaseIdToken);
  }, [getFirebaseIdToken]);


  useEffect(() => {
    const handleAuthStateChanged = (user: FirebaseAuthTypes.User | null) => {
      setUser(user);
      if (initializing) {
        setInitializing(false);
      }
    };

    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber; // unmount 시 구독 해제
  }, []);

  // 4. 라우팅 로직을 초기화 완료 후에만 실행하도록 통합
  useEffect(() => {
    if (initializing) {
      return; // Firebase 초기화가 완료될 때까지 대기
    }

    if (user) {
      // 사용자가 로그인 되어 있으면 홈으로 이동
      router.replace('/(tabs)/home');
    } else {
      // 로그아웃 상태이면 온보딩 화면으로 이동
      router.replace('/onboarding');
    }
  }, [initializing, user, router]);

  // 초기화 중에는 아무것도 렌더링하지 않음 (Splash Screen이 보임)
  if (initializing) {
    return null;
  }

  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile-setup" />
      </Stack>
    </ConvexProvider>
  );
}

// 1. 최초 로그인: 사용자가 구글로 처음 로그인하면, storeUser 함수가 
// 자동으로 호출되어 구글 계정의 이름과 프로필 사진으로 DB에 사용자 
// 정보를 생성합니다.
// 2. 프로필 확인: _layout.tsx의 라우팅 로직에 따라, 프로필이 설정되지 
// 않은 사용자는 profile-setup 화면으로 이동하게 됩니다. (현재 
// 라우팅 로직은 로그인만 되면 홈으로 보내므로, 프로필이 비어있는지 
// 확인하는 추가 로직을 _layout.tsx에 넣으면 더 완벽해집니다.)
// 3. 프로필 수정: profile-setup 화면에서 사용자는 DB에 저장된 자신의 
// 프로필(구글 정보로 자동 생성된)을 확인하고, 원하는 대로 닉네임을 
// 수정한 후 저장할 수 있습니다.
// 4. 재로그인: 사용자가 로그아웃 후 다시 로그인해도, 수정된 프로필 
// 정보는 그대로 유지됩니다.