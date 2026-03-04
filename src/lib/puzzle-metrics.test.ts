import { describe, expect, it } from "vitest";
import {
  applyPuzzleAttempt,
  canRevealSolution,
  createPuzzleSessionStats,
  getFirstTryRatePercent,
} from "@/lib/puzzle-metrics";

describe("puzzle metrics", () => {
  it("counts first-try solves correctly", () => {
    const initial = createPuzzleSessionStats();
    const next = applyPuzzleAttempt(initial, 0, true);

    expect(next.attempts).toBe(1);
    expect(next.attemptedPuzzles).toBe(1);
    expect(next.solved).toBe(1);
    expect(next.solvedFirstTry).toBe(1);
    expect(getFirstTryRatePercent(next.solvedFirstTry, next.attemptedPuzzles)).toBe(
      100
    );
  });

  it("does not count solvedFirstTry after multiple attempts", () => {
    const initial = createPuzzleSessionStats();
    const afterWrong = applyPuzzleAttempt(initial, 0, false);
    const afterWrongAgain = applyPuzzleAttempt(afterWrong, 1, false);
    const afterSolve = applyPuzzleAttempt(afterWrongAgain, 2, true);

    expect(afterSolve.attemptedPuzzles).toBe(1);
    expect(afterSolve.attempts).toBe(3);
    expect(afterSolve.solved).toBe(1);
    expect(afterSolve.solvedFirstTry).toBe(0);
    expect(getFirstTryRatePercent(afterSolve.solvedFirstTry, afterSolve.attemptedPuzzles)).toBe(
      0
    );
  });

  it("allows reveal only after two failed tries", () => {
    expect(canRevealSolution(0)).toBe(false);
    expect(canRevealSolution(1)).toBe(false);
    expect(canRevealSolution(2)).toBe(true);
  });
});
