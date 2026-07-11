import { queryKeys } from '@squash/api-client';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/src/components/screen';
import { TournamentDetail } from '@/src/components/tournament-detail';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

export default function OfficialTournamentDetailScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const tournament = useQuery({
    queryKey: [...queryKeys.tournament(tournamentId), playerId ?? 'signed-out'],
    queryFn: async () => (await api.getOfficialTournament(tournamentId)).data,
    enabled: Boolean(playerId && tournamentId),
  });

  if (!session.isPending && !playerId) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
      {tournament.isPending ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {tournament.isError ? (
        <View style={styles.errorCard}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {t('tournaments.detail.loadError')}
          </Text>
        </View>
      ) : null}
      {tournament.data ? <TournamentDetail tournament={tournament.data} /> : null}
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
  errorCard: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.secondary },
  errorText: { color: colors.destructive, textAlign: 'center' },
});
