import { calculateMatchResult, InvalidScoreError } from '../scoring';

describe('calculateMatchResult', () => {
  test('finishes a best-of-five match after three wins', () => {
    expect(
      calculateMatchResult(
        [
          { playerOnePoints: 11, playerTwoPoints: 7 },
          { playerOnePoints: 11, playerTwoPoints: 9 },
          { playerOnePoints: 12, playerTwoPoints: 10 },
        ],
        { bestOf: 5, pointsToWin: 11, winByTwo: true },
      ),
    ).toMatchObject({ completed: true, winner: 1, playerOneSets: 3, playerTwoSets: 0 });
  });

  test('rejects a one-point win when advantage is enabled', () => {
    expect(() =>
      calculateMatchResult([{ playerOnePoints: 11, playerTwoPoints: 10 }], {
        bestOf: 1,
        pointsToWin: 11,
        winByTwo: true,
      }),
    ).toThrow(InvalidScoreError);
  });

  test('rejects sets after the match has ended', () => {
    expect(() =>
      calculateMatchResult(
        [
          { playerOnePoints: 11, playerTwoPoints: 2 },
          { playerOnePoints: 11, playerTwoPoints: 4 },
          { playerOnePoints: 3, playerTwoPoints: 11 },
        ],
        { bestOf: 3, pointsToWin: 11, winByTwo: false },
      ),
    ).toThrow('after the match had ended');
  });
});
