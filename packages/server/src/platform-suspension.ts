import { platformSuspensionResultSchema, type PlatformSuspensionResult } from '@squash/contracts';
import { auditLogs, managementSessions, sessions, users, verifications } from '@squash/db/schema';
import { and, asc, eq, inArray, like } from 'drizzle-orm';
import { db } from './database';
import { forbidden, ServiceError, unauthorized } from './errors';

export const PLATFORM_SUSPENSION_ACTION = 'platform.account.suspend';
export const PLATFORM_REACTIVATION_ACTION = 'platform.account.reactivate';

const suspendTransition = {
  state: 'suspended',
  auditAction: PLATFORM_SUSPENSION_ACTION,
  auditTransition: 'suspended',
} as const;
const reactivateTransition = {
  state: 'active',
  auditAction: PLATFORM_REACTIVATION_ACTION,
  auditTransition: 'reactivated',
} as const;
type PlatformSuspensionTransition = typeof suspendTransition | typeof reactivateTransition;

type PlatformSuspensionDatabase = Pick<typeof db, 'transaction'>;
type PlatformSuspensionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function platformAccountSuspendedError() {
  return new ServiceError('ACCOUNT_SUSPENDED', 'error.accountSuspended', 403);
}

function playerNotFound() {
  return new ServiceError('PLAYER_NOT_FOUND', 'error.playerNotFound', 404);
}

export async function requireActivePlatformAccount(
  playerId: string,
  database: Pick<typeof db, 'select'> = db,
) {
  const [player] = await database
    .select({ id: users.id, platformSuspendedAt: users.platformSuspendedAt })
    .from(users)
    .where(eq(users.id, playerId))
    .limit(1);
  if (!player) throw unauthorized();
  if (player.platformSuspendedAt) throw platformAccountSuspendedError();
  return player;
}

async function lockActorAndTarget(
  transaction: PlatformSuspensionTransaction,
  actorId: string,
  targetPlayerId: string,
) {
  const rows = await transaction
    .select({
      id: users.id,
      role: users.role,
      platformSuspendedAt: users.platformSuspendedAt,
    })
    .from(users)
    .where(inArray(users.id, [...new Set([actorId, targetPlayerId])]))
    .orderBy(asc(users.id))
    .for('update');
  const actor = rows.find((row) => row.id === actorId);
  const target = rows.find((row) => row.id === targetPlayerId);
  if (!actor || actor.role !== 'platform-admin') throw forbidden();
  if (actor.platformSuspendedAt) throw platformAccountSuspendedError();
  if (!target) throw playerNotFound();
  return target;
}

async function revokePlatformAccessArtifacts(
  transaction: PlatformSuspensionTransaction,
  playerId: string,
) {
  await transaction.delete(sessions).where(eq(sessions.userId, playerId));
  await transaction.delete(managementSessions).where(eq(managementSessions.userId, playerId));
  await transaction
    .delete(verifications)
    .where(
      and(eq(verifications.value, playerId), like(verifications.identifier, 'trust-device-%')),
    );
}

export function createPlatformSuspensionService(database: PlatformSuspensionDatabase) {
  async function transition(
    actorId: string,
    targetPlayerId: string,
    requestedTransition: PlatformSuspensionTransition,
  ): Promise<PlatformSuspensionResult> {
    return database.transaction(async (transaction) => {
      const target = await lockActorAndTarget(transaction, actorId, targetPlayerId);
      const isSuspended = target.platformSuspendedAt !== null;
      const shouldBeSuspended = requestedTransition.state === 'suspended';
      if (isSuspended === shouldBeSuspended) {
        return platformSuspensionResultSchema.parse({
          playerId: target.id,
          state: isSuspended ? 'suspended' : 'active',
          suspendedAt: target.platformSuspendedAt?.toISOString() ?? null,
          transitioned: false,
        });
      }

      const transitionedAt = new Date();
      const suspendedAt = shouldBeSuspended ? transitionedAt : null;
      await transaction
        .update(users)
        .set({ platformSuspendedAt: suspendedAt, updatedAt: transitionedAt })
        .where(eq(users.id, target.id));
      if (shouldBeSuspended) {
        await revokePlatformAccessArtifacts(transaction, target.id);
      }
      await transaction.insert(auditLogs).values({
        actorId,
        clubId: null,
        action: requestedTransition.auditAction,
        entityType: 'player',
        entityId: target.id,
        metadata: { transition: requestedTransition.auditTransition },
      });

      return platformSuspensionResultSchema.parse({
        playerId: target.id,
        state: requestedTransition.state,
        suspendedAt: suspendedAt?.toISOString() ?? null,
        transitioned: true,
      });
    });
  }

  return {
    suspendPlayer: (actorId: string, targetPlayerId: string) =>
      transition(actorId, targetPlayerId, suspendTransition),
    reactivatePlayer: (actorId: string, targetPlayerId: string) =>
      transition(actorId, targetPlayerId, reactivateTransition),
  };
}

export const { suspendPlayer, reactivatePlayer } = createPlatformSuspensionService(db);
