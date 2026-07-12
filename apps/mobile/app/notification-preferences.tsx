import type { NotificationPreferences } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/src/components/screen';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';
import { queryKeys } from '@squash/api-client';

const categories: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: 'social', label: t('notificationPreferences.social') },
  { key: 'playSessions', label: t('notificationPreferences.playSessions') },
  { key: 'tournaments', label: t('notificationPreferences.tournaments') },
  { key: 'clubs', label: t('notificationPreferences.clubs') },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: [...queryKeys.notificationPreferences(), playerId ?? 'signed-out'],
    queryFn: async () => (await api.getNotificationPreferences()).data,
    enabled: Boolean(playerId),
  });
  const update = useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) =>
      api.updateNotificationPreferences(input),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(
        [...queryKeys.notificationPreferences(), playerId ?? 'signed-out'],
        data,
      );
    },
  });

  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.heading}>{t('notificationPreferences.heading')}</Text>
      <Text style={styles.description}>{t('notificationPreferences.description')}</Text>
      {preferences.isPending ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {preferences.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('notificationPreferences.loadError')}
        </Text>
      ) : null}
      {preferences.data ? (
        <View style={styles.categories}>
          {categories.map(({ key, label }) => (
            <View key={key} style={styles.category}>
              <Text style={styles.categoryLabel}>{label}</Text>
              <Switch
                accessibilityLabel={label}
                disabled={update.isPending}
                onValueChange={(enabled) => update.mutate({ [key]: enabled })}
                value={preferences.data[key]}
              />
            </View>
          ))}
        </View>
      ) : null}
      {update.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('notificationPreferences.updateError')}
        </Text>
      ) : null}
      <Text style={styles.required}>{t('notificationPreferences.required')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
  },
  backText: { color: colors.primary, fontWeight: '700' },
  heading: { color: colors.foreground, fontSize: 28, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  categories: { gap: spacing.sm },
  category: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  categoryLabel: { color: colors.foreground, fontSize: 16, fontWeight: '600' },
  required: { color: colors.muted, lineHeight: 21 },
  error: { color: colors.destructive, lineHeight: 21 },
});
