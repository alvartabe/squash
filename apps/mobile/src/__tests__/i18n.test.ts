import { translate } from '@squash/i18n';
import { resolveMobileLocale } from '@/src/lib/i18n';

describe('mobile locale', () => {
  it('uses Spanish as the Costa Rica default', () => {
    expect(resolveMobileLocale(undefined, 'America/Costa_Rica')).toBe('es-419');
    expect(resolveMobileLocale('fr-FR', 'America/Costa_Rica')).toBe('es-419');
  });

  it('respects an English device preference in Costa Rica', () => {
    expect(resolveMobileLocale('en-CR', 'America/Costa_Rica')).toBe('en-US');
  });

  it('uses Latin American Spanish for Spanish device preferences', () => {
    expect(resolveMobileLocale('es-CR', 'America/Costa_Rica')).toBe('es-419');
  });

  it('provides Official Tournament progress language in English and Spanish', () => {
    expect(translate('en-US', 'tournaments.detail.knockoutDraw')).toBe('Knockout Draw');
    expect(translate('es-419', 'tournaments.detail.knockoutDraw')).toBe('Llave Eliminatoria');
    expect(translate('en-US', 'tournaments.detail.cancelledNoChampion')).toContain('No champion');
    expect(translate('es-419', 'tournaments.detail.cancelledNoChampion')).toContain(
      'No se declara campeón',
    );
  });
});
