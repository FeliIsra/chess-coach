"use client";

import { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { MoveAnalysis } from "@/lib/types";

interface Puzzle {
  fen: string;
  bestMove: string; // UCI format e.g. "e2e4"
  san: string; // what the user played (wrong)
  moveNumber: number;
  classification: string;
}

interface Props {
  puzzles: Puzzle[];
  userColor: "white" | "black";
  onClose: () => void;
}

export function extractPuzzles(
  games: { moves: MoveAnalysis[]; game: { userColor: "white" | "black" } }[]
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (const { moves } of games) {
    for (const move of moves) {
      if (
        (move.classification === "blunder" || move.classification === "mistake") &&
        move.bestMove &&
        move.bestMove !== move.san
      ) {
        puzzles.push({
          fen: move.fen,
          bestMove: move.bestMove, // UCI from Stockfish
          san: move.san,
          moveNumber: move.moveNumber,
          classification: move.classification,
        });
      }
    }
  }
  return puzzles;
}

export default function PuzzleTrainer({ puzzles, userColor, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const puzzle = puzzles[currentIndex];
  const isFinished = currentIndex >= puzzles.length;

  const handleDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      if (feedback || !puzzle || !targetSquare) return false;

      const userUCI = sourceSquare + targetSquare;

      // Also try with promotion
      const chess = new Chess(puzzle.fen);
      const possibleMove = chess.moves({ verbose: true }).find(
        (m) => m.from === sourceSquare && m.to === targetSquare
      );
      if (!possibleMove) return false;

      const moveUCI = possibleMove.from + possibleMove.to + (possibleMove.promotion || "");
      const bestClean = puzzle.bestMove.toLowerCase().trim();

      // Compare: exact UCI match or the base squares match
      const isCorrect =
        moveUCI === bestClean ||
        userUCI === bestClean ||
        userUCI === bestClean.slice(0, 4);

      if (isCorrect) {
        setFeedback("correct");
        setScore((s) => ({ ...s, correct: s.correct + 1 }));
      } else {
        setFeedback("wrong");
        setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
      }

      setTimeout(() => {
        setFeedback(null);
        setCurrentIndex((i) => i + 1);
      }, 1500);

      return true;
    },
    [puzzle, feedback]
  );

  if (isFinished) {
    const total = score.correct + score.wrong;
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6 text-center space-y-4">
        <h3 className="text-lg font-bold text-foreground">Practice Complete!</h3>
        <p className="text-3xl font-bold text-primary">
          {score.correct}/{total}
        </p>
        <p className="text-sm text-muted">
          {score.correct === total
            ? "Perfect! You found all the best moves."
            : score.correct > total / 2
            ? "Good work! Keep practicing these patterns."
            : "These positions are tricky. Review them again later."}
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors"
        >
          Back to Results
        </button>
      </div>
    );
  }

  if (!puzzle) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">
          Practice Your Mistakes
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Puzzle {currentIndex + 1} of {puzzles.length}
          </span>
          <span className="font-mono text-foreground">
            <span className="text-accent-green">{score.correct}</span>
            {" / "}
            <span className="text-accent-red">{score.wrong}</span>
          </span>
        </div>

        <p className="text-sm text-foreground/80">
          You played <span className="font-mono text-accent-red">{puzzle.san}</span> (
          {puzzle.classification}) on move {puzzle.moveNumber}. Find the best move!
        </p>

        <div className="flex justify-center">
          <div className="rounded-lg overflow-hidden">
            <Chessboard
              options={{
                position: puzzle.fen,
                boardOrientation: userColor,
                darkSquareStyle: { backgroundColor: "#4a3728" },
                lightSquareStyle: { backgroundColor: "#d4a96a" },
                allowDragging: !feedback,
                allowDrawingArrows: false,
                onPieceDrop: handleDrop,
              }}
            />
          </div>
        </div>

        {feedback === "correct" && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl px-4 py-3 text-accent-green text-sm text-center font-semibold">
            Correct! That&apos;s the best move.
          </div>
        )}
        {feedback === "wrong" && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-accent-red text-sm text-center">
            Not quite. The best move was{" "}
            <span className="font-mono font-semibold">{puzzle.bestMove}</span>
          </div>
        )}
      </div>
    </div>
  );
}
