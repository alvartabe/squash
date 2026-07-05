import {
  createClubPlaySessionSchema,
  updateAttendanceResponseSchema,
  updateClubPlaySessionSchema,
} from '@squash/contracts';

describe('one-time Club Play Session contracts', () => {
  it('accepts Costa Rica local scheduling without configurable timezone or recurrence', () => {
    const input = createClubPlaySessionSchema.parse({
      clubId: 'bd8749bd-8b32-4fd2-a96e-5413de2057cc',
      title: 'Saturday play',
      startsAtLocal: '2026-07-11T09:00',
      endsAtLocal: '2026-07-11T11:00',
    });
    expect(input).not.toHaveProperty('timeZone');
    expect(input).not.toHaveProperty('recurrence');
  });

  it.each(['invited', 'accepted', 'declined', 'withdrawn', 'maybe'])(
    'rejects legacy Attendance Response %s',
    (response) => {
      expect(() =>
        updateAttendanceResponseSchema.parse({ response, expectedVersion: 0 }),
      ).toThrow();
    },
  );

  it('requires optimistic versions on Session updates and Attendance Responses', () => {
    expect(() => updateClubPlaySessionSchema.parse({ title: 'Changed' })).toThrow();
    expect(() => updateAttendanceResponseSchema.parse({ response: 'going' })).toThrow();
    expect(
      updateAttendanceResponseSchema.parse({ response: 'not-going', expectedVersion: 2 }),
    ).toEqual({ response: 'not-going', expectedVersion: 2 });
  });
});
