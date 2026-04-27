import { describe, expect, it } from "vitest";
import { generateAnnotatedPGN } from "@/lib/pgn-export";
import { GameAnalysis, LLMInsight, ChessGame, MoveAnalysis } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers to build minimal mock objects                              */
/* ------------------------------------------------------------------ */

const SHORT_PGN = `[Event "Test"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0`;

function makeGame(overrides: Partial<ChessGame> = {}): ChessGame {
  return {
    url: "https://chess.com/game/1",
    pgn: SHORT_PGN,
    timeClass: "rapid",
    userColor: "white",
    userRating: 1200,
    opponentName: "Opponent",
    opponentRating: 1250,
    result: "win",
    openingName: "Ruy Lopez",
    date: "2025-01-01",
    ...overrides,
  };
}

function makeMove(moveNumber: number, san: string): MoveAnalysis {
  return {
    moveNumber,
    san,
    userColor: "white",
    evalBefore: 0,
    evalAfter: 0,
    evalDiff: 0,
    bestMove: san,
    classification: "good",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    from: "e2",
    to: "e4",
    fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  };
}

function makeGameAnalysis(overrides: Partial<GameAnalysis> = {}): GameAnalysis {
  return {
    game: makeGame(),
    moves: [makeMove(1, "e4"), makeMove(2, "Nf3"), makeMove(3, "Bb5")],
    bestMoves: [],
    worstMoves: [],
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    averageEvalLoss: 0,
    ...overrides,
  };
}

function makeInsight(overrides: Partial<LLMInsight> = {}): LLMInsight {
  return {
    worstMovesAnalysis: [],
    bestMovesAnalysis: [],
    summary: "Test summary",
    improvementPlan: ["Study tactics"],
    strengths: ["Solid openings"],
    weaknesses: ["Endgames"],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("generateAnnotatedPGN", () => {
  it("returns empty string for empty games array", () => {
    const result = generateAnnotatedPGN([], []);
    expect(result).toBe("");
  });

  it("generates valid PGN headers from a single game", () => {
    const analysis = makeGameAnalysis();
    const insight = makeInsight();
    const result = generateAnnotatedPGN([analysis], [insight]);

    expect(result).toContain('[Event "Test"]');
    expect(result).toContain('[White "Player1"]');
    expect(result).toContain('[Black "Player2"]');
    expect(result).toContain('[Result "1-0"]');
    // Headers should appear before the move text
    const headerEnd = result.indexOf('[Result "1-0"]');
    const moveStart = result.indexOf("1.");
    expect(headerEnd).toBeLessThan(moveStart);
  });

  it("inserts mistake annotations at correct move positions", () => {
    const analysis = makeGameAnalysis();
    const insight = makeInsight({
      worstMovesAnalysis: [
        {
          move: "O-O",
          moveNumber: 5,
          explanation: "Castling too early allows a6 push",
          concept: "King safety",
        },
      ],
    });

    const result = generateAnnotatedPGN([analysis], [insight]);

    // The annotation should appear after move 5's first move (O-O)
    expect(result).toContain("{Mistake: Castling too early allows a6 push. Best was O-O}");

    // Verify the annotation is placed after a move at move 5, not before
    const moveIndex = result.indexOf("5.");
    const annotationIndex = result.indexOf("{Mistake:");
    expect(moveIndex).toBeLessThan(annotationIndex);

    // The annotation should NOT appear before move 4
    const move4Index = result.indexOf("4.");
    expect(annotationIndex).toBeGreaterThan(move4Index);
  });

  it("inserts great move annotations at correct positions", () => {
    const analysis = makeGameAnalysis();
    const insight = makeInsight({
      bestMovesAnalysis: [
        {
          move: "Nf3",
          moveNumber: 2,
          explanation: "Develops knight to ideal square controlling center",
          concept: "Development",
        },
      ],
    });

    const result = generateAnnotatedPGN([analysis], [insight]);

    expect(result).toContain(
      "{Great move: Develops knight to ideal square controlling center}",
    );

    // Verify it appears after move 2 marker
    const move2Index = result.indexOf("2.");
    const annotationIndex = result.indexOf("{Great move:");
    expect(move2Index).toBeLessThan(annotationIndex);
  });

  it("handles multiple games separated by newlines", () => {
    const game1 = makeGameAnalysis({
      game: makeGame({ url: "https://chess.com/game/1" }),
    });
    const game2PGN = `[Event "Game2"]
[White "Alice"]
[Black "Bob"]
[Result "0-1"]

1. d4 d5 2. c4 e6 0-1`;
    const game2 = makeGameAnalysis({
      game: makeGame({ url: "https://chess.com/game/2", pgn: game2PGN }),
    });

    const insight1 = makeInsight({ summary: "Game 1 summary" });
    const insight2 = makeInsight({ summary: "Game 2 summary" });

    const result = generateAnnotatedPGN([game1, game2], [insight1, insight2]);

    // Both games should be present
    expect(result).toContain('[Event "Test"]');
    expect(result).toContain('[Event "Game2"]');
    expect(result).toContain('[White "Player1"]');
    expect(result).toContain('[White "Alice"]');

    // Games should be separated by newlines (triple newline separator)
    const parts = result.split("\n\n\n");
    expect(parts.length).toBe(2);
  });

  it("handles a game with no LLM insights (no annotations, just raw PGN)", () => {
    const analysis = makeGameAnalysis();
    const result = generateAnnotatedPGN([analysis], [undefined as unknown as LLMInsight]);

    // Should still contain headers and moves
    expect(result).toContain('[Event "Test"]');
    expect(result).toContain("1. e4 e5");
    expect(result).toContain("1-0");

    // Should NOT contain any annotation braces (other than any that might be in the raw PGN)
    expect(result).not.toContain("{Mistake:");
    expect(result).not.toContain("{Great move:");
  });

  it("keeps annotations attached to the matching SAN and deduplicates repeated notes", () => {
    const analysis = makeGameAnalysis({
      game: makeGame({
        pgn: `[Event "Test"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0`,
      }),
    });
    const insight = makeInsight({
      worstMovesAnalysis: [
        {
          move: "Bb5",
          moveNumber: 3,
          explanation: "Stop repeating the same idea {and keep pressure}",
          concept: "King safety",
        },
        {
          move: "Bb5",
          moveNumber: 3,
          explanation: "Stop repeating the same idea {and keep pressure}",
          concept: "King safety",
        },
        {
          move: "a6",
          moveNumber: 3,
          explanation: "Castle before grabbing space",
          concept: "Development",
        },
      ],
    });

    const result = generateAnnotatedPGN([analysis], [insight]);

    expect(result.match(/\{Mistake: Stop repeating the same idea and keep pressure\. Best was Bb5\}/g)?.length).toBe(1);
    expect(result).toContain("{Mistake: Castle before grabbing space. Best was a6}");
    expect(result.indexOf("Bb5")).toBeLessThan(
      result.indexOf("{Mistake: Stop repeating the same idea and keep pressure. Best was Bb5}"),
    );
    expect(result.indexOf("a6")).toBeLessThan(
      result.indexOf("{Mistake: Castle before grabbing space. Best was a6}"),
    );
  });
});
