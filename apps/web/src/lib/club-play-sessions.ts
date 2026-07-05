export function canCoordinateClubPlaySession(input: {
  actorId: string | undefined;
  coordinatorId: string;
  startsAt: string;
  cancelledAt: string | null;
  clubArchivedAt: string | null;
  now?: Date;
}) {
  return (
    input.actorId === input.coordinatorId &&
    input.cancelledAt === null &&
    input.clubArchivedAt === null &&
    new Date(input.startsAt) > (input.now ?? new Date())
  );
}
