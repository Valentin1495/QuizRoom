import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

const isDev = __DEV__;

export const ADMOB_AD_UNIT_IDS = {
  interstitial: isDev
    ? TestIds.INTERSTITIAL
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL ?? '',
        ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL ?? '',
        default: '',
      }),

  rewarded: isDev
    ? TestIds.REWARDED
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED ?? '',
        ios: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED ?? '',
        default: '',
      }),
} as const;
