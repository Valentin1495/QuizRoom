import { Redirect } from 'expo-router';

/**
 * This component is the default entry point of the app.
 * It immediately redirects to the onboarding screen. The actual routing logic
 * based on auth state is handled in `app/_layout.tsx`.
 */
export default function AppEntry() {
  return <Redirect href="/onboarding" />;
}
