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
    expect(translate('es-419', 'tournaments.detail.games')).toBe('Juegos');
    expect(translate('es-419', 'tournaments.detail.groupFixtures')).toBe(
      'Partidos de Grupo y Resultados Oficiales',
    );
  });

  it('provides Club Play Session invitation inbox language in English and Spanish', () => {
    expect(translate('en-US', 'notifications.heading')).toBe('Notifications');
    expect(translate('es-419', 'notifications.empty')).toBe('No tienes notificaciones.');
    expect(translate('en-US', 'sessions.detailLoadError')).toContain('Club Play Session');
    expect(translate('es-419', 'notification.sessionInvited.title')).toBe(
      'Invitación a una Sesión de Juego del Club',
    );
  });

  it('provides Platform Suspension errors and statuses in English and Latin American Spanish', () => {
    expect(translate('en-US', 'error.accountSuspended')).toContain('access is suspended');
    expect(translate('es-419', 'error.accountSuspended')).toContain(
      'acceso a Squash está suspendido',
    );
    expect(translate('en-US', 'error.playerNotFound')).toContain('Player ID');
    expect(translate('es-419', 'error.playerNotFound')).toContain('ID de Jugador');
    expect(translate('en-US', 'platformSuspension.status.suspended')).toBe('Platform Suspended');
    expect(translate('es-419', 'platformSuspension.status.active')).toBe('Activa');
  });
});
