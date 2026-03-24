import { useCallback, useEffect, useRef, useState } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';

import { ADMOB_AD_UNIT_IDS } from '@/lib/admob';

export function useInterstitialAd() {
  const adRef = useRef<InterstitialAd | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadAd = useCallback(() => {
    const ad = InterstitialAd.createForAdRequest(ADMOB_AD_UNIT_IDS.interstitial, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
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
    (onAdClosed?: () => void) => {
      if (!adRef.current || !isLoaded) {
        // 광고가 준비되지 않았으면 콜백만 즉시 실행
        onAdClosed?.();
        return;
      }

      if (onAdClosed) {
        const unsub = adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          unsub();
          onAdClosed();
        });
      }

      adRef.current.show();
    },
    [isLoaded],
  );

  return { showAd, isLoaded };
}
