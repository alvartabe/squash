import type { UpdatePlayerProfile } from '@squash/contracts';
import { playerProfiles, users } from '@squash/db/schema';
import { canonicalizeUsername, normalizeUsername } from '@squash/domain';
import { eq } from 'drizzle-orm';
import { db } from './database';
import { notFound, ServiceError } from './errors';

type PlayerProfileDatabase = typeof db;

function hasDatabaseConstraint(error: unknown, constraint: string) {
  let current = error;
  const seen = new Set<unknown>();
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current);
    if ('constraint' in current && current.constraint === constraint) return true;
    current = 'cause' in current ? current.cause : null;
  }
  return false;
}

export function createPlayerProfileService(database: PlayerProfileDatabase) {
  async function getPlayerProfile(actorId: string) {
    const [profile] = await database
      .select({
        username: playerProfiles.username,
        name: users.name,
        bio: playerProfiles.bio,
        dominantHand: playerProfiles.dominantHand,
        visibility: playerProfiles.visibility,
        locale: users.locale,
        timeZone: users.timeZone,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(eq(users.id, actorId))
      .limit(1);
    if (!profile) throw notFound('PLAYER_NOT_FOUND');
    return {
      ...profile,
      visibility: profile.visibility as 'private' | 'friends' | 'shared-clubs' | null,
      dominantHand: profile.dominantHand as 'left' | 'right' | 'ambidextrous' | null,
    };
  }

  async function updateProfile(actorId: string, input: UpdatePlayerProfile) {
    const username = normalizeUsername(input.username);
    const usernameCanonical = canonicalizeUsername(username);
    try {
      await database.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            name: input.name,
            locale: input.locale,
            timeZone: input.timeZone,
            updatedAt: new Date(),
          })
          .where(eq(users.id, actorId));
        await tx
          .insert(playerProfiles)
          .values({
            userId: actorId,
            username,
            usernameCanonical,
            bio: input.bio ?? null,
            dominantHand: input.dominantHand ?? null,
            visibility: input.visibility,
          })
          .onConflictDoUpdate({
            target: playerProfiles.userId,
            set: {
              username,
              usernameCanonical,
              bio: input.bio ?? null,
              dominantHand: input.dominantHand ?? null,
              visibility: input.visibility,
              updatedAt: new Date(),
            },
          });
      });
    } catch (error) {
      if (hasDatabaseConstraint(error, 'player_profiles_username_canonical_unique')) {
        throw new ServiceError('USERNAME_TAKEN', 'error.usernameTaken', 409);
      }
      throw error;
    }
    return getPlayerProfile(actorId);
  }

  return { getPlayerProfile, updateProfile };
}

export const { getPlayerProfile, updateProfile } = createPlayerProfileService(db);
