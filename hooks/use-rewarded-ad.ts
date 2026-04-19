import { useCallback, useEffect, useRef, useState } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';

import type { AdRewardSpec } from '@/constants/ad-rewards';
import { isAdRewardMatch } from '@/constants/ad-rewards';
import { useAdConsent } from '@/hooks/use-ad-consent';
import { ADMOB_AD_UNIT_IDS } from '@/lib/admob';

export type AdReward = AdRewardSpec;

export function useRewardedAd() {
  const adRef = useRef<RewardedAd | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { canRequestAds, requestNonPersonalizedAdsOnly } = useAdConsent();

  const clearSubscriptions = useCallback(() => {
    cleanupRef.current.forEach((unsubscribe) => unsubscribe());
    cleanupRef.current = [];
  }, []);

  const loadAd = useCallback(() => {
    clearSubscriptions();

    if (!canRequestAds) {
      adRef.current = null;
      setIsLoaded(false);
      return;
    }

    const ad = RewardedAd.createForAdRequest(ADMOB_AD_UNIT_IDS.rewarded, {
      requestNonPersonalizedAdsOnly,
    });

    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
    });

    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      // 광고가 닫히면 다음 표시를 위해 자동 재로드
      loadAd();
    });

    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
    });

    cleanupRef.current = [unsubscribeLoaded, unsubscribeClosed, unsubscribeError];
    adRef.current = ad;
    ad.load();
  }, [canRequestAds, clearSubscriptions, requestNonPersonalizedAdsOnly]);

  useEffect(() => {
    loadAd();
    return () => {
      clearSubscriptions();
      adRef.current = null;
    };
  }, [clearSubscriptions, loadAd]);

  const showAd = useCallback(
    (callbacks?: {
      expectedReward?: AdRewardSpec;
      onEarnedReward?: (reward: AdReward) => void;
      onRewardMismatch?: (reward: AdReward) => void;
      onAdClosed?: () => void;
    }) => {
      if (!adRef.current || !isLoaded) {
        // 광고가 준비되지 않았으면 보상 없이 콜백 실행
        callbacks?.onAdClosed?.();
        return;
      }

      const unsubReward = adRef.current.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward: { type: string; amount: number }) => {
          unsubReward();
          const resolvedReward: AdReward = {
            type: reward.type,
            amount: reward.amount,
          };
          const expectedReward = callbacks?.expectedReward;
          if (expectedReward && !isAdRewardMatch(resolvedReward, expectedReward)) {
            callbacks?.onRewardMismatch?.(resolvedReward);
            return;
          }
          callbacks?.onEarnedReward?.(resolvedReward);
        },
      );

      if (callbacks?.onAdClosed) {
        const unsubClosed = adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          unsubClosed();
          callbacks.onAdClosed?.();
        });
      }

      adRef.current.show();
    },
    [isLoaded],
  );

  return { showAd, isLoaded };
}
