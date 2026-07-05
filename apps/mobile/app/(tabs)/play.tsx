import { queryKeys } from '@squash/api-client';
import type { ClubPlaySession } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '@/src/lib/api';
import { canSetAttendanceResponse } from '@/src/lib/club-play-sessions';
import { t } from '@/src/lib/i18n';

const TIME_ZONE = 'America/Costa_Rica';

function SessionCard({ session }: { session: ClubPlaySession }) {
  const client = useQueryClient();
  const canRespond = canSetAttendanceResponse(session);
  const response = useMutation({
    mutationFn: (next: 'going' | 'not-going') =>
      api.setClubPlaySessionAttendance(session.id, {
        response: next,
        expectedVersion: session.myAttendanceVersion,
      }),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.clubPlaySessions() }),
  });
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{session.title}</Text>
      <Text style={styles.clubName}>{session.clubName}</Text>
      <Text style={styles.muted}>
        {formatter.format(new Date(session.startsAt))}–{formatter.format(new Date(session.endsAt))}
      </Text>
      {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}
      <Text style={styles.muted}>
        {t('sessions.participants')}: {session.participants.length}
      </Text>
      {session.participants.map((participant) => (
        <Text key={participant.playerId} style={styles.participant}>
          {participant.playerName} ·{' '}
          {participant.response === 'going'
            ? t('play.going')
            : participant.response === 'not-going'
              ? t('play.notGoing')
              : t('play.noResponse')}
        </Text>
      ))}
      {session.cancelledAt ? (
        <Text style={styles.cancelled}>{t('sessions.cancelled')}</Text>
      ) : (
        <View style={styles.response}>
          <Text style={styles.responseLabel}>{t('play.respond')}</Text>
          <View style={styles.actions}>
            {(['going', 'not-going'] as const).map((value) => {
              const selected = session.myAttendanceResponse === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={!canRespond || response.isPending}
                  key={value}
                  onPress={() => response.mutate(value)}
                  style={({ pressed }) => [
                    styles.button,
                    selected ? styles.selectedButton : undefined,
                    pressed ? styles.pressed : undefined,
                    !canRespond ? styles.disabled : undefined,
                  ]}
                >
                  <Text style={selected ? styles.selectedButtonText : styles.buttonText}>
                    {value === 'going' ? t('play.going') : t('play.notGoing')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {response.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {t('sessions.stale')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function PlayScreen() {
  const sessions = useQuery({
    queryKey: queryKeys.clubPlaySessions(),
    queryFn: () => api.getMyClubPlaySessions('upcoming'),
  });
  const data = sessions.data?.data ?? [];
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(session) => session.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>{t('play.heading')}</Text>
            <Text style={styles.muted}>{t('play.description')}</Text>
          </View>
        }
        ListEmptyComponent={
          sessions.isPending ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <Text style={sessions.isError ? styles.error : styles.muted}>
              {sessions.isError ? t('play.loadError') : t('play.empty')}
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => sessions.refetch()}
            refreshing={sessions.isRefetching}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <SessionCard session={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, gap: spacing.md, padding: spacing.lg },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  heading: { color: colors.foreground, fontSize: 28, fontWeight: '800' },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  clubName: { color: colors.foreground, fontWeight: '600' },
  notes: { color: colors.foreground, lineHeight: 21 },
  participant: { color: colors.foreground, fontSize: 14 },
  muted: { color: colors.muted, lineHeight: 21 },
  cancelled: { color: colors.destructive, fontWeight: '700' },
  response: { gap: spacing.sm, marginTop: spacing.xs },
  responseLabel: { color: colors.foreground, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
  },
  selectedButton: { backgroundColor: colors.primary },
  buttonText: { color: colors.primary, fontWeight: '700' },
  selectedButtonText: { color: colors.background, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  error: { color: colors.destructive, lineHeight: 21 },
});
