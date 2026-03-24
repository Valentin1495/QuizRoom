import { useCallback, useEffect, useRef, useState } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';

import { ADMOB_AD_UNIT_IDS } from '@/lib/admob';

export type AdReward = {
  type: string;
  amount: number;
};

export function useRewardedAd() {
  const adRef = useRef<RewardedAd | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAd = useCallback(() => {
    const ad = RewardedAd.createForAdRequest(ADMOB_AD_UNIT_IDS.rewarded, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
    });

    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setIsLoaded(false);
      unsubscribeLoaded();
      unsubscribeClosed();
      // 광고가 닫히면 다음 표시를 위해 자동 재로드
      loadAd();
    });

    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    });

    adRef.current = ad;
    ad.load();
  }, []);

  useEffect(() => {
    loadAd();
    return () => {
      adRef.current = null;
    };
  }, [loadAd]);

  const showAd = useCallback(
    (callbacks?: { onEarnedReward?: (reward: AdReward) => void; onAdClosed?: () => void }) => {
      if (!adRef.current || !isLoaded) {
        // 광고가 준비되지 않았으면 보상 없이 콜백 실행
        callbacks?.onAdClosed?.();
        return;
      }

      const unsubReward = adRef.current.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          unsubReward();
          callbacks?.onEarnedReward?.(reward);
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
