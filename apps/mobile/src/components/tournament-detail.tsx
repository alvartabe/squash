import type { TournamentPlayerDetail, TournamentStatus } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { StyleSheet, Text, View } from 'react-native';
import { mobileLocale, t } from '@/src/lib/i18n';

const tournamentStatusKeys: Record<Exclude<TournamentStatus, 'draft'>, Parameters<typeof t>[0]> = {
  registration: 'tournaments.status.registration',
  'group-stage': 'tournaments.status.groupStage',
  knockout: 'tournaments.status.knockout',
  completed: 'tournaments.status.completed',
  cancelled: 'tournaments.status.cancelled',
};

type PlayerFixture = TournamentPlayerDetail['knockoutDraw'][number];
type PlayerMatchStatus = NonNullable<PlayerFixture['status']>;

const matchStatusKeys: Record<PlayerMatchStatus, Parameters<typeof t>[0]> = {
  scheduled: 'tournaments.matchStatus.scheduled',
  'in-progress': 'tournaments.matchStatus.inProgress',
  completed: 'tournaments.matchStatus.completed',
  void: 'tournaments.matchStatus.void',
};

function MatchCard({ fixture, timeZone }: { fixture: PlayerFixture; timeZone: string }) {
  const playerOne = fixture.playerOne?.name ?? t('tournaments.officialResult.awaitingPlayers');
  const playerTwo = fixture.playerTwo?.name ?? t('tournaments.officialResult.awaitingPlayers');
  const location = [fixture.venueText, fixture.courtLabel].filter(Boolean).join(' · ');
  return (
    <View style={styles.matchCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.matchPlayers}>
          {playerOne} {t('tournaments.versus')} {playerTwo}
        </Text>
        <Text style={styles.status}>
          {fixture.status
            ? t(matchStatusKeys[fixture.status])
            : t('tournaments.officialResult.awaitingPlayers')}
        </Text>
      </View>
      <Text style={styles.muted}>
        {t('tournaments.round')} {fixture.round} · {t('tournaments.fixture')} {fixture.position}
      </Text>
      {fixture.scheduledAt ? (
        <Text style={styles.muted}>
          {new Intl.DateTimeFormat(mobileLocale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone,
          }).format(new Date(fixture.scheduledAt))}
        </Text>
      ) : null}
      {location ? <Text style={styles.muted}>{location}</Text> : null}
      {fixture.games.length > 0 ? (
        <View style={styles.games}>
          {fixture.games.map((game, index) => (
            <Text key={`${fixture.id}-game-${index + 1}`} style={styles.gameScore}>
              {game.playerOnePoints}–{game.playerTwoPoints}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function TournamentDetail({ tournament }: { tournament: TournamentPlayerDetail }) {
  const rules = tournament.configuration.scoringRules;
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.rowBetween}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{tournament.name}</Text>
            <Text style={styles.club}>{tournament.club.name}</Text>
          </View>
          <Text style={styles.status}>{t(tournamentStatusKeys[tournament.status])}</Text>
        </View>
        <Text style={styles.body}>
          {new Intl.DateTimeFormat(mobileLocale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: tournament.timeZone,
          }).format(new Date(tournament.startsAt))}
        </Text>
        <Text style={styles.muted}>
          {t(tournament.visibility === 'public' ? 'tournaments.public' : 'tournaments.clubOnly')}
        </Text>
        {tournament.description ? <Text style={styles.body}>{tournament.description}</Text> : null}
        {tournament.venue ? <Text style={styles.body}>{tournament.venue}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('tournaments.detail.configuration')}</Text>
        <Text style={styles.body}>
          {t('tournaments.bestOf')}: {rules.bestOf} · {t('tournaments.pointsToWin')}:{' '}
          {rules.pointsToWin} · {t('tournaments.winByTwo')}:{' '}
          {rules.winByTwo ? t('common.yes') : t('common.no')}
        </Text>
        <Text style={styles.body}>
          {t('tournaments.groupSize')}: {tournament.configuration.groupSize} ·{' '}
          {t('tournaments.qualifiers')}: {tournament.configuration.automaticQualifiersPerGroup} ·{' '}
          {t('tournaments.wildcards')}: {tournament.configuration.wildcardQualifiers}
        </Text>
        <Text style={styles.body}>
          {t('tournaments.seeding')}:{' '}
          {t(
            tournament.configuration.seedingMethod === 'random'
              ? 'tournaments.random'
              : 'tournaments.manual',
          )}
        </Text>
      </View>

      {tournament.groups.map((group) => (
        <View key={group.id} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('tournaments.group')} {group.name}
          </Text>
          <Text style={styles.label}>{t('tournaments.detail.assignments')}</Text>
          <Text style={styles.body}>
            {group.assignments.map((player) => player.name).join(' · ')}
          </Text>
          <Text style={styles.label}>{t('tournaments.detail.standings')}</Text>
          {group.standings.map((standing) => (
            <View key={standing.player.id} style={styles.standingRow}>
              <Text style={styles.rank}>{standing.tied ? `${standing.rank}=` : standing.rank}</Text>
              <View style={styles.standingBody}>
                <Text style={styles.playerName}>{standing.player.name}</Text>
                <Text style={styles.muted}>
                  {t('tournaments.detail.played')} {standing.played} ·{' '}
                  {t('tournaments.detail.record')} {standing.wins}–{standing.losses} ·{' '}
                  {t('tournaments.detail.games')} {standing.gamesWon}–{standing.gamesLost} (
                  {standing.gameDifferential >= 0 ? '+' : ''}
                  {standing.gameDifferential}) · {t('tournaments.detail.points')}{' '}
                  {standing.pointsFor}–{standing.pointsAgainst} (
                  {standing.pointDifferential >= 0 ? '+' : ''}
                  {standing.pointDifferential})
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.label}>{t('tournaments.detail.groupFixtures')}</Text>
          {group.fixtures.map((fixture) => (
            <MatchCard fixture={fixture} key={fixture.id} timeZone={tournament.timeZone} />
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('tournaments.detail.knockoutDraw')}</Text>
        {tournament.knockoutDraw.length > 0 ? (
          tournament.knockoutDraw.map((fixture) => (
            <MatchCard fixture={fixture} key={fixture.id} timeZone={tournament.timeZone} />
          ))
        ) : (
          <Text style={styles.muted}>{t('tournaments.noKnockoutFixtures')}</Text>
        )}
      </View>

      {tournament.status === 'completed' && tournament.champion ? (
        <View style={styles.championCard}>
          <Text style={styles.championText}>
            {t('tournaments.detail.champion')}: {tournament.champion.name}
          </Text>
        </View>
      ) : null}
      {tournament.status === 'cancelled' ? (
        <View style={styles.cancelledCard}>
          <Text style={styles.cancelledText}>{t('tournaments.detail.cancelledNoChampion')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  hero: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleBlock: { flex: 1, gap: spacing.xs },
  title: { color: colors.surface, fontSize: 28, fontWeight: '800' },
  club: { color: colors.surface, fontSize: 16, opacity: 0.9 },
  status: {
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
  label: { color: colors.foreground, marginTop: spacing.xs, fontWeight: '700' },
  body: { color: colors.foreground, lineHeight: 21 },
  muted: { color: colors.muted, lineHeight: 20 },
  standingRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  rank: { width: 28, color: colors.primary, fontSize: 16, fontWeight: '800' },
  standingBody: { flex: 1, gap: 2 },
  playerName: { color: colors.foreground, fontWeight: '700' },
  matchCard: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  matchPlayers: { flex: 1, color: colors.foreground, fontWeight: '700' },
  games: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gameScore: { color: colors.foreground, fontVariant: ['tabular-nums'], fontWeight: '700' },
  championCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.secondary },
  championText: { color: colors.primary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  cancelledCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.secondary,
  },
  cancelledText: { color: colors.foreground, fontWeight: '700', textAlign: 'center' },
});
