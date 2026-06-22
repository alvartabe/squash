import type { MatchResult, MatchRules, SetScore } from './types';

export class InvalidScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScoreError';
  }
}

export function setsRequiredToWin(bestOf: MatchRules['bestOf']): number {
  return Math.floor(bestOf / 2) + 1;
}

export function getSetWinner(score: SetScore, rules: MatchRules): 1 | 2 {
  const one = score.playerOnePoints;
  const two = score.playerTwoPoints;
  if (!Number.isInteger(one) || !Number.isInteger(two) || one < 0 || two < 0 || one === two) {
    throw new InvalidScoreError('A set requires two different non-negative integer scores.');
  }

  const winner = one > two ? 1 : 2;
  const winnerPoints = Math.max(one, two);
  const loserPoints = Math.min(one, two);

  if (winnerPoints < rules.pointsToWin) {
    throw new InvalidScoreError('The winner did not reach the configured points target.');
  }
  if (rules.winByTwo && winnerPoints - loserPoints < 2) {
    throw new InvalidScoreError('The set must be won by two points.');
  }
  if (!rules.winByTwo && winnerPoints !== rules.pointsToWin) {
    throw new InvalidScoreError('A set without advantage ends at the configured points target.');
  }

  return winner;
}

export function calculateMatchResult(sets: readonly SetScore[], rules: MatchRules): MatchResult {
  if (sets.length === 0 || sets.length > rules.bestOf) {
    throw new InvalidScoreError(
      `A best-of-${rules.bestOf} match has between 1 and ${rules.bestOf} sets.`,
    );
  }

  const required = setsRequiredToWin(rules.bestOf);
  let playerOneSets = 0;
  let playerTwoSets = 0;
  let playerOnePoints = 0;
  let playerTwoPoints = 0;

  for (const [index, set] of sets.entries()) {
    if (playerOneSets === required || playerTwoSets === required) {
      throw new InvalidScoreError(`Set ${index + 1} was recorded after the match had ended.`);
    }
    const winner = getSetWinner(set, rules);
    playerOnePoints += set.playerOnePoints;
    playerTwoPoints += set.playerTwoPoints;
    if (winner === 1) playerOneSets += 1;
    else playerTwoSets += 1;
  }

  const completed = playerOneSets === required || playerTwoSets === required;
  return {
    completed,
    winner: completed ? (playerOneSets > playerTwoSets ? 1 : 2) : null,
    playerOneSets,
    playerTwoSets,
    playerOnePoints,
    playerTwoPoints,
  };
}
