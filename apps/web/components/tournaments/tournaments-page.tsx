'use client';

import type { TournamentManagement, TournamentVisibility } from '@squash/contracts';
import { useState, type FormEvent } from 'react';
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
      visibility,
      startsAt: String(data.get('startsAt')),
      timeZone: String(data.get('timeZone')),
      groupSize: Number(data.get('groupSize')),
      qualifiersPerGroup: Number(data.get('qualifiersPerGroup')),
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
        {action.isError ? (
          <p className="text-sm text-destructive">{t('tournaments.actionError')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
