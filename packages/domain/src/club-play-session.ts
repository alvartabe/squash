export const CLUB_PLAY_SESSION_TIME_ZONE = 'America/Costa_Rica' as const;

const COSTA_RICA_OFFSET = '-06:00';
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseCostaRicaDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const result = new Date(`${year}-${month}-${day}T${hour}:${minute}:00${COSTA_RICA_OFFSET}`);
  if (Number.isNaN(result.getTime())) return null;

  const normalized = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_PLAY_SESSION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(result)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== 'literal') parts[part.type] = part.value;
      return parts;
    }, {});
  const roundTrip = `${normalized.year}-${normalized.month}-${normalized.day}T${normalized.hour}:${normalized.minute}`;
  return roundTrip === value ? result : null;
}

export function formatCostaRicaLocalDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_PLAY_SESSION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(value)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function canMutateClubPlaySession(input: {
  startsAt: Date;
  cancelledAt: Date | null;
  now: Date;
}): boolean {
  return input.cancelledAt === null && input.startsAt > input.now;
}
