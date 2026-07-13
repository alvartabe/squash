import { canonicalizeUsername, usernameSchema } from '@squash/contracts';

describe('Username policy', () => {
  it('normalizes display values to NFC and compares them case-insensitively', () => {
    const decomposed = 'Mari\u0301a.Solis';
    expect(usernameSchema.parse(decomposed)).toBe('María.Solis');
    expect(canonicalizeUsername('MARÍA.SOLIS')).toBe(canonicalizeUsername(decomposed));
  });

  it('accepts 3–30 Unicode letters, numbers, underscores, and periods', () => {
    expect(usernameSchema.parse('Ál_9.')).toBe('Ál_9.');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
    expect(usernameSchema.safeParse('maria solis').success).toBe(false);
    expect(usernameSchema.safeParse('maria-solis').success).toBe(false);
  });
});
