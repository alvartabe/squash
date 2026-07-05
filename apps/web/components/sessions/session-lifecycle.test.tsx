import { canCoordinateClubPlaySession } from '@/src/lib/club-play-sessions';

const scheduled = {
  actorId: 'coach-id',
  coordinatorId: 'coach-id',
  startsAt: '2026-07-11T15:00:00.000Z',
  cancelledAt: null,
  clubArchivedAt: null,
  now: new Date('2026-07-11T14:00:00.000Z'),
};

describe('Club Play Session management visibility', () => {
  it('shows management actions only to the active future Session Coordinator', () => {
    expect(canCoordinateClubPlaySession(scheduled)).toBe(true);
    expect(canCoordinateClubPlaySession({ ...scheduled, actorId: 'owner-id' })).toBe(false);
    expect(
      canCoordinateClubPlaySession({
        ...scheduled,
        cancelledAt: '2026-07-11T14:30:00.000Z',
      }),
    ).toBe(false);
    expect(
      canCoordinateClubPlaySession({
        ...scheduled,
        clubArchivedAt: '2026-07-11T14:30:00.000Z',
      }),
    ).toBe(false);
    expect(
      canCoordinateClubPlaySession({
        ...scheduled,
        now: new Date('2026-07-11T15:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
