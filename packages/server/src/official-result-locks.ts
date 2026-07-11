import type {
  MatchStatus,
  OfficialResultCorrectionStatus,
  TournamentStatus,
} from '@squash/contracts';

export type { OfficialResultCorrectionStatus } from '@squash/contracts';

export function evaluateOfficialResultCorrectionStatus(input: {
  stage: 'group' | 'knockout';
  tournamentStatus: TournamentStatus;
  dependentMatchStatus?: MatchStatus | null;
}): OfficialResultCorrectionStatus {
  if (input.stage === 'group') {
    if (input.tournamentStatus === 'group-stage') return 'unlocked';
    if (input.tournamentStatus === 'knockout' || input.tournamentStatus === 'completed') {
      return 'group-stage-advanced';
    }
    return 'tournament-state-invalid';
  }

  if (input.tournamentStatus !== 'knockout' && input.tournamentStatus !== 'completed') {
    return 'tournament-state-invalid';
  }
  if (input.dependentMatchStatus && input.dependentMatchStatus !== 'scheduled') {
    return 'dependent-match-started';
  }
  return 'unlocked';
}
