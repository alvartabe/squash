// The package implements Unicode full case folding but does not publish TypeScript declarations.
// @ts-expect-error -- wrapped here so consumers retain a typed local interface.
import foldcase from '@ar-nelson/foldcase';

export type UsernamePolicyViolation = 'length' | 'characters';

export function normalizeUsername(username: string) {
  return username.normalize('NFC');
}

export function canonicalizeUsername(username: string) {
  return foldcase(normalizeUsername(username)).normalize('NFC');
}

export function usernamePolicyViolations(username: string): UsernamePolicyViolation[] {
  const normalized = normalizeUsername(username);
  const violations: UsernamePolicyViolation[] = [];
  const length = Array.from(normalized).length;
  if (length < 3 || length > 30) violations.push('length');
  if (!/^[\p{L}\p{N}._]+$/u.test(normalized)) violations.push('characters');
  return violations;
}
