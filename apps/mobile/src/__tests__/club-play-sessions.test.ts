import type { ClubPlaySession } from '@squash/contracts';
import { attendanceResponseVersion, canSetAttendanceResponse } from '@/src/lib/club-play-sessions';

const session = {
  startsAt: '2026-07-11T15:00:00.000Z',
  cancelledAt: null,
  myAttendanceVersion: 0,
} as ClubPlaySession;

describe('Player Club Play Session behavior', () => {
  it('allows Attendance Responses only before a non-cancelled Session starts', () => {
    expect(canSetAttendanceResponse(session, new Date('2026-07-11T14:59:59.000Z'))).toBe(true);
    expect(canSetAttendanceResponse(session, new Date('2026-07-11T15:00:00.000Z'))).toBe(false);
    expect(
      canSetAttendanceResponse(
        { ...session, cancelledAt: '2026-07-10T15:00:00.000Z' },
        new Date('2026-07-10T16:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('uses zero as the concurrency version before the first response', () => {
    expect(attendanceResponseVersion(session)).toBe(0);
    expect(attendanceResponseVersion({ ...session, myAttendanceVersion: 3 })).toBe(3);
  });
});
