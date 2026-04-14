import { describe, expect, it } from "vitest";
import { extractPuzzles } from "@/components/puzzle-trainer";
import { GameAnalysis, LLMInsight, MoveAnalysis } from "@/lib/types";

function createMove(overrides: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    moveNumber: 10,
    san: "Bb4",
    userColor: "white",
    evalBefore: 10,
    evalAfter: -50,
    evalDiff: -60,
    bestMove: "c3b4",
    classification: "mistake",
    fen: "r1bq1rk1/p2n1ppp/2n1p3/1p1pP3/2pP1P2/2B2NPB/PPPQ2PP/R3K2R w KQ - 0 1",
    from: "c3",
    to: "b4",
    fenAfter: "r1bq1rk1/p2n1ppp/2n1p3/1p1pP3/1BpP1P2/5NPB/PPPQ2PP/R3K2R b KQ - 1 1",
    clockSeconds: 120,
    ...overrides,
  };
}

function createGame(
  userColor: "white" | "black",
  move: MoveAnalysis
): GameAnalysis {
  return {
    game: {
      url: "https://example.com/game",
      pgn: "[Event \"Live Chess\"]",
      timeClass: "blitz",
      userColor,
      userRating: 1200,
      opponentName: "opponent",
      opponentRating: 1250,
      result: "loss",
      openingName: "Sicilian Defense",
      date: "2026-03-04",
    },
    moves: [move],
    bestMoves: [move],
    worstMoves: [move],
    blunders: 0,
    mistakes: 1,
    inaccuracies: 0,
    averageEvalLoss: 60,
  };
}

describe("extractPuzzles", () => {
  it("keeps puzzle move coordinates and game color per puzzle", () => {
    const whiteMove = createMove({
      moveNumber: 13,
      userColor: "white",
      from: "c3",
      to: "b4",
      san: "Bb4",
      bestMove: "d2f4",
      classification: "mistake",
    });
    const blackMove = createMove({
      moveNumber: 17,
      userColor: "black",
      from: "c5",
      to: "b4",
      san: "Bb4",
      bestMove: "d7f6",
      classification: "blunder",
    });

    const games: GameAnalysis[] = [
      createGame("white", whiteMove),
      createGame("black", blackMove),
    ];

    const insights: LLMInsight[] = [
      {
        worstMovesAnalysis: [
          {
            move: "Bb4",
            moveNumber: 13,
            explanation: "Loses control of key squares.",
            concept: "piece activity",
            category: "positional",
          },
        ],
        bestMovesAnalysis: [],
        summary: "summary",
        improvementPlan: [],
        strengths: [],
        weaknesses: [],
      },
      {
        worstMovesAnalysis: [
          {
            move: "Bb4",
            moveNumber: 17,
            explanation: "Drops a tactical resource.",
            concept: "tactics",
            category: "tactics",
          },
        ],
        bestMovesAnalysis: [],
        summary: "summary",
        improvementPlan: [],
        strengths: [],
        weaknesses: [],
      },
    ];

    const puzzles = extractPuzzles(games, insights);

    expect(puzzles).toHaveLength(2);
    expect(puzzles[0]?.userColor).toBe("white");
    expect(puzzles[0]?.from).toBe("c3");
    expect(puzzles[0]?.to).toBe("b4");
    expect(puzzles[0]?.fenAfter).toContain(" b ");
    expect(puzzles[1]?.userColor).toBe("black");
    expect(puzzles[1]?.from).toBe("c5");
    expect(puzzles[1]?.to).toBe("b4");
    expect(puzzles[1]?.fenAfter).toContain(" b ");
  });
});
