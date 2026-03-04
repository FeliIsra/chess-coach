export interface PuzzleSessionStats {
  solved: number;
  solvedFirstTry: number;
  attempts: number;
  attemptedPuzzles: number;
}

export function createPuzzleSessionStats(): PuzzleSessionStats {
  return {
    solved: 0,
    solvedFirstTry: 0,
    attempts: 0,
    attemptedPuzzles: 0,
  };
}

export function applyPuzzleAttempt(
  current: PuzzleSessionStats,
  attemptsBeforeCurrent: number,
  isCorrect: boolean
): PuzzleSessionStats {
  const isFirstAttemptForPuzzle = attemptsBeforeCurrent === 0;
  const next: PuzzleSessionStats = {
    ...current,
    attempts: current.attempts + 1,
    attemptedPuzzles:
      current.attemptedPuzzles + (isFirstAttemptForPuzzle ? 1 : 0),
  };

  if (!isCorrect) {
    return next;
  }

  return {
    ...next,
    solved: next.solved + 1,
    solvedFirstTry: next.solvedFirstTry + (isFirstAttemptForPuzzle ? 1 : 0),
  };
}

export function getFirstTryRatePercent(
  solvedFirstTry: number,
  attemptedPuzzles: number
): number {
  if (attemptedPuzzles <= 0) return 0;
  return Math.round((solvedFirstTry / attemptedPuzzles) * 100);
}

export function canRevealSolution(attemptsForCurrent: number): boolean {
  return attemptsForCurrent >= 2;
}
