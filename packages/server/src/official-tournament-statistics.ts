import { sql } from 'drizzle-orm';
import { db } from './database';

type StatisticsDatabase = Pick<typeof db, 'execute'>;

export async function rebuildOfficialTournamentStatisticsForMatch(
  database: StatisticsDatabase,
  matchId: string,
) {
  await database.execute(sql`
    insert into tournament_stats (
      user_id, matches, wins, losses, sets_won, sets_lost, points_for, points_against,
      last_match_at, version, updated_at
    )
    with affected as (
      select user_id from match_participants where match_id = ${matchId}
    ),
    per_match as (
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
      join affected a on a.user_id = mp.user_id
      join matches m on m.id = mp.match_id
      join match_sets ms on ms.match_id = m.id
      where m.source = 'tournament'::match_source
        and m.counts_for_statistics = true
        and m.status = 'completed'
      group by mp.user_id, m.id, m.winner_id, m.completed_at
    ),
    rebuilt as (
      select
        a.user_id,
        count(pm.id)::int as matches,
        count(pm.id) filter (where pm.winner_id = a.user_id)::int as wins,
        count(pm.id) filter (where pm.winner_id <> a.user_id)::int as losses,
        coalesce(sum(pm.sets_won), 0)::int as sets_won,
        coalesce(sum(pm.sets_lost), 0)::int as sets_lost,
        coalesce(sum(pm.points_for), 0)::int as points_for,
        coalesce(sum(pm.points_against), 0)::int as points_against,
        max(pm.completed_at) as last_match_at
      from affected a
      left join per_match pm on pm.user_id = a.user_id
      group by a.user_id
    )
    select
      user_id, matches, wins, losses, sets_won, sets_lost, points_for, points_against,
      last_match_at, 1, now()
    from rebuilt
    on conflict (user_id) do update set
      matches = excluded.matches,
      wins = excluded.wins,
      losses = excluded.losses,
      sets_won = excluded.sets_won,
      sets_lost = excluded.sets_lost,
      points_for = excluded.points_for,
      points_against = excluded.points_against,
      last_match_at = excluded.last_match_at,
      version = tournament_stats.version + 1,
      updated_at = now()
  `);
}
