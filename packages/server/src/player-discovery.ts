import { playerProfiles, users } from '@squash/db/schema';
import { canonicalizeUsername } from '@squash/domain';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from './database';

export async function findPlayerByExactUsername(username: string) {
  const [match] = await db
    .select({
      username: playerProfiles.username,
      displayName: users.name,
      avatar: users.image,
      isJunior: users.isJunior,
    })
    .from(playerProfiles)
    .innerJoin(users, eq(users.id, playerProfiles.userId))
    .where(
      and(
        eq(playerProfiles.usernameCanonical, canonicalizeUsername(username)),
        isNull(users.platformSuspendedAt),
      ),
    )
    .limit(1);

  if (match === undefined || match.isJunior) return null;
  return { username: match.username, displayName: match.displayName, avatar: match.avatar };
}
