import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * 햅틱 피드백 유틸리티
 * iOS와 Android에서 햅틱 피드백을 제공합니다.
 */

/**
 * 가벼운 햅틱 - 정답, 선택, 버튼 탭
 */
export const lightHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 중간 햅틱 - 오답, 페이지 전환
 */
export const mediumHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 무거운 햅틱 - 중요한 이벤트
 */
export const heavyHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 성공 햅틱 - 완주, 배지 획득
 */
export const successHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 경고 햅틱 - 타이머 긴급(3초부터 매초)
 */
export const warningHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 에러 햅틱 - 치명적 오류
 */
export const errorHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        // Haptic not supported on device
    });
};

/**
 * 선택 햅틱 - UI 요소 선택 시
 */
export const selectionHaptic = () => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {
        // Haptic not supported on device
    });
};

