import { router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  return (
    <AppScreen
      eyebrow="Logistics 2 · FTMS"
      title="Driver sign in"
      description="Secure driver access will connect to the existing FTMS backend in a later phase.">
      <View style={styles.form}>
        <Text style={styles.label}>Driver account</Text>
        <TextInput
          editable={false}
          placeholder="Authentication not connected"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          editable={false}
          placeholder="Authentication not connected"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.planned}>Real sign-in is planned and no credentials are accepted yet.</Text>
      </View>

      <View style={styles.devPanel}>
        <Text style={styles.devTitle}>Development preview only</Text>
        <Text style={styles.devText}>
          Opens the screen foundation without authenticating or creating a driver session.
        </Text>
        <AppButton label="Enter UI preview" onPress={() => router.replace('/(tabs)')} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: spacing.xs },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    color: colors.muted,
  },
  planned: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  devPanel: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.burgundySoft,
  },
  devTitle: { color: colors.burgundy, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  devText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
});
