import type { PropsWithChildren } from 'react';
import { createContext, createElement, useContext, useMemo } from 'react';

type AdConsentContextValue = {
  isConsentGathering: boolean;
  canRequestAds: boolean;
  requestNonPersonalizedAdsOnly: boolean;
  isPrivacyOptionsRequired: boolean;
  openPrivacyOptions: () => Promise<void>;
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

export function AdConsentProvider({ children }: PropsWithChildren) {
  const value = useMemo(() => fallbackContextValue, []);
  return createElement(AdConsentContext.Provider, { value }, children);
}

export function useAdConsent(): AdConsentContextValue {
  return useContext(AdConsentContext) ?? fallbackContextValue;
}
