import { queryKeys } from '@squash/api-client';
import type { ClubPlaySession } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/src/components/screen';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { canSetAttendanceResponse } from '@/src/lib/club-play-sessions';
import { t } from '@/src/lib/i18n';
import { translate } from '@squash/i18n';

const TIME_ZONE = 'America/Costa_Rica';

function ClubPlaySessionDetail({
  session,
  locale,
}: {
  session: ClubPlaySession;
  locale: 'en-US' | 'es-419';
}) {
  const queryClient = useQueryClient();
  const response = useMutation({
    mutationFn: (next: 'going' | 'not-going') =>
      api.setClubPlaySessionAttendance(session.id, {
        response: next,
        expectedVersion: session.myAttendanceVersion,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clubPlaySession(session.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clubPlaySessions() });
    },
  });
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
  const canRespond = canSetAttendanceResponse(session);

  return (
    <View style={styles.detail}>
      <Text style={styles.title}>{session.title}</Text>
      <Text style={styles.clubName}>{session.clubName}</Text>
      <Text style={styles.muted}>
        {formatter.format(new Date(session.startsAt))}–{formatter.format(new Date(session.endsAt))}
      </Text>
      {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}
      {session.cancelledAt ? (
        <Text style={styles.cancelled}>{translate(locale, 'sessions.cancelled')}</Text>
      ) : (
        <View style={styles.response}>
          <Text style={styles.responseLabel}>{translate(locale, 'play.respond')}</Text>
          <View style={styles.actions}>
            {(['going', 'not-going'] as const).map((value) => {
              const selected = session.myAttendanceResponse === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={!canRespond || response.isPending}
                  key={value}
                  onPress={() => response.mutate(value)}
                  style={[styles.button, selected ? styles.selectedButton : undefined]}
                >
                  <Text style={selected ? styles.selectedButtonText : styles.buttonText}>
                    {translate(locale, value === 'going' ? 'play.going' : 'play.notGoing')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {response.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {translate(locale, 'sessions.stale')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function ClubPlaySessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const profile = useQuery({
    queryKey: queryKeys.profile(playerId ?? 'signed-out'),
    queryFn: () => api.getProfile(),
    enabled: Boolean(playerId),
  });
  const detail = useQuery({
    queryKey: [...queryKeys.clubPlaySession(sessionId), playerId ?? 'signed-out'],
    queryFn: async () => (await api.getClubPlaySession(sessionId)).data,
    enabled: Boolean(playerId && sessionId),
  });
  const locale = profile.data?.data.locale;
  const text = (key: Parameters<typeof t>[0]) => (locale ? translate(locale, key) : t(key));
  const retry = () => {
    void profile.refetch();
    void detail.refetch();
  };

  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{text('common.back')}</Text>
      </Pressable>
      {detail.isPending || profile.isPending ? (
        <ActivityIndicator
          accessibilityLabel={text('common.loading')}
          color={colors.primary}
          size="large"
        />
      ) : null}
      {detail.isError || profile.isError || (!detail.isPending && !detail.data) ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.error}>
            {text('sessions.detailLoadError')}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>{text('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {detail.data && locale ? (
        <ClubPlaySessionDetail locale={locale} session={detail.data} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  backText: { color: colors.primary, fontWeight: '700' },
  detail: { gap: spacing.md },
  title: { color: colors.foreground, fontSize: 26, fontWeight: '800' },
  clubName: { color: colors.foreground, fontWeight: '700' },
  muted: { color: colors.muted, lineHeight: 21 },
  notes: { color: colors.foreground, lineHeight: 21 },
  cancelled: { color: colors.destructive, fontWeight: '700' },
  response: { gap: spacing.sm },
  responseLabel: { color: colors.foreground, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  selectedButton: { backgroundColor: colors.primary },
  buttonText: { color: colors.primary, fontWeight: '700' },
  selectedButtonText: { color: colors.background, fontWeight: '700' },
  state: { alignItems: 'center', gap: spacing.md },
  retry: {
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  retryText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.destructive, lineHeight: 21 },
});
