import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { getApiConfiguration } from '@/services/apiConfig';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const apiConfiguration = getApiConfiguration();

  return (
    <AppScreen title="Profile" description="Authenticated driver identity and account controls will appear here.">
      <View style={styles.card}>
        <Text style={styles.label}>Driver identity</Text>
        <Text style={styles.value}>Not authenticated</Text>
        <View style={styles.divider} />
        <Text style={styles.label}>Backend configuration</Text>
        <Text style={styles.value}>
          {apiConfiguration.status === 'configured' ? 'Configured' : 'Not configured'}
        </Text>
        {apiConfiguration.status === 'invalid' ? (
          <Text style={styles.warning}>The configured API base URL is invalid.</Text>
        ) : null}
      </View>
      <AppButton label="Exit UI preview" variant="secondary" onPress={() => router.replace('/')} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  divider: { height: 1, marginVertical: spacing.sm, backgroundColor: colors.border },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 18 },
});
