import { queryKeys } from '@squash/api-client';
import type { InAppNotification } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/src/components/screen';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';
import { translate } from '@squash/i18n';

function NotificationItem({
  notification,
  locale,
}: {
  notification: InAppNotification;
  locale: 'en-US' | 'es-419';
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: () => api.markInAppNotificationRead(notification.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      router.push(`/club-play-sessions/${notification.clubPlaySessionId}` as Href);
    },
  });
  const read = notification.readAt !== null;
  const receivedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(notification.createdAt));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: markRead.isPending }}
      disabled={markRead.isPending}
      onPress={() => markRead.mutate()}
      style={({ pressed }) => [
        styles.card,
        read ? styles.readCard : styles.unreadCard,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{translate(locale, 'notification.sessionInvited.title')}</Text>
        <Text style={read ? styles.readStatus : styles.unreadStatus}>
          {translate(locale, read ? 'notifications.read' : 'notifications.unread')}
        </Text>
      </View>
      <Text style={styles.body}>{translate(locale, 'notification.sessionInvited.body')}</Text>
      <Text style={styles.receivedAt}>{receivedAt}</Text>
      {markRead.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {translate(locale, 'notifications.markReadError')}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function NotificationInboxScreen() {
  const router = useRouter();
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const profile = useQuery({
    queryKey: queryKeys.profile(playerId ?? 'signed-out'),
    queryFn: () => api.getProfile(),
    enabled: Boolean(playerId),
  });
  const notifications = useQuery({
    queryKey: [...queryKeys.notifications(), playerId ?? 'signed-out'],
    queryFn: async () => (await api.getInAppNotifications()).data,
    enabled: Boolean(playerId),
  });
  const locale = profile.data?.data.locale;
  const text = (key: Parameters<typeof t>[0]) => (locale ? translate(locale, key) : t(key));
  const retry = () => {
    void profile.refetch();
    void notifications.refetch();
  };

  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{text('common.back')}</Text>
      </Pressable>
      <Text style={styles.heading}>{text('notifications.heading')}</Text>
      {notifications.isPending || profile.isPending ? (
        <ActivityIndicator
          accessibilityLabel={text('common.loading')}
          color={colors.primary}
          size="large"
        />
      ) : null}
      {notifications.isError || profile.isError ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.error}>
            {text('notifications.loadError')}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>{text('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {notifications.data && profile.data ? (
        <FlatList
          contentContainerStyle={
            notifications.data.length === 0 ? styles.emptyContent : styles.list
          }
          data={notifications.data}
          keyExtractor={(notification) => notification.id}
          ListEmptyComponent={<Text style={styles.empty}>{text('notifications.empty')}</Text>}
          renderItem={({ item }) => (
            <NotificationItem locale={profile.data.data.locale} notification={item} />
          )}
        />
      ) : null}
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
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  card: { gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  unreadCard: { backgroundColor: colors.secondary, borderColor: colors.primary },
  readCard: { backgroundColor: colors.surface, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  title: { color: colors.foreground, flex: 1, fontSize: 16, fontWeight: '700' },
  unreadStatus: { color: colors.primary, fontWeight: '700' },
  readStatus: { color: colors.muted, fontWeight: '600' },
  body: { color: colors.foreground, lineHeight: 21 },
  receivedAt: { color: colors.muted, fontSize: 13 },
  state: { gap: spacing.md, alignItems: 'center' },
  empty: { color: colors.muted, textAlign: 'center' },
  retry: {
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.destructive, lineHeight: 21 },
  pressed: { opacity: 0.75 },
});
