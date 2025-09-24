import * as Amplitude from '@amplitude/analytics-react-native';

let initialized = false;

export async function initAnalytics(apiKey?: string) {
  if (initialized) return;
  try {
    if (apiKey) {
      await Amplitude.init(apiKey, undefined, {
        logLevel: Amplitude.LogLevel.Warn,
      });
      initialized = true;
    }
  } catch (_e) {
    initialized = false;
  }
}

export function track(event: string, props?: Record<string, any>) {
  try {
    if (initialized) Amplitude.logEvent(event, props);
  } catch (_e) {
    // no-op
  }
}
