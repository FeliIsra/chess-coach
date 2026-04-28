import { describe, it, expect } from "vitest";
import { extractSnapshotsFromResult } from "./elo-progress";
import type { FullAnalysisResult, GameAnalysis } from "./types";

function makeGame(overrides: Partial<GameAnalysis["game"]>): GameAnalysis {
  const game = {
    url: "https://chess.com/game/1",
    pgn: "",
    timeClass: "blitz",
    userColor: "white" as const,
    userRating: 1500,
    opponentName: "x",
    opponentRating: 1500,
    result: "win" as const,
    openingName: "x",
    date: "2026-04-20T00:00:00Z",
    ...overrides,
  };
  return {
    game,
    moves: [],
    bestMoves: [],
    worstMoves: [],
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    averageEvalLoss: 0,
  };
}

function makeResult(games: GameAnalysis[]): FullAnalysisResult {
  return {
    games,
    llmInsights: [],
    overallSummary: {
      wins: 0,
      losses: 0,
      draws: 0,
      totalBlunders: 0,
      totalMistakes: 0,
      averageAccuracy: 0,
    },
    overallInsight: {
      summary: "",
      topStrengths: [],
      topWeaknesses: [],
      studyPlan: [],
    },
  };
}

describe("extractSnapshotsFromResult", () => {
  it("returns one snapshot per time class with the most-recent rating", () => {
    const result = makeResult([
      makeGame({ timeClass: "bullet", userRating: 1200, date: "2026-04-10" }),
      makeGame({ timeClass: "bullet", userRating: 1230, date: "2026-04-12" }),
      makeGame({ timeClass: "blitz", userRating: 1500, date: "2026-04-11" }),
    ]);
    const snapshots = extractSnapshotsFromResult(result, "felo");
    expect(snapshots).toHaveLength(2);
    const byClass = Object.fromEntries(
      snapshots.map((s) => [s.timeClass, s.rating])
    );
    expect(byClass.bullet).toBe(1230);
    expect(byClass.blitz).toBe(1500);
    expect(snapshots[0].chessUsername).toBe("felo");
  });

  it("ignores games with missing timeClass or invalid rating", () => {
    const result = makeResult([
      makeGame({ timeClass: "", userRating: 1300 }),
      makeGame({ timeClass: "blitz", userRating: 0 }),
      makeGame({ timeClass: "rapid", userRating: 1700 }),
    ]);
    const snapshots = extractSnapshotsFromResult(result, "felo");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].timeClass).toBe("rapid");
    expect(snapshots[0].rating).toBe(1700);
  });

  it("returns empty array when there are no games", () => {
    const result = makeResult([]);
    expect(extractSnapshotsFromResult(result, "felo")).toEqual([]);
  });

  it("normalises time class to lowercase", () => {
    const result = makeResult([
      makeGame({ timeClass: "Bullet", userRating: 1100 }),
    ]);
    const [snap] = extractSnapshotsFromResult(result, "felo");
    expect(snap.timeClass).toBe("bullet");
  });
});
