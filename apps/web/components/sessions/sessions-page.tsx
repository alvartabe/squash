'use client';

import { useMemo, useState } from 'react';
import type { ClubPlaySession } from '@squash/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCancelClubPlaySession,
  useClubPlaySessionInviteCandidates,
  useClubPlaySessions,
  useCreateClubPlaySession,
  useInviteClubPlaySessionParticipants,
  useUpdateClubPlaySession,
  useWorkspaceClub,
  useWorkspaceMe,
} from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';
import { canCoordinateClubPlaySession } from '@/src/lib/club-play-sessions';

const TIME_ZONE = 'America/Costa_Rica';

function localDateTime(value: Date | string | number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function initialSchedule() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  return {
    startsAtLocal: localDateTime(start),
    endsAtLocal: localDateTime(+start + 2 * 60 * 60 * 1000),
  };
}

type FormValue = {
  title: string;
  notes: string;
  startsAtLocal: string;
  endsAtLocal: string;
};

function SessionForm({
  initial,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial: FormValue;
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (value: FormValue) => Promise<void>;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(value);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`title-${initial.startsAtLocal}`}>{t('sessions.title')}</Label>
        <Input
          id={`title-${initial.startsAtLocal}`}
          maxLength={120}
          required
          value={value.title}
          onChange={(event) => setValue((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t('sessions.startsAt')}</Label>
          <Input
            required
            type="datetime-local"
            value={value.startsAtLocal}
            onChange={(event) =>
              setValue((current) => ({ ...current, startsAtLocal: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label>{t('sessions.endsAt')}</Label>
          <Input
            required
            type="datetime-local"
            value={value.endsAtLocal}
            onChange={(event) =>
              setValue((current) => ({ ...current, endsAtLocal: event.target.value }))
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('sessions.timeZone')}: {TIME_ZONE}
      </p>
      <div className="grid gap-2">
        <Label>{t('sessions.notes')}</Label>
        <textarea
          className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
          maxLength={1000}
          value={value.notes}
          onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <Button disabled={pending} type="submit">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="outline">
            {t('common.cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function InvitePlayers({
  clubId,
  session,
  close,
}: {
  clubId: string;
  session: ClubPlaySession;
  close: () => void;
}) {
  const { t } = useLocale();
  const candidates = useClubPlaySessionInviteCandidates(session.id, true);
  const invite = useInviteClubPlaySessionParticipants(clubId, session.id);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="grid gap-3 rounded-md border p-3">
      <p className="font-medium">{t('sessions.invitePlayers')}</p>
      {candidates.data?.length ? (
        candidates.data.map((candidate) => (
          <label className="flex items-center gap-2 text-sm" key={candidate.playerId}>
            <input
              checked={selected.includes(candidate.playerId)}
              type="checkbox"
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, candidate.playerId]
                    : current.filter((id) => id !== candidate.playerId),
                )
              }
            />
            {candidate.playerName}
          </label>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{t('sessions.noInviteCandidates')}</p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={selected.length === 0 || invite.isPending}
          onClick={async () => {
            try {
              await invite.mutateAsync({
                playerIds: selected,
                expectedVersion: session.version,
              });
              toast.success(t('sessions.invited'));
              close();
            } catch {
              toast.error(t('sessions.stale'));
            }
          }}
        >
          {t('sessions.invite')}
        </Button>
        <Button onClick={close} variant="outline">
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

export function SessionsPage({ clubId }: { clubId: string }) {
  const { locale, t } = useLocale();
  const { data: club } = useWorkspaceClub(clubId);
  const { data: me } = useWorkspaceMe();
  const sessions = useClubPlaySessions(clubId);
  const create = useCreateClubPlaySession(clubId);
  const update = useUpdateClubPlaySession(clubId);
  const cancel = useCancelClubPlaySession(clubId);
  const [editing, setEditing] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const defaults = useMemo(initialSchedule, []);
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
  const canCreate =
    me?.memberships
      .find((membership) => membership.clubId === clubId)
      ?.permissions.includes('session.create') === true;

  return (
    <main className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('sessions.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {club?.name ?? t('common.loading')} · {t('sessions.managementDescription')}
        </p>
      </div>
      {canCreate && !club?.archivedAt ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('sessions.create')}</CardTitle>
            <CardDescription>{t('sessions.oneTimeOnly')}</CardDescription>
          </CardHeader>
          <CardContent>
            <SessionForm
              initial={{ title: '', notes: '', ...defaults }}
              pending={create.isPending}
              submitLabel={t('sessions.create')}
              onSubmit={async (value) => {
                try {
                  await create.mutateAsync({ ...value, notes: value.notes || null });
                  toast.success(t('session.created'));
                } catch {
                  toast.error(t('error.invalidRequest'));
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4">
        {sessions.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : sessions.data?.length ? (
          sessions.data.map((session) => {
            const canCoordinate = canCoordinateClubPlaySession({
              actorId: me?.user.id,
              coordinatorId: session.coordinatorId,
              startsAt: session.startsAt,
              cancelledAt: session.cancelledAt,
              clubArchivedAt: club?.archivedAt ?? null,
            });
            const editValue = {
              title: session.title,
              notes: session.notes ?? '',
              startsAtLocal: localDateTime(session.startsAt),
              endsAtLocal: localDateTime(session.endsAt),
            };
            return (
              <Card key={session.id}>
                <CardHeader>
                  <CardTitle>{session.title}</CardTitle>
                  <CardDescription>
                    {formatter.format(new Date(session.startsAt))}–
                    {formatter.format(new Date(session.endsAt))}
                    {session.cancelledAt ? ` · ${t('sessions.cancelled')}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {editing === session.id ? (
                    <SessionForm
                      initial={editValue}
                      pending={update.isPending}
                      submitLabel={t('common.save')}
                      onCancel={() => setEditing(null)}
                      onSubmit={async (value) => {
                        try {
                          await update.mutateAsync({
                            sessionId: session.id,
                            expectedVersion: session.version,
                            ...value,
                            notes: value.notes || null,
                          });
                          setEditing(null);
                          toast.success(t('sessions.updated'));
                        } catch {
                          toast.error(t('sessions.stale'));
                        }
                      }}
                    />
                  ) : (
                    <>
                      {session.notes ? <p className="text-sm">{session.notes}</p> : null}
                      <p className="text-sm text-muted-foreground">
                        {t('sessions.participants')}: {session.participants.length}
                      </p>
                      {session.participants.length ? (
                        <ul className="grid gap-1 text-sm">
                          {session.participants.map((participant) => (
                            <li key={participant.playerId}>
                              {participant.playerName} ·{' '}
                              {participant.response === 'going'
                                ? t('play.going')
                                : participant.response === 'not-going'
                                  ? t('play.notGoing')
                                  : t('play.noResponse')}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {canCoordinate ? (
                          <>
                            <Button onClick={() => setEditing(session.id)} variant="outline">
                              {t('common.edit')}
                            </Button>
                            <Button
                              onClick={() =>
                                setInviting((current) =>
                                  current === session.id ? null : session.id,
                                )
                              }
                              variant="outline"
                            >
                              {t('sessions.invitePlayers')}
                            </Button>
                            <Button
                              disabled={cancel.isPending}
                              onClick={async () => {
                                try {
                                  await cancel.mutateAsync({
                                    sessionId: session.id,
                                    expectedVersion: session.version,
                                  });
                                  toast.success(t('sessions.cancelled'));
                                } catch {
                                  toast.error(t('sessions.stale'));
                                }
                              }}
                              variant="destructive"
                            >
                              {t('sessions.cancel')}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </>
                  )}
                  {inviting === session.id ? (
                    <InvitePlayers
                      clubId={clubId}
                      session={session}
                      close={() => setInviting(null)}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">{t('sessions.empty')}</p>
        )}
      </div>
    </main>
  );
}
