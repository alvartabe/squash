import {
  canMutateClubPlaySession,
  CLUB_PLAY_SESSION_TIME_ZONE,
  formatCostaRicaLocalDateTime,
  parseCostaRicaDateTime,
} from '../club-play-session';

describe('one-time Club Play Session lifecycle', () => {
  it('interprets local scheduling in Costa Rica and returns a UTC instant', () => {
    expect(CLUB_PLAY_SESSION_TIME_ZONE).toBe('America/Costa_Rica');
    expect(parseCostaRicaDateTime('2026-07-11T09:30')?.toISOString()).toBe(
      '2026-07-11T15:30:00.000Z',
    );
    expect(formatCostaRicaLocalDateTime(new Date('2026-07-11T15:30:00.000Z'))).toBe(
      '2026-07-11T09:30',
    );
  });

  it.each(['2026-02-30T09:00', '2026-07-11T24:00', '2026-07-11T09:60', 'not-a-date'])(
    'rejects invalid local date-time %s',
    (value) => {
      expect(parseCostaRicaDateTime(value)).toBeNull();
    },
  );

  it('permits changes only while a scheduled Session is in the future', () => {
    const startsAt = new Date('2026-07-11T15:00:00.000Z');
    expect(
      canMutateClubPlaySession({
        startsAt,
        cancelledAt: null,
        now: new Date('2026-07-11T14:59:59.999Z'),
      }),
    ).toBe(true);
    expect(canMutateClubPlaySession({ startsAt, cancelledAt: null, now: startsAt })).toBe(false);
    expect(
      canMutateClubPlaySession({
        startsAt,
        cancelledAt: new Date('2026-07-10T15:00:00.000Z'),
        now: new Date('2026-07-10T16:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
