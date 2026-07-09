import { queryKeys } from '@squash/api-client';
import type { TournamentPlayer } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
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
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

function TournamentCard({ tournament }: { tournament: TournamentPlayer }) {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.tournaments() });
  const requestEntry = useMutation({
    mutationFn: () => api.requestTournamentEntry(tournament.id),
    onSuccess: invalidate,
  });
  const acceptInvitation = useMutation({
    mutationFn: () => api.acceptTournamentInvitation(tournament.id, tournament.invitationId ?? ''),
    onSuccess: invalidate,
  });
  const rejectInvitation = useMutation({
    mutationFn: () => api.rejectTournamentInvitation(tournament.id, tournament.invitationId ?? ''),
    onSuccess: invalidate,
  });
  const withdraw = useMutation({
    mutationFn: () => api.withdrawTournamentParticipation(tournament.id),
    onSuccess: invalidate,
  });
  const busy =
    requestEntry.isPending ||
    acceptInvitation.isPending ||
    rejectInvitation.isPending ||
    withdraw.isPending;
  const failed =
    requestEntry.isError ||
    acceptInvitation.isError ||
    rejectInvitation.isError ||
    withdraw.isError;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <Text style={styles.name}>{tournament.name}</Text>
          <Text style={styles.club}>{tournament.clubName}</Text>
        </View>
        <Text style={styles.visibility}>
          {t(tournament.visibility === 'public' ? 'tournaments.public' : 'tournaments.clubOnly')}
        </Text>
      </View>
      <Text style={styles.date}>
        {new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: tournament.timeZone,
        }).format(new Date(tournament.startsAt))}
      </Text>
      {tournament.relationship === 'none' ? (
        <ActionButton
          disabled={busy}
          label={t('tournaments.requestEntry')}
          onPress={() => requestEntry.mutate()}
        />
      ) : tournament.relationship === 'request-pending' ? (
        <Text style={styles.stateText}>{t('tournaments.requestPending')}</Text>
      ) : tournament.relationship === 'invited' ? (
        <View style={styles.actions}>
          <Text style={styles.stateText}>{t('tournaments.invited')}</Text>
          <ActionButton
            disabled={busy}
            label={t('tournaments.acceptInvitation')}
            onPress={() => acceptInvitation.mutate()}
          />
          <ActionButton
            disabled={busy}
            label={t('tournaments.rejectInvitation')}
            onPress={() => rejectInvitation.mutate()}
            secondary
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Text style={styles.stateText}>{t('tournaments.accepted')}</Text>
          <ActionButton
            disabled={busy}
            label={t('tournaments.withdraw')}
            onPress={() => withdraw.mutate()}
            secondary
          />
        </View>
      )}
      {failed ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('tournaments.actionError')}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  secondary = false,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary ? styles.secondaryButton : styles.primaryButton]}
    >
      <Text style={secondary ? styles.secondaryButtonText : styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export default function TournamentsScreen() {
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const tournaments = useQuery({
    queryKey: [...queryKeys.tournaments(), playerId ?? 'signed-out'],
    queryFn: () => api.getDiscoverableTournaments(),
    enabled: Boolean(playerId),
  });
  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={tournaments.data?.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>{t('tournaments.heading')}</Text>
            <Text style={styles.description}>{t('tournaments.description')}</Text>
          </View>
        }
        ListEmptyComponent={
          tournaments.isPending ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <Text style={tournaments.isError ? styles.error : styles.empty}>
              {t(tournaments.isError ? 'tournaments.loadError' : 'tournaments.empty')}
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => tournaments.refetch()}
            refreshing={tournaments.isRefetching}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <TournamentCard tournament={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, gap: spacing.md, padding: spacing.lg },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  heading: { color: colors.foreground, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, gap: spacing.xs },
  name: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  club: { color: colors.muted },
  visibility: {
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  date: { color: colors.foreground },
  actions: { gap: spacing.sm },
  stateText: { color: colors.primary, fontWeight: '700' },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  primaryButtonText: { color: colors.surface, fontWeight: '700' },
  secondaryButtonText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.destructive, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});
