// The package implements Unicode full case folding but does not publish TypeScript declarations.
// @ts-expect-error -- wrapped here so consumers retain a typed local interface.
import foldcase from '@ar-nelson/foldcase';

export function foldUsernameCase(value: string): string {
  return foldcase(value);
}
