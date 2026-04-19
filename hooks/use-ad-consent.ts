import type { PropsWithChildren } from 'react';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as GoogleMobileAds from 'react-native-google-mobile-ads';

type AdConsentContextValue = {
  isConsentGathering: boolean;
  canRequestAds: boolean;
  requestNonPersonalizedAdsOnly: boolean;
  isPrivacyOptionsRequired: boolean;
  openPrivacyOptions: () => Promise<void>;
};

type ConsentInfoLike = {
  canRequestAds?: boolean;
  privacyOptionsRequirementStatus?: string | number;
  isPrivacyOptionsRequired?: boolean;
};

type AdsConsentLike = {
  requestInfoUpdate?: (options?: Record<string, unknown>) => Promise<unknown>;
  loadAndShowConsentFormIfRequired?: () => Promise<unknown>;
  gatherConsent?: (options?: Record<string, unknown>) => Promise<unknown>;
  showForm?: () => Promise<unknown>;
  getConsentInfo?: () => Promise<ConsentInfoLike>;
  showPrivacyOptionsForm?: () => Promise<unknown>;
};

const noopAsync = async () => {};

const fallbackContextValue: AdConsentContextValue = {
  isConsentGathering: false,
  canRequestAds: true,
  requestNonPersonalizedAdsOnly: true,
  isPrivacyOptionsRequired: false,
  openPrivacyOptions: noopAsync,
};

const AdConsentContext = createContext<AdConsentContextValue | undefined>(undefined);

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolvePrivacyOptionsRequired(value: string | number | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    return value.toUpperCase() === 'REQUIRED';
  }
  return false;
}

function resolveRequestNonPersonalizedAdsOnly(canRequestAds: boolean): boolean {
  // Safe default: until consent pipeline confirms requestability, keep NPA mode.
  return !canRequestAds;
}

export function AdConsentProvider({ children }: PropsWithChildren) {
  const [isConsentGathering, setIsConsentGathering] = useState(false);
  const [canRequestAds, setCanRequestAds] = useState(false);
  const [requestNonPersonalizedAdsOnly, setRequestNonPersonalizedAdsOnly] = useState(true);
  const [isPrivacyOptionsRequired, setIsPrivacyOptionsRequired] = useState(false);

  const adsConsent = useMemo<AdsConsentLike | null>(() => {
    const moduleValue = GoogleMobileAds as unknown as { AdsConsent?: AdsConsentLike };
    return moduleValue.AdsConsent ?? null;
  }, []);

  const refreshConsent = useCallback(async () => {
    if (!adsConsent) {
      // Module unavailable: keep serving with conservative NPA fallback.
      setCanRequestAds(true);
      setRequestNonPersonalizedAdsOnly(true);
      setIsPrivacyOptionsRequired(false);
      return;
    }

    setIsConsentGathering(true);

    try {
      const shouldForceEeaDebug = __DEV__ && isTruthyEnv(process.env.EXPO_PUBLIC_ADMOB_UMP_DEBUG_EEA);
      const requestOptions: Record<string, unknown> = {};

      if (shouldForceEeaDebug) {
        const moduleValue = GoogleMobileAds as unknown as {
          AdsConsentDebugGeography?: { EEA?: number };
        };
        requestOptions.debugGeography = moduleValue.AdsConsentDebugGeography?.EEA ?? 1;
      }

      if (typeof adsConsent.requestInfoUpdate === 'function') {
        await adsConsent.requestInfoUpdate(requestOptions);
      }

      if (typeof adsConsent.loadAndShowConsentFormIfRequired === 'function') {
        await adsConsent.loadAndShowConsentFormIfRequired();
      } else if (typeof adsConsent.gatherConsent === 'function') {
        await adsConsent.gatherConsent(requestOptions);
      } else if (typeof adsConsent.showForm === 'function') {
        await adsConsent.showForm();
      }

      const consentInfo = typeof adsConsent.getConsentInfo === 'function'
        ? await adsConsent.getConsentInfo()
        : null;

      const nextCanRequestAds = Boolean(consentInfo?.canRequestAds);
      const nextPrivacyOptionsRequired = resolvePrivacyOptionsRequired(
        consentInfo?.privacyOptionsRequirementStatus ?? consentInfo?.isPrivacyOptionsRequired
      );

      setCanRequestAds(nextCanRequestAds);
      setRequestNonPersonalizedAdsOnly(resolveRequestNonPersonalizedAdsOnly(nextCanRequestAds));
      setIsPrivacyOptionsRequired(nextPrivacyOptionsRequired);
    } catch {
      // Required policy: on failure, continue requesting with NPA mode.
      setCanRequestAds(true);
      setRequestNonPersonalizedAdsOnly(true);
      setIsPrivacyOptionsRequired(false);
    } finally {
      setIsConsentGathering(false);
    }
  }, [adsConsent]);

  useEffect(() => {
    void refreshConsent();
  }, [refreshConsent]);

  const openPrivacyOptions = useCallback(async () => {
    if (!adsConsent || typeof adsConsent.showPrivacyOptionsForm !== 'function') {
      return;
    }
    await adsConsent.showPrivacyOptionsForm();
    await refreshConsent();
  }, [adsConsent, refreshConsent]);

  const contextValue = useMemo<AdConsentContextValue>(
    () => ({
      isConsentGathering,
      canRequestAds,
      requestNonPersonalizedAdsOnly,
      isPrivacyOptionsRequired,
      openPrivacyOptions,
    }),
    [
      canRequestAds,
      isConsentGathering,
      isPrivacyOptionsRequired,
      openPrivacyOptions,
      requestNonPersonalizedAdsOnly,
    ]
  );

  return createElement(AdConsentContext.Provider, { value: contextValue }, children);
}

export function useAdConsent(): AdConsentContextValue {
  return useContext(AdConsentContext) ?? fallbackContextValue;
}
