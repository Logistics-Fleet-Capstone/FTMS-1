import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.burgundy,
          headerTitleStyle: { color: colors.ink, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trips/[tripId]" options={{ title: 'Trip Details' }} />
        <Stack.Screen name="inspection" options={{ title: 'Pre-Trip Inspection' }} />
        <Stack.Screen name="active-trip" options={{ title: 'Active Trip' }} />
        <Stack.Screen name="incident" options={{ title: 'Incident Report' }} />
        <Stack.Screen name="completion" options={{ title: 'Proof of Completion' }} />
      </Stack>
    </>
  );
}
