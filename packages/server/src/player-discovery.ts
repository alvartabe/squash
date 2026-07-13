import { playerProfiles, users } from '@squash/db/schema';
import { eq } from 'drizzle-orm';
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
    .where(eq(playerProfiles.username, username))
    .limit(1);

  if (!match?.username || match.isJunior) return null;
  return { username: match.username, displayName: match.displayName, avatar: match.avatar };
}
