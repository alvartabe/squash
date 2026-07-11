'use client';

import type {
  OrganizerTiebreakRequirement,
  TournamentGroupFixture,
  TournamentManagement,
  TournamentVisibility,
} from '@squash/contracts';
import type { MessageKey } from '@squash/i18n';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useClubTournaments,
  useCreateTournament,
  useTournamentAction,
  useTournamentCandidates,
} from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';
import { FixtureOfficialResult } from './official-result';

export function TournamentsPage({ clubId }: { clubId: string }) {
  const { data = [], isLoading } = useClubTournaments(clubId);
  const { t } = useLocale();
  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('tournaments.heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('tournaments.manageDescription')}</p>
      </div>
      <CreateTournamentForm clubId={clubId} />
      {isLoading ? <p>{t('common.loading')}</p> : null}
      {data.map((tournament) => (
        <TournamentCard clubId={clubId} key={tournament.id} tournament={tournament} />
      ))}
    </main>
  );
}

function CreateTournamentForm({ clubId }: { clubId: string }) {
  const create = useCreateTournament(clubId);
  const { t } = useLocale();
  const [visibility, setVisibility] = useState<TournamentVisibility | ''>('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!visibility) return;
    const data = new FormData(event.currentTarget);
    create.mutate({
      name: String(data.get('name')),
      description: String(data.get('description')).trim() || null,
      venue: String(data.get('venue')).trim() || null,
      visibility,
      startsAt: String(data.get('startsAt')),
      timeZone: String(data.get('timeZone')),
      groupSize: Number(data.get('groupSize')),
      qualifiersPerGroup: Number(data.get('qualifiersPerGroup')),
      wildcardQualifiers: Number(data.get('wildcardQualifiers')),
      seedingMethod: data.get('seedingMethod') === 'random' ? 'random' : 'manual',
      rules: {
        bestOf: Number(data.get('bestOf')) as 1 | 3 | 5,
        pointsToWin: Number(data.get('pointsToWin')),
        winByTwo: data.get('winByTwo') === 'on',
      },
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tournaments.create')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <Field label={t('tournaments.name')} name="name" required />
          <Field label={t('tournaments.descriptionLabel')} name="description" />
          <Field label={t('tournaments.venue')} name="venue" />
          <label className="grid gap-2 text-sm">
            <span>{t('tournaments.visibility')}</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              onChange={(event) => setVisibility(event.target.value as TournamentVisibility)}
              value={visibility}
            >
              <option disabled value="">
                {t('tournaments.visibility')}
              </option>
              <option value="club-only">{t('tournaments.clubOnly')}</option>
              <option value="public">{t('tournaments.public')}</option>
            </select>
          </label>
          <Field
            label={t('tournaments.startsAt')}
            name="startsAt"
            placeholder="2026-08-01T09:00:00-06:00"
            required
          />
          <Field
            defaultValue="America/Costa_Rica"
            label={t('common.timeZone')}
            name="timeZone"
            required
          />
          <Field
            defaultValue="4"
            label={t('tournaments.groupSize')}
            name="groupSize"
            required
            type="number"
          />
          <Field
            defaultValue="2"
            label={t('tournaments.qualifiers')}
            name="qualifiersPerGroup"
            required
            type="number"
          />
          <Field
            defaultValue="0"
            label={t('tournaments.wildcards')}
            name="wildcardQualifiers"
            required
            type="number"
          />
          <label className="grid gap-2 text-sm">
            <span>{t('tournaments.seeding')}</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              defaultValue="manual"
              name="seedingMethod"
            >
              <option value="manual">{t('tournaments.manual')}</option>
              <option value="random">{t('tournaments.random')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span>{t('tournaments.bestOf')}</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              defaultValue="5"
              name="bestOf"
            >
              <option value="1">1</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </select>
          </label>
          <Field
            defaultValue="11"
            label={t('tournaments.pointsToWin')}
            name="pointsToWin"
            required
            type="number"
          />
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="winByTwo" type="checkbox" />
            {t('tournaments.winByTwo')}
          </label>
          <div className="md:col-span-2">
            <Button disabled={create.isPending || !visibility} type="submit">
              {t('tournaments.create')}
            </Button>
          </div>
          {create.isError ? (
            <p className="text-sm text-destructive md:col-span-2">{t('tournaments.actionError')}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function TournamentCard({
  clubId,
  tournament,
}: {
  clubId: string;
  tournament: TournamentManagement;
}) {
  const action = useTournamentAction(clubId);
  const [candidateSearch, setCandidateSearch] = useState('');
  const { data: candidates = [] } = useTournamentCandidates(tournament.id, candidateSearch);
  const { t } = useLocale();
  const [playerId, setPlayerId] = useState('');
  const registrationOpen = tournament.status === 'registration';
  const pendingRequests = tournament.entryRequests.filter(
    (request) => request.status === 'pending',
  );
  const pendingInvitations = tournament.invitations.filter(
    (invitation) => invitation.status === 'pending',
  );
  const run = (path: string, data?: unknown, method?: 'post' | 'patch' | 'delete') =>
    action.mutate({ path, data, ...(method ? { method } : {}) });
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{tournament.name}</CardTitle>
            <CardDescription>
              {tournament.status} · {new Date(tournament.startsAt).toLocaleString()}
            </CardDescription>
            {tournament.description ? (
              <CardDescription>{tournament.description}</CardDescription>
            ) : null}
            {tournament.venue ? <CardDescription>{tournament.venue}</CardDescription> : null}
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            disabled={!['draft', 'registration'].includes(tournament.status) || action.isPending}
            onChange={(event) =>
              run(
                `/tournaments/${tournament.id}/visibility`,
                { visibility: event.target.value },
                'patch',
              )
            }
            value={tournament.visibility}
          >
            <option value="club-only">{t('tournaments.clubOnly')}</option>
            <option value="public">{t('tournaments.public')}</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap gap-2">
          {tournament.status === 'draft' ? (
            <Button
              disabled={action.isPending}
              onClick={() => run(`/tournaments/${tournament.id}/open`)}
            >
              {t('tournaments.openRegistration')}
            </Button>
          ) : null}
          {registrationOpen ? (
            <Button
              disabled={action.isPending}
              onClick={() => run(`/tournaments/${tournament.id}/draft-draw`)}
              variant="outline"
            >
              {t('tournaments.generateDraftDraw')}
            </Button>
          ) : null}
          {registrationOpen && tournament.draftDrawGeneratedAt ? (
            <Button
              disabled={action.isPending}
              onClick={() => run(`/tournaments/${tournament.id}/start`)}
            >
              {t('tournaments.startTournament')}
            </Button>
          ) : null}
          {registrationOpen && tournament.draftDrawGeneratedAt ? (
            <span className="self-center text-sm text-primary">
              {t('tournaments.draftDrawReady')}
            </span>
          ) : null}
        </div>
        <section className="grid gap-3">
          <h3 className="font-semibold">{t('tournaments.pendingRequests')}</h3>
          {pendingRequests.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : null}
          {pendingRequests.map((request) => (
            <div className="flex items-center justify-between gap-3" key={request.id}>
              <span>{request.playerName}</span>
              {registrationOpen ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(`/tournaments/${tournament.id}/entry-requests/${request.id}/approve`)
                    }
                    size="sm"
                  >
                    {t('tournaments.approve')}
                  </Button>
                  <Button
                    onClick={() =>
                      run(`/tournaments/${tournament.id}/entry-requests/${request.id}/reject`)
                    }
                    size="sm"
                    variant="outline"
                  >
                    {t('tournaments.reject')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </section>
        <section className="grid gap-3">
          <h3 className="font-semibold">{t('tournaments.player')}</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-64"
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder={t('common.search')}
              value={candidateSearch}
            />
            <select
              className="h-10 min-w-64 rounded-md border bg-background px-3 text-sm"
              onChange={(event) => setPlayerId(event.target.value)}
              value={playerId}
            >
              <option value="">{t('tournaments.player')}</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!playerId || action.isPending || !registrationOpen}
              onClick={() => run(`/tournaments/${tournament.id}/invitations`, { playerId })}
              variant="outline"
            >
              {t('tournaments.invite')}
            </Button>
            <Button
              disabled={
                !playerId ||
                action.isPending ||
                !['draft', 'registration'].includes(tournament.status)
              }
              onClick={() => run(`/tournaments/${tournament.id}/participants`, { playerId })}
            >
              {t('tournaments.addDirectly')}
            </Button>
          </div>
        </section>
        <section className="grid gap-3">
          <h3 className="font-semibold">{t('tournaments.invitations')}</h3>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : null}
          {pendingInvitations.map((invitation) => (
            <p className="text-sm" key={invitation.id}>
              {invitation.playerName}
            </p>
          ))}
        </section>
        <section className="grid gap-3">
          <h3 className="font-semibold">{t('tournaments.acceptedRoster')}</h3>
          {tournament.participations.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : null}
          {tournament.participations.map((participation) => (
            <div className="flex items-center justify-between gap-3" key={participation.playerId}>
              <span>{participation.playerName}</span>
              <Button
                disabled={!['draft', 'registration'].includes(tournament.status)}
                onClick={() =>
                  run(
                    `/tournaments/${tournament.id}/participants/${participation.playerId}`,
                    undefined,
                    'delete',
                  )
                }
                size="sm"
                variant="outline"
              >
                {t('tournaments.remove')}
              </Button>
            </div>
          ))}
        </section>
        {tournament.organizerTiebreakRequirement ? (
          <OrganizerTiebreakDecisionSection
            clubId={clubId}
            requirement={tournament.organizerTiebreakRequirement}
            tournamentId={tournament.id}
          />
        ) : null}
        <GroupStageFixturesSection tournament={tournament} />
        <KnockoutFixturesSection tournament={tournament} />
        {action.isError ? (
          <p className="text-sm text-destructive">{t('tournaments.actionError')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const organizerTiebreakContextMessageKeys: Record<
  OrganizerTiebreakRequirement['context'],
  MessageKey
> = {
  'group-standings': 'tournaments.tiebreak.groupStandings',
  'wildcard-cutoff': 'tournaments.tiebreak.wildcardCutoff',
  'knockout-seeding': 'tournaments.tiebreak.knockoutSeeding',
};

export function OrganizerTiebreakDecisionSection({
  clubId,
  requirement,
  tournamentId,
}: {
  clubId: string;
  requirement: OrganizerTiebreakRequirement;
  tournamentId: string;
}) {
  const action = useTournamentAction(clubId);
  const { t } = useLocale();
  const [orderedPlayers, setOrderedPlayers] = useState(requirement.players);
  useEffect(() => {
    setOrderedPlayers(requirement.players);
  }, [requirement.players, requirement.requirementKey]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedPlayers.length) return;
    setOrderedPlayers((current) => {
      const next = [...current];
      [next[index], next[target]] = [
        next[target] as (typeof next)[number],
        next[index] as (typeof next)[number],
      ];
      return next;
    });
  };

  return (
    <section className="grid gap-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-4">
      <div>
        <h3 className="font-semibold">{t('tournaments.tiebreak.heading')}</h3>
        <p className="text-sm text-muted-foreground">{t('tournaments.tiebreak.description')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {t(organizerTiebreakContextMessageKeys[requirement.context])}
        </span>
        {requirement.group ? <span>{requirement.group.name}</span> : null}
      </div>
      <ol className="grid gap-2">
        {orderedPlayers.map((player, index) => (
          <li
            className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
            data-testid="tiebreak-player"
            key={player.id}
          >
            <span>
              {index + 1}. {player.name}
            </span>
            <div className="flex gap-2">
              <Button
                aria-label={`${t('tournaments.tiebreak.moveUp')} ${player.name}`}
                disabled={index === 0 || action.isPending}
                onClick={() => move(index, -1)}
                size="sm"
                type="button"
                variant="outline"
              >
                ↑
              </Button>
              <Button
                aria-label={`${t('tournaments.tiebreak.moveDown')} ${player.name}`}
                disabled={index === orderedPlayers.length - 1 || action.isPending}
                onClick={() => move(index, 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                ↓
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          disabled={action.isPending}
          onClick={() =>
            action.mutate({
              path: `/tournaments/${tournamentId}/organizer-tiebreak-decision`,
              data: {
                requirementKey: requirement.requirementKey,
                orderedPlayerIds: orderedPlayers.map((player) => player.id),
              },
            })
          }
          type="button"
        >
          {t('tournaments.tiebreak.submit')}
        </Button>
      </div>
      {action.isError ? (
        <p className="text-sm text-destructive">{t('tournaments.tiebreak.error')}</p>
      ) : null}
    </section>
  );
}

function GroupStageFixturesSection({ tournament }: { tournament: TournamentManagement }) {
  const { t } = useLocale();
  const showFixtures =
    ['group-stage', 'knockout', 'completed'].includes(tournament.status) ||
    tournament.groupFixtures.length > 0;
  if (!showFixtures) return null;
  const groups = groupFixturesByDraftDrawGroup(tournament.groupFixtures);
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">{t('tournaments.groupStageFixtures')}</h3>
      {tournament.groupFixtures.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tournaments.noGroupFixtures')}</p>
      ) : null}
      {groups.map((group) => (
        <div className="grid gap-2" key={group.id}>
          <h4 className="text-sm font-medium">
            {t('tournaments.group')} {group.name}
          </h4>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('tournaments.round')}</th>
                  <th className="px-3 py-2 font-medium">{t('tournaments.fixture')}</th>
                  <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                  <th className="px-3 py-2 font-medium">{t('tournaments.players')}</th>
                  <th className="px-3 py-2 font-medium">
                    {t('tournaments.officialResult.heading')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.fixtures.map((fixture) => (
                  <tr className="border-t" key={fixture.id}>
                    <td className="whitespace-nowrap px-3 py-2">{fixture.round}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fixture.position}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {t(matchStatusMessageKeys[fixture.matchStatus])}
                    </td>
                    <td className="px-3 py-2">
                      {fixture.playerOne.name}
                      <span className="px-2 text-muted-foreground">{t('tournaments.versus')}</span>
                      {fixture.playerTwo.name}
                    </td>
                    <td className="min-w-80 px-3 py-2">
                      <FixtureOfficialResult
                        clubId={tournament.clubId}
                        fixture={fixture}
                        key={`${fixture.id}-${fixture.matchStatus}-${fixture.currentRevision}`}
                        tournamentId={tournament.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

function KnockoutFixturesSection({ tournament }: { tournament: TournamentManagement }) {
  const { t } = useLocale();
  if (tournament.knockoutFixtures.length === 0 && tournament.status !== 'knockout') return null;
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">{t('tournaments.knockoutFixtures')}</h3>
      {tournament.knockoutFixtures.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tournaments.noKnockoutFixtures')}</p>
      ) : null}
      {tournament.knockoutFixtures.map((fixture) => (
        <div className="grid gap-2 rounded-md border p-3" key={fixture.id}>
          <p className="text-sm font-medium">
            {t('tournaments.round')} {fixture.round} · {t('tournaments.fixture')} {fixture.position}
          </p>
          {fixture.playerOne && fixture.playerTwo ? (
            <>
              <p className="text-sm">
                {fixture.playerOne.name}{' '}
                <span className="text-muted-foreground">{t('tournaments.versus')}</span>{' '}
                {fixture.playerTwo.name}
              </p>
              <FixtureOfficialResult
                clubId={tournament.clubId}
                fixture={fixture}
                key={`${fixture.id}-${fixture.matchStatus}-${fixture.currentRevision}`}
                tournamentId={tournament.id}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('tournaments.officialResult.awaitingPlayers')}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

const matchStatusMessageKeys: Record<TournamentGroupFixture['matchStatus'], MessageKey> = {
  scheduled: 'tournaments.matchStatus.scheduled',
  'in-progress': 'tournaments.matchStatus.inProgress',
  completed: 'tournaments.matchStatus.completed',
  disputed: 'tournaments.matchStatus.disputed',
  void: 'tournaments.matchStatus.void',
};

function groupFixturesByDraftDrawGroup(fixtures: TournamentGroupFixture[]) {
  const groups: Array<{
    id: string;
    name: string;
    position: number;
    fixtures: TournamentGroupFixture[];
  }> = [];
  const groupById = new Map<string, (typeof groups)[number]>();
  for (const fixture of fixtures) {
    let group = groupById.get(fixture.groupId);
    if (!group) {
      group = {
        id: fixture.groupId,
        name: fixture.groupName,
        position: fixture.groupPosition,
        fixtures: [],
      };
      groupById.set(fixture.groupId, group);
      groups.push(group);
    }
    group.fixtures.push(fixture);
  }
  return groups
    .sort((left, right) => left.position - right.position)
    .map((group) => ({
      ...group,
      fixtures: [...group.fixtures].sort(
        (left, right) => left.round - right.round || left.position - right.position,
      ),
    }));
}
