import { evaluateOfficialResultCorrectionStatus } from '../official-result-locks';

describe('dependency-based Official Result Locks', () => {
  it('keeps Group results unlocked only during Group Stage', () => {
    expect(
      evaluateOfficialResultCorrectionStatus({
        stage: 'group',
        tournamentStatus: 'group-stage',
      }),
    ).toBe('unlocked');
    expect(
      evaluateOfficialResultCorrectionStatus({ stage: 'group', tournamentStatus: 'knockout' }),
    ).toBe('group-stage-advanced');
  });

  it('locks a Knockout result exactly when its dependent Match has begun', () => {
    expect(
      evaluateOfficialResultCorrectionStatus({
        stage: 'knockout',
        tournamentStatus: 'knockout',
        dependentMatchStatus: 'scheduled',
      }),
    ).toBe('unlocked');
    expect(
      evaluateOfficialResultCorrectionStatus({
        stage: 'knockout',
        tournamentStatus: 'knockout',
        dependentMatchStatus: 'in-progress',
      }),
    ).toBe('dependent-match-started');
    expect(
      evaluateOfficialResultCorrectionStatus({
        stage: 'knockout',
        tournamentStatus: 'completed',
        dependentMatchStatus: 'completed',
      }),
    ).toBe('dependent-match-started');
  });

  it('does not invent correction behavior for invalid Tournament lifecycle states', () => {
    expect(
      evaluateOfficialResultCorrectionStatus({
        stage: 'knockout',
        tournamentStatus: 'cancelled',
      }),
    ).toBe('tournament-state-invalid');
  });
});
