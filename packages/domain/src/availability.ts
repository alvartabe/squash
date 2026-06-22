export type AvailabilityWindow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export function overlappingMinutes(a: AvailabilityWindow, b: AvailabilityWindow): number {
  if (a.weekday !== b.weekday) return 0;
  return Math.max(0, Math.min(a.endMinute, b.endMinute) - Math.max(a.startMinute, b.startMinute));
}

export function hasAvailabilityOverlap(
  left: readonly AvailabilityWindow[],
  right: readonly AvailabilityWindow[],
  minimumMinutes = 30,
): boolean {
  return left.some((a) => right.some((b) => overlappingMinutes(a, b) >= minimumMinutes));
}
