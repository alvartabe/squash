import { deviceTokens, outboxEvents, users } from '@squash/db/schema';
import { resolveLocale, translate, type MessageKey } from '@squash/i18n';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from './database';
import { advanceKnockoutWinner, progressTournament } from './services';

type ClaimedEvent = {
  id: string;
  topic: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export async function claimOutboxBatch(limit = 20): Promise<ClaimedEvent[]> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select id, topic, aggregate_id as "aggregateId", payload, attempts
      from outbox_events
      where status in ('pending', 'failed') and available_at <= now()
      order by created_at
      for update skip locked
      limit ${limit}
    `);
    const events = result.rows as ClaimedEvent[];
    if (events.length > 0) {
      await tx
        .update(outboxEvents)
        .set({ status: 'processing', lockedAt: new Date() })
        .where(
          inArray(
            outboxEvents.id,
            events.map((event) => event.id),
          ),
        );
    }
    return events;
  });
}

async function sendPush(
  recipientId: string,
  titleKey: MessageKey,
  bodyKey: MessageKey,
  data: object,
) {
  const [recipient] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  const locale = resolveLocale(recipient?.locale);
  const tokens = await db
    .select({ token: deviceTokens.expoPushToken })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, recipientId), eq(deviceTokens.active, true)));
  if (tokens.length === 0) return;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      tokens.map(({ token }) => ({
        to: token,
        title: translate(locale, titleKey),
        body: translate(locale, bodyKey),
        data,
      })),
    ),
  });
  if (!response.ok) throw new Error(`Expo push failed with ${response.status}.`);
}

async function rebuildProjection(playerId: string, source: 'challenge' | 'tournament') {
  const table = source === 'challenge' ? sql.raw('challenge_stats') : sql.raw('tournament_stats');
  await db.execute(sql`
    insert into ${table} (
      user_id, matches, wins, losses, sets_won, sets_lost, points_for, points_against,
      last_match_at, version, updated_at
    )
    with per_match as (
      select
        mp.user_id,
        m.id,
        m.winner_id,
        m.completed_at,
        count(*) filter (
          where (mp.position = 1 and ms.player_one_points > ms.player_two_points)
             or (mp.position = 2 and ms.player_two_points > ms.player_one_points)
        )::int as sets_won,
        count(*) filter (
          where (mp.position = 1 and ms.player_one_points < ms.player_two_points)
             or (mp.position = 2 and ms.player_two_points < ms.player_one_points)
        )::int as sets_lost,
        sum(case when mp.position = 1 then ms.player_one_points else ms.player_two_points end)::int as points_for,
        sum(case when mp.position = 1 then ms.player_two_points else ms.player_one_points end)::int as points_against
      from match_participants mp
      join matches m on m.id = mp.match_id
      join match_sets ms on ms.match_id = m.id
      where mp.user_id = ${playerId}
        and m.source = ${source}::match_source
        and m.counts_for_statistics = true
        and m.status = 'completed'
      group by mp.user_id, m.id, m.winner_id, m.completed_at
    )
    select
      ${playerId}, count(*)::int,
      count(*) filter (where winner_id = ${playerId})::int,
      count(*) filter (where winner_id <> ${playerId})::int,
      coalesce(sum(sets_won), 0)::int, coalesce(sum(sets_lost), 0)::int,
      coalesce(sum(points_for), 0)::int, coalesce(sum(points_against), 0)::int,
      max(completed_at), 1, now()
    from per_match
    on conflict (user_id) do update set
      matches = excluded.matches,
      wins = excluded.wins,
      losses = excluded.losses,
      sets_won = excluded.sets_won,
      sets_lost = excluded.sets_lost,
      points_for = excluded.points_for,
      points_against = excluded.points_against,
      last_match_at = excluded.last_match_at,
      version = ${table}.version + 1,
      updated_at = now()
  `);
}

async function rebuildMatchStatistics(matchId: string, source: 'challenge' | 'tournament') {
  const result = await db.execute(sql`
    select user_id as "userId" from match_participants where match_id = ${matchId}
  `);
  for (const row of result.rows as Array<{ userId: string }>) {
    await rebuildProjection(row.userId, source);
  }
}

async function processEvent(event: ClaimedEvent) {
  if (event.topic === 'club-play-session.invited') {
    const recipientId = event.payload.recipientId;
    if (typeof recipientId === 'string') {
      await sendPush(
        recipientId,
        'notification.sessionInvited.title',
        'notification.sessionInvited.body',
        { sessionId: event.aggregateId },
      );
    }
    return;
  }
  if (event.topic === 'challenge.invited') {
    const recipientId = event.payload.recipientId;
    if (typeof recipientId === 'string') {
      await sendPush(
        recipientId,
        'notification.challengeInvited.title',
        'notification.challengeInvited.body',
        {
          challengeId: event.aggregateId,
        },
      );
    }
    return;
  }
  if (event.topic === 'friend.requested') {
    const recipientId = event.payload.recipientId;
    if (typeof recipientId === 'string') {
      await sendPush(
        recipientId,
        'notification.friendRequested.title',
        'notification.friendRequested.body',
        {
          friendshipId: event.aggregateId,
        },
      );
    }
    return;
  }
  if (event.topic === 'challenge.accepted' || event.topic === 'challenge.declined') {
    const recipientId = event.payload.recipientId;
    if (typeof recipientId === 'string') {
      await sendPush(
        recipientId,
        event.topic === 'challenge.accepted'
          ? 'notification.challengeAccepted.title'
          : 'notification.challengeDeclined.title',
        event.topic === 'challenge.accepted'
          ? 'notification.challengeAccepted.body'
          : 'notification.challengeDeclined.body',
        { challengeId: event.aggregateId },
      );
    }
    return;
  }
  if (event.topic === 'challenge.cancelled' || event.topic === 'challenge.disputed') {
    const recipientId = event.payload.recipientId;
    if (typeof recipientId === 'string') {
      const cancelled = event.topic === 'challenge.cancelled';
      await sendPush(
        recipientId,
        cancelled
          ? 'notification.challengeCancelled.title'
          : 'notification.challengeDisputed.title',
        cancelled ? 'notification.challengeCancelled.body' : 'notification.challengeDisputed.body',
        { challengeId: event.aggregateId },
      );
    }
    return;
  }
  if (event.topic === 'statistics.rebuild') {
    const source = event.payload.source;
    if (source === 'challenge' || source === 'tournament') {
      await rebuildMatchStatistics(event.aggregateId, source);
    }
    return;
  }
  if (event.topic === 'tournament.progress') {
    const matchId = event.payload.matchId;
    const tournamentId = event.payload.tournamentId;
    if (typeof matchId === 'string' && typeof tournamentId === 'string') {
      const knockout = await advanceKnockoutWinner(matchId);
      if (!knockout.progressed) await progressTournament(tournamentId);
    }
    return;
  }
  if (event.topic === 'email.send') {
    const { to, subject, html } = event.payload;
    if (typeof to === 'string' && typeof subject === 'string' && typeof html === 'string') {
      const key = process.env.RESEND_API_KEY;
      if (!key) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('RESEND_API_KEY is required for email events.');
        }
        const actionUrl = html.match(/href="([^"]+)"/)?.[1];
        console.info(`[outbox email] ${subject}: ${to}${actionUrl ? ` -> ${actionUrl}` : ''}`);
        return;
      }
      const result = await new Resend(key).emails.send({
        from: process.env.EMAIL_FROM ?? 'Squash <noreply@example.com>',
        to,
        subject,
        html,
      });
      if (result.error) throw new Error(result.error.message);
    }
  }
}

export async function processOutboxBatch(limit = 20) {
  const events = await claimOutboxBatch(limit);
  for (const event of events) {
    try {
      await processEvent(event);
      await db
        .update(outboxEvents)
        .set({ status: 'completed', completedAt: new Date(), lastError: null })
        .where(eq(outboxEvents.id, event.id));
    } catch (error) {
      const attempts = event.attempts + 1;
      await db
        .update(outboxEvents)
        .set({
          status: 'failed',
          attempts,
          lastError: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown error',
          availableAt: new Date(Date.now() + Math.min(60_000, 2 ** attempts * 1000)),
          lockedAt: null,
        })
        .where(eq(outboxEvents.id, event.id));
    }
  }
  return events.length;
}
