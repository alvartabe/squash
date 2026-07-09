export type BestOf = 1 | 3 | 5;

export type MatchRules = {
  bestOf: BestOf;
  pointsToWin: number;
  winByTwo: boolean;
};

export type SetScore = {
  playerOnePoints: number;
  playerTwoPoints: number;
};

export type MatchResult = {
  completed: boolean;
  winner: 1 | 2 | null;
  playerOneSets: number;
  playerTwoSets: number;
  playerOnePoints: number;
  playerTwoPoints: number;
};

export type GroupMatch = {
  playerOneId: string;
  playerTwoId: string;
  playerOneSets: number;
  playerTwoSets: number;
  playerOnePoints: number;
  playerTwoPoints: number;
};

export type Standing = {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDifferential: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  rank: number;
};

export type Qualifier = {
  playerId: string;
  groupId: string;
  groupRank: number;
  wins: number;
  setDifferential: number;
  pointDifferential: number;
};

export type FirstRoundFixture = {
  position: number;
  playerOneId: string | null;
  playerTwoId: string | null;
  byePlayerId: string | null;
};
