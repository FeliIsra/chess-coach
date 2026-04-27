import { describe, expect, it } from "vitest";
import {
  extractPuzzles,
  humanizeEval,
  getRevealExplanation,
  Puzzle,
} from "@/components/puzzle-trainer";
import {
  describeEvalLoss,
  formatEvalLossPawns,
  playPuzzleCue,
} from "@/lib/puzzle-feedback";
import { GameAnalysis, LLMInsight, MoveAnalysis, TacticalCategory } from "@/lib/types";

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

function createPuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "0-10-Bb4",
    gameIndex: 0,
    fen: "r1bq1rk1/p2n1ppp/2n1p3/1p1pP3/2pP1P2/2B2NPB/PPPQ2PP/R3K2R w KQ - 0 1",
    fenAfter: "r1bq1rk1/p2n1ppp/2n1p3/1p1pP3/1BpP1P2/5NPB/PPPQ2PP/R3K2R b KQ - 1 1",
    bestMove: "c3b4",
    bestMoveLabel: "Bxb4",
    san: "Bb4",
    from: "c3",
    to: "b4",
    userColor: "white",
    moveNumber: 10,
    classification: "mistake",
    evalLoss: 60,
    ...overrides,
  };
}

describe("humanizeEval", () => {
  it.each([
    [0, "a slight edge"],
    [29, "a slight edge"],
    [30, "a small advantage"],
    [69, "a small advantage"],
    [70, "a significant advantage"],
    [149, "a significant advantage"],
    [150, "roughly a piece worth of advantage"],
    [299, "roughly a piece worth of advantage"],
    [300, "a decisive advantage"],
    [500, "a decisive advantage"],
  ])("returns correct text for %i centipawns", (cp, expected) => {
    expect(humanizeEval(cp)).toBe(expected);
  });
});

describe("puzzle feedback helpers", () => {
  it("keeps the shared eval-loss wording aligned with the trainer copy", () => {
    expect(describeEvalLoss(60)).toBe("a small advantage");
    expect(formatEvalLossPawns(60)).toBe("0.6 pawns");
    expect(describeEvalLoss(180)).toBe("roughly a piece worth of advantage");
  });

  it("falls back cleanly when audio support is unavailable", () => {
    expect(() => playPuzzleCue("wrong")).not.toThrow();
  });
});

describe("getRevealExplanation", () => {
  it("returns the puzzle explanation when one is provided", () => {
    const puzzle = createPuzzle({ explanation: "Custom explanation here." });
    expect(getRevealExplanation(puzzle)).toBe("Custom explanation here.");
  });

  it("returns tactics explanation when category is tactics", () => {
    const puzzle = createPuzzle({ category: "tactics" as TacticalCategory });
    expect(getRevealExplanation(puzzle)).toContain("forcing tactical idea");
  });

  it("returns king safety explanation when category is king safety", () => {
    const puzzle = createPuzzle({ category: "king safety" as TacticalCategory });
    expect(getRevealExplanation(puzzle)).toContain("pressure on your king");
  });

  it("returns piece safety explanation when category is piece safety", () => {
    const puzzle = createPuzzle({ category: "piece safety" as TacticalCategory });
    expect(getRevealExplanation(puzzle)).toContain("loose pieces defended");
  });

  it("returns default explanation when no category matches", () => {
    const puzzle = createPuzzle({ category: "pawn structure" as TacticalCategory });
    expect(getRevealExplanation(puzzle)).toContain("more control of the position");
  });

  it("returns default explanation when category is undefined", () => {
    const puzzle = createPuzzle({ category: undefined, explanation: undefined });
    expect(getRevealExplanation(puzzle)).toContain("more control of the position");
  });

  it("prefers explanation over category", () => {
    const puzzle = createPuzzle({
      explanation: "Use the explanation field.",
      category: "tactics" as TacticalCategory,
    });
    expect(getRevealExplanation(puzzle)).toBe("Use the explanation field.");
  });
});
