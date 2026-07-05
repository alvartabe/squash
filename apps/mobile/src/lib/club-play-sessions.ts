import type { ClubPlaySession } from '@squash/contracts';

export function canSetAttendanceResponse(session: ClubPlaySession, now = new Date()) {
  return session.cancelledAt === null && new Date(session.startsAt) > now;
}

export function attendanceResponseVersion(session: ClubPlaySession) {
  return session.myAttendanceVersion;
}
