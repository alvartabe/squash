import type { GroupMatch, Standing } from './types';

type MutableStanding = Omit<Standing, 'rank' | 'setDifferential' | 'pointDifferential'>;

function emptyStanding(playerId: string): MutableStanding {
  return {
    playerId,
    played: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

function headToHeadWinner(a: string, b: string, matches: readonly GroupMatch[]): string | null {
  const match = matches.find(
    (item) =>
      (item.playerOneId === a && item.playerTwoId === b) ||
      (item.playerOneId === b && item.playerTwoId === a),
  );
  if (!match || match.playerOneSets === match.playerTwoSets) return null;
  return match.playerOneSets > match.playerTwoSets ? match.playerOneId : match.playerTwoId;
}

export function calculateStandings(
  playerIds: readonly string[],
  matches: readonly GroupMatch[],
): Standing[] {
  const table = new Map(playerIds.map((playerId) => [playerId, emptyStanding(playerId)]));

  for (const match of matches) {
    const one = table.get(match.playerOneId);
    const two = table.get(match.playerTwoId);
    if (!one || !two) throw new Error('A group match contains a player outside the group.');
    if (match.playerOneSets === match.playerTwoSets)
      throw new Error('A completed group match cannot be tied.');

    one.played += 1;
    two.played += 1;
    one.setsWon += match.playerOneSets;
    one.setsLost += match.playerTwoSets;
    two.setsWon += match.playerTwoSets;
    two.setsLost += match.playerOneSets;
    one.pointsFor += match.playerOnePoints;
    one.pointsAgainst += match.playerTwoPoints;
    two.pointsFor += match.playerTwoPoints;
    two.pointsAgainst += match.playerOnePoints;
    if (match.playerOneSets > match.playerTwoSets) {
      one.wins += 1;
      two.losses += 1;
    } else {
      two.wins += 1;
      one.losses += 1;
    }
  }

  const rows = [...table.values()].map((row) => ({
    ...row,
    setDifferential: row.setsWon - row.setsLost,
    pointDifferential: row.pointsFor - row.pointsAgainst,
  }));
  const winGroupSizes = rows.reduce((counts, row) => {
    counts.set(row.wins, (counts.get(row.wins) ?? 0) + 1);
    return counts;
  }, new Map<number, number>());

  rows.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (winGroupSizes.get(a.wins) === 2) {
      const directWinner = headToHeadWinner(a.playerId, b.playerId, matches);
      if (directWinner) return directWinner === a.playerId ? -1 : 1;
    }
    if (a.setDifferential !== b.setDifferential) return b.setDifferential - a.setDifferential;
    if (a.pointDifferential !== b.pointDifferential)
      return b.pointDifferential - a.pointDifferential;
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;
    return a.playerId.localeCompare(b.playerId);
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
