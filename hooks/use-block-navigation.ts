import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useBlockNavigation(block: boolean = true) {
  const navigation = useNavigation();

  // ✅ Android 하드웨어 뒤로가기 막기
  useEffect(() => {
    if (!block || Platform.OS !== 'android') return;

    const onBackPress = () => true;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, [block]);

  // ✅ iOS 스와이프 제스처 막기
  useEffect(() => {
    if (!block) return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // 스와이프나 뒤로가기 버튼 이벤트 방지
      e.preventDefault();
    });

    return unsubscribe;
  }, [block, navigation]);
}
