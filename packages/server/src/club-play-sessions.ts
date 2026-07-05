import type {
  AttendanceResponse,
  ClubPlaySession,
  CreateClubPlaySessionInput,
  InviteClubPlaySessionParticipantsInput,
  UpdateAttendanceResponseInput,
  UpdateClubPlaySessionInput,
} from '@squash/contracts';
import {
  clubMemberships,
  clubPlaySessionParticipants,
  clubPlaySessions,
  clubs,
  notifications,
  outboxEvents,
  users,
} from '@squash/db/schema';
import {
  canPerformClubAction,
  canMutateClubPlaySession,
  CLUB_PLAY_SESSION_TIME_ZONE,
  formatCostaRicaLocalDateTime,
  parseCostaRicaDateTime,
} from '@squash/domain';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import {
  requireActiveClubMembership,
  requireClubAction,
  getClubAuthorization,
  requireLockedActiveClubMembership,
  requireLockedClubAction,
} from './authorization';
import { db } from './database';
import { forbidden, notFound, ServiceError } from './errors';

type Scope = 'upcoming' | 'past' | 'all';
type SessionRow = typeof clubPlaySessions.$inferSelect;

function stateConflict(code = 'SESSION_STATE_CONFLICT') {
  return new ServiceError(code, 'error.invalidRequest', 409);
}

function schedule(input: { startsAtLocal: string; endsAtLocal: string }, now = new Date()) {
  const startsAt = parseCostaRicaDateTime(input.startsAtLocal);
  const endsAt = parseCostaRicaDateTime(input.endsAtLocal);
  if (!startsAt || !endsAt || startsAt <= now || endsAt <= startsAt) {
    throw new ServiceError('INVALID_SESSION_TIME', 'error.invalidRequest', 400);
  }
  return { startsAt, endsAt };
}

function scopeCondition(scope: Scope, now: Date) {
  if (scope === 'upcoming') {
    return and(gt(clubPlaySessions.startsAt, now), isNull(clubPlaySessions.cancelledAt));
  }
  if (scope === 'past') {
    return or(lt(clubPlaySessions.startsAt, now), eq(clubPlaySessions.startsAt, now));
  }
  return undefined;
}

async function participantRows(sessionIds: string[]) {
  if (sessionIds.length === 0) return [];
  return db
    .select({
      sessionId: clubPlaySessionParticipants.sessionId,
      playerId: clubPlaySessionParticipants.userId,
      playerName: users.name,
      playerImage: users.image,
      response: clubPlaySessionParticipants.response,
      version: clubPlaySessionParticipants.version,
      invitedById: clubPlaySessionParticipants.invitedById,
    })
    .from(clubPlaySessionParticipants)
    .innerJoin(users, eq(users.id, clubPlaySessionParticipants.userId))
    .where(inArray(clubPlaySessionParticipants.sessionId, sessionIds))
    .orderBy(asc(users.name));
}

async function presentSessions(rows: SessionRow[], actorId: string): Promise<ClubPlaySession[]> {
  const [participants, sessionClubs] = await Promise.all([
    participantRows(rows.map(({ id }) => id)),
    rows.length === 0
      ? []
      : db
          .select({ id: clubs.id, name: clubs.name })
          .from(clubs)
          .where(inArray(clubs.id, [...new Set(rows.map(({ clubId }) => clubId))])),
  ]);
  const clubNames = new Map(sessionClubs.map(({ id, name }) => [id, name]));
  return rows.map((session) => {
    const sessionParticipants = participants.filter(({ sessionId }) => sessionId === session.id);
    const mine = sessionParticipants.find(({ playerId }) => playerId === actorId);
    return {
      id: session.id,
      clubId: session.clubId,
      clubName: clubNames.get(session.clubId) ?? '',
      coordinatorId: session.coordinatorId,
      title: session.title,
      notes: session.notes,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      timeZone: CLUB_PLAY_SESSION_TIME_ZONE,
      cancelledAt: session.cancelledAt?.toISOString() ?? null,
      cancelledById: session.cancelledById,
      version: session.version,
      participants: sessionParticipants,
      myAttendanceResponse: mine?.response ?? null,
      myAttendanceVersion: mine?.version ?? 0,
    };
  });
}

export async function listClubPlaySessionsForManagement(
  actorId: string,
  clubId: string,
  scope: Scope,
) {
  const authorization = await getClubAuthorization(actorId, clubId);
  if (
    !authorization?.clubId ||
    !canPerformClubAction(
      authorization.platformRole,
      authorization.membershipStatus,
      authorization.responsibilities,
      'session.create',
    )
  ) {
    throw forbidden();
  }
  const rows = await db
    .select()
    .from(clubPlaySessions)
    .where(and(eq(clubPlaySessions.clubId, clubId), scopeCondition(scope, new Date())))
    .orderBy(scope === 'past' ? desc(clubPlaySessions.startsAt) : asc(clubPlaySessions.startsAt));
  return presentSessions(rows, actorId);
}

export async function listMyClubPlaySessions(actorId: string, scope: Scope) {
  const memberships = await db
    .select({ clubId: clubMemberships.clubId })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
    .where(
      and(
        eq(clubMemberships.userId, actorId),
        eq(clubMemberships.status, 'active'),
        isNull(clubs.archivedAt),
      ),
    );
  if (memberships.length === 0) return [];
  const rows = await db
    .select()
    .from(clubPlaySessions)
    .where(
      and(
        inArray(
          clubPlaySessions.clubId,
          memberships.map(({ clubId }) => clubId),
        ),
        scopeCondition(scope, new Date()),
      ),
    )
    .orderBy(scope === 'past' ? desc(clubPlaySessions.startsAt) : asc(clubPlaySessions.startsAt));
  return presentSessions(rows, actorId);
}

export async function getClubPlaySession(actorId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(clubPlaySessions)
    .where(eq(clubPlaySessions.id, sessionId))
    .limit(1);
  if (!session) throw notFound('SESSION_NOT_FOUND');
  await requireActiveClubMembership(actorId, session.clubId);
  return (await presentSessions([session], actorId))[0];
}

export async function createClubPlaySession(actorId: string, input: CreateClubPlaySessionInput) {
  return db.transaction(async (tx) => {
    await requireLockedClubAction(tx, actorId, input.clubId, 'session.create');
    const { startsAt, endsAt } = schedule(input);
    const [session] = await tx
      .insert(clubPlaySessions)
      .values({
        clubId: input.clubId,
        coordinatorId: actorId,
        title: input.title,
        notes: input.notes ?? null,
        startsAt,
        endsAt,
      })
      .returning();
    if (!session) throw new Error('Failed to create Club Play Session.');
    await tx.insert(clubPlaySessionParticipants).values({
      sessionId: session.id,
      userId: actorId,
      response: 'going',
    });
    return {
      ...session,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      cancelledAt: null,
      timeZone: CLUB_PLAY_SESSION_TIME_ZONE,
    };
  });
}

async function sessionClubId(sessionId: string) {
  const [session] = await db
    .select({ clubId: clubPlaySessions.clubId })
    .from(clubPlaySessions)
    .where(eq(clubPlaySessions.id, sessionId))
    .limit(1);
  if (!session) throw notFound('SESSION_NOT_FOUND');
  return session.clubId;
}

async function lockedSession(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  clubId: string,
) {
  const [session] = await transaction
    .select()
    .from(clubPlaySessions)
    .where(and(eq(clubPlaySessions.id, sessionId), eq(clubPlaySessions.clubId, clubId)))
    .limit(1)
    .for('update');
  if (!session) throw notFound('SESSION_NOT_FOUND');
  return session;
}

function requireCoordinator(session: SessionRow, actorId: string) {
  if (session.coordinatorId !== actorId) throw forbidden();
}

function requireMutable(session: SessionRow, now: Date) {
  if (!canMutateClubPlaySession({ ...session, now })) {
    throw stateConflict(session.cancelledAt ? 'SESSION_CANCELLED' : 'SESSION_STARTED');
  }
}

function requireVersion(actual: number, expected: number) {
  if (actual !== expected) throw stateConflict('STALE_SESSION');
}

export async function updateClubPlaySession(
  actorId: string,
  sessionId: string,
  input: UpdateClubPlaySessionInput,
) {
  const clubId = await sessionClubId(sessionId);
  return db.transaction(async (tx) => {
    await requireLockedClubAction(tx, actorId, clubId, 'session.create');
    const current = await lockedSession(tx, sessionId, clubId);
    requireCoordinator(current, actorId);
    requireVersion(current.version, input.expectedVersion);
    const now = new Date();
    requireMutable(current, now);
    const nextSchedule = schedule(
      {
        startsAtLocal: input.startsAtLocal ?? formatCostaRicaLocalDateTime(current.startsAt),
        endsAtLocal: input.endsAtLocal ?? formatCostaRicaLocalDateTime(current.endsAt),
      },
      now,
    );
    const scheduleChanged =
      nextSchedule.startsAt.getTime() !== current.startsAt.getTime() ||
      nextSchedule.endsAt.getTime() !== current.endsAt.getTime();
    const [updated] = await tx
      .update(clubPlaySessions)
      .set({
        title: input.title ?? current.title,
        notes: input.notes !== undefined ? input.notes : current.notes,
        ...nextSchedule,
        version: sql`${clubPlaySessions.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(clubPlaySessions.id, sessionId),
          eq(clubPlaySessions.version, input.expectedVersion),
          isNull(clubPlaySessions.cancelledAt),
        ),
      )
      .returning();
    if (!updated) throw stateConflict();
    if (scheduleChanged) {
      await tx
        .update(clubPlaySessionParticipants)
        .set({
          response: null,
          version: sql`${clubPlaySessionParticipants.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(clubPlaySessionParticipants.sessionId, sessionId),
            ne(clubPlaySessionParticipants.userId, current.coordinatorId),
            isNotNull(clubPlaySessionParticipants.response),
          ),
        );
    }
    return updated;
  });
}

export async function cancelClubPlaySession(
  actorId: string,
  sessionId: string,
  expectedVersion: number,
) {
  const clubId = await sessionClubId(sessionId);
  return db.transaction(async (tx) => {
    await requireLockedClubAction(tx, actorId, clubId, 'session.create');
    const current = await lockedSession(tx, sessionId, clubId);
    requireCoordinator(current, actorId);
    requireVersion(current.version, expectedVersion);
    const now = new Date();
    requireMutable(current, now);
    const [cancelled] = await tx
      .update(clubPlaySessions)
      .set({
        cancelledAt: now,
        cancelledById: actorId,
        version: sql`${clubPlaySessions.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(clubPlaySessions.id, sessionId),
          eq(clubPlaySessions.version, expectedVersion),
          isNull(clubPlaySessions.cancelledAt),
        ),
      )
      .returning();
    if (!cancelled) throw stateConflict();
    return cancelled;
  });
}

export async function inviteClubPlaySessionParticipants(
  actorId: string,
  sessionId: string,
  input: InviteClubPlaySessionParticipantsInput,
) {
  const clubId = await sessionClubId(sessionId);
  const playerIds = [...new Set(input.playerIds)];
  return db.transaction(async (tx) => {
    await requireLockedClubAction(tx, actorId, clubId, 'session.create');
    const session = await lockedSession(tx, sessionId, clubId);
    requireCoordinator(session, actorId);
    requireVersion(session.version, input.expectedVersion);
    requireMutable(session, new Date());

    const eligible = await tx
      .select({ userId: clubMemberships.userId })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.status, 'active'),
          inArray(clubMemberships.userId, playerIds),
        ),
      );
    if (eligible.length !== playerIds.length) {
      throw new ServiceError('SESSION_INVITEE_NOT_ACTIVE_MEMBER', 'error.invalidRequest', 409);
    }
    const invited = await tx
      .insert(clubPlaySessionParticipants)
      .values(
        playerIds.map((userId) => ({
          sessionId,
          userId,
          response: null,
          invitedById: actorId,
        })),
      )
      .onConflictDoNothing()
      .returning({ playerId: clubPlaySessionParticipants.userId });
    if (invited.length === 0) return { invitedPlayerIds: [], version: session.version };

    const [updated] = await tx
      .update(clubPlaySessions)
      .set({ version: sql`${clubPlaySessions.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(clubPlaySessions.id, sessionId),
          eq(clubPlaySessions.version, input.expectedVersion),
        ),
      )
      .returning({ version: clubPlaySessions.version });
    if (!updated) throw stateConflict();
    await tx.insert(notifications).values(
      invited.map(({ playerId }) => ({
        userId: playerId,
        type: 'club-play-session.invited',
        messageKey: 'notification.sessionInvited.body',
        data: { sessionId, clubId },
      })),
    );
    await tx.insert(outboxEvents).values(
      invited.map(({ playerId }) => ({
        topic: 'club-play-session.invited',
        aggregateId: sessionId,
        payload: { recipientId: playerId, clubId },
      })),
    );
    return { invitedPlayerIds: invited.map(({ playerId }) => playerId), version: updated.version };
  });
}

export async function listClubPlaySessionInviteCandidates(actorId: string, sessionId: string) {
  const clubId = await sessionClubId(sessionId);
  await requireClubAction(actorId, clubId, 'session.create');
  const [session] = await db
    .select()
    .from(clubPlaySessions)
    .where(and(eq(clubPlaySessions.id, sessionId), eq(clubPlaySessions.clubId, clubId)))
    .limit(1);
  if (!session) throw notFound('SESSION_NOT_FOUND');
  requireCoordinator(session, actorId);
  requireMutable(session, new Date());
  return db
    .select({ playerId: users.id, playerName: users.name, playerImage: users.image })
    .from(clubMemberships)
    .innerJoin(users, eq(users.id, clubMemberships.userId))
    .where(
      and(
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.status, 'active'),
        sql`not exists (
          select 1 from ${clubPlaySessionParticipants}
          where ${clubPlaySessionParticipants.sessionId} = ${sessionId}
            and ${clubPlaySessionParticipants.userId} = ${users.id}
        )`,
      ),
    )
    .orderBy(asc(users.name));
}

export async function setClubPlaySessionAttendance(
  actorId: string,
  sessionId: string,
  input: UpdateAttendanceResponseInput,
) {
  const clubId = await sessionClubId(sessionId);
  return db.transaction(async (tx) => {
    await requireLockedActiveClubMembership(tx, actorId, clubId);
    const session = await lockedSession(tx, sessionId, clubId);
    requireMutable(session, new Date());
    const [current] = await tx
      .select()
      .from(clubPlaySessionParticipants)
      .where(
        and(
          eq(clubPlaySessionParticipants.sessionId, sessionId),
          eq(clubPlaySessionParticipants.userId, actorId),
        ),
      )
      .limit(1)
      .for('update');
    const actualVersion = current?.version ?? 0;
    if (actualVersion !== input.expectedVersion) {
      throw stateConflict('STALE_ATTENDANCE_RESPONSE');
    }
    if (!current) {
      const [created] = await tx
        .insert(clubPlaySessionParticipants)
        .values({ sessionId, userId: actorId, response: input.response })
        .returning();
      return created;
    }
    const [updated] = await tx
      .update(clubPlaySessionParticipants)
      .set({
        response: input.response as AttendanceResponse,
        version: sql`${clubPlaySessionParticipants.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(clubPlaySessionParticipants.sessionId, sessionId),
          eq(clubPlaySessionParticipants.userId, actorId),
          eq(clubPlaySessionParticipants.version, input.expectedVersion),
        ),
      )
      .returning();
    if (!updated) throw stateConflict('STALE_ATTENDANCE_RESPONSE');
    return updated;
  });
}
