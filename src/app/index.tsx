import { Redirect } from 'expo-router';

import { nextOnboardingStep, useAuth } from '@/lib/auth';

// Entry point: send people to the right place for where they are in onboarding.
export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/welcome" />;
  const step = nextOnboardingStep(profile);
  if (step) return <Redirect href={step} />;
  return <Redirect href="/(tabs)" />;
}
