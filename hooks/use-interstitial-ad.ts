import { useCallback, useEffect, useRef, useState } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';

import { useAdConsent } from '@/hooks/use-ad-consent';
import { ADMOB_AD_UNIT_IDS } from '@/lib/admob';

export function useInterstitialAd() {
  const adRef = useRef<InterstitialAd | null>(null);
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

    const ad = InterstitialAd.createForAdRequest(ADMOB_AD_UNIT_IDS.interstitial, {
      requestNonPersonalizedAdsOnly,
    });

    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
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
