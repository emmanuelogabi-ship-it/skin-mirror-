import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/theme';
import { AuthProvider, nextOnboardingStep, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import SetupNeeded from '@/components/setup-needed';

function RootNavigator() {
  const c = useTheme();
  const { session, profile, loading } = useAuth();

  if (!isConfigured) return <SetupNeeded />;
  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const signedIn = Boolean(session);
  const step = nextOnboardingStep(profile);
  const consented = signedIn && step !== '/consent';
  const ready = signedIn && step === null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !consented}>
        <Stack.Screen name="consent" />
      </Stack.Protected>

      <Stack.Protected guard={consented}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>

      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="result/[id]" />
      </Stack.Protected>

      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
