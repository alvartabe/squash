'use client';

import type { TournamentGroupFixture, TournamentKnockoutFixture } from '@squash/contracts';
import type { MessageKey } from '@squash/i18n';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTournamentAction } from '@/src/hooks/workspace';
import { useLocale } from '@/src/locale-provider';

function ScoreField({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

type ResultFixture = TournamentGroupFixture | TournamentKnockoutFixture;

function scoreIsAValidGame(
  playerOnePoints: number,
  playerTwoPoints: number,
  rules: ResultFixture['scoringRules'],
) {
  if (
    !Number.isInteger(playerOnePoints) ||
    !Number.isInteger(playerTwoPoints) ||
    playerOnePoints < 0 ||
    playerTwoPoints < 0 ||
    playerOnePoints === playerTwoPoints
  ) {
    return false;
  }
  const winner = Math.max(playerOnePoints, playerTwoPoints);
  const loser = Math.min(playerOnePoints, playerTwoPoints);
  return rules.winByTwo
    ? winner >= rules.pointsToWin && winner - loser >= 2
    : winner === rules.pointsToWin;
}

function officialResultErrorMessageKey(error: unknown): MessageKey {
  const code = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data
    ?.error?.code;
  if (code === 'FORBIDDEN') return 'error.forbidden';
  if (code === 'OFFICIAL_RESULT_GAMES_INVALID' || code === 'OFFICIAL_RESULT_INCOMPLETE') {
    return 'tournaments.officialResult.validationError';
  }
  if (
    code === 'OFFICIAL_RESULT_EXISTS' ||
    code === 'OFFICIAL_RESULT_STALE' ||
    code === 'OFFICIAL_RESULT_CONFLICT'
  ) {
    return 'tournaments.officialResult.conflictError';
  }
  if (code === 'OFFICIAL_RESULT_NOT_RECORDABLE' || code === 'OFFICIAL_RESULT_FIXTURE_UNAVAILABLE') {
    return 'tournaments.officialResult.unavailableError';
  }
  return 'tournaments.officialResult.error';
}

export function FixtureOfficialResult({
  clubId,
  fixture,
  tournamentId,
}: {
  clubId: string;
  fixture: ResultFixture;
  tournamentId: string;
}) {
  const action = useTournamentAction(clubId);
  const { t } = useLocale();
  const [scores, setScores] = useState(() =>
    Array.from({ length: fixture.scoringRules.bestOf }, () => ({
      playerOnePoints: '',
      playerTwoPoints: '',
    })),
  );
  const [validationError, setValidationError] = useState(false);
  const playerOne = fixture.playerOne;
  const playerTwo = fixture.playerTwo;
  if (fixture.matchStatus === 'completed' && playerOne && playerTwo) {
    const winner = fixture.winnerId === playerOne.id ? playerOne.name : playerTwo.name;
    return (
      <div className="grid gap-1 text-sm">
        <p>
          {fixture.games
            .map((game) => `${game.playerOnePoints}–${game.playerTwoPoints}`)
            .join(', ')}
        </p>
        <p className="font-medium">
          {t('tournaments.officialResult.winner')}: {winner}
        </p>
      </div>
    );
  }
  if (!fixture.mayRecordInitialOfficialResult || !fixture.matchId || !playerOne || !playerTwo) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const games: Array<{ playerOnePoints: number; playerTwoPoints: number }> = [];
    let foundBlank = false;
    let playerOneGames = 0;
    let playerTwoGames = 0;
    const required = Math.floor(fixture.scoringRules.bestOf / 2) + 1;
    let valid = true;
    for (const score of scores) {
      if (score.playerOnePoints === '' && score.playerTwoPoints === '') {
        foundBlank = true;
        continue;
      }
      if (
        score.playerOnePoints === '' ||
        score.playerTwoPoints === '' ||
        foundBlank ||
        playerOneGames === required ||
        playerTwoGames === required
      ) {
        valid = false;
        break;
      }
      const playerOnePoints = Number(score.playerOnePoints);
      const playerTwoPoints = Number(score.playerTwoPoints);
      if (!scoreIsAValidGame(playerOnePoints, playerTwoPoints, fixture.scoringRules)) {
        valid = false;
        break;
      }
      games.push({ playerOnePoints, playerTwoPoints });
      if (playerOnePoints > playerTwoPoints) playerOneGames += 1;
      else playerTwoGames += 1;
    }
    if (playerOneGames !== required && playerTwoGames !== required) valid = false;
    setValidationError(!valid);
    if (!valid) return;
    action.mutate({
      path: `/tournaments/${tournamentId}/fixtures/${fixture.id}/official-result`,
      data: { expectedRevision: fixture.currentRevision, games },
    });
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <fieldset className="grid gap-2" disabled={action.isPending}>
        <legend className="sr-only">{t('tournaments.officialResult.heading')}</legend>
        {scores.map((score, index) => (
          <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-2" key={index}>
            <span className="pb-2 text-sm">
              {t('tournaments.officialResult.game')} {index + 1}
            </span>
            <ScoreField
              aria-label={`${playerOne.name} ${t('tournaments.officialResult.game')} ${index + 1}`}
              label={playerOne.name}
              min="0"
              name={`${fixture.id}-game-${index + 1}-one`}
              onChange={(event) =>
                setScores((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, playerOnePoints: event.target.value } : item,
                  ),
                )
              }
              type="number"
              value={score.playerOnePoints}
            />
            <ScoreField
              aria-label={`${playerTwo.name} ${t('tournaments.officialResult.game')} ${index + 1}`}
              label={playerTwo.name}
              min="0"
              name={`${fixture.id}-game-${index + 1}-two`}
              onChange={(event) =>
                setScores((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, playerTwoPoints: event.target.value } : item,
                  ),
                )
              }
              type="number"
              value={score.playerTwoPoints}
            />
          </div>
        ))}
      </fieldset>
      <Button disabled={action.isPending} size="sm" type="submit">
        {action.isPending
          ? t('tournaments.officialResult.submitting')
          : t('tournaments.officialResult.submit')}
      </Button>
      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {t('tournaments.officialResult.validationError')}
        </p>
      ) : null}
      {action.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {t(officialResultErrorMessageKey(action.error))}
        </p>
      ) : null}
    </form>
  );
}
