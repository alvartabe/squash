import { hasAvailabilityOverlap, overlappingMinutes } from '../availability';

test('finds overlap only on the same weekday', () => {
  expect(
    overlappingMinutes(
      { weekday: 2, startMinute: 18 * 60, endMinute: 20 * 60 },
      { weekday: 2, startMinute: 19 * 60, endMinute: 21 * 60 },
    ),
  ).toBe(60);
  expect(
    hasAvailabilityOverlap(
      [{ weekday: 2, startMinute: 18 * 60, endMinute: 20 * 60 }],
      [{ weekday: 3, startMinute: 18 * 60, endMinute: 20 * 60 }],
    ),
  ).toBe(false);
});
