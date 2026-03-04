"use client";

import { useState, useCallback, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { LLMInsight, MoveAnalysis, TacticalCategory } from "@/lib/types";
import { formatBestMoveLabel } from "@/lib/chess-format";
import {
  applyPuzzleAttempt,
  canRevealSolution,
  createPuzzleSessionStats,
  getFirstTryRatePercent,
} from "@/lib/puzzle-metrics";

export interface Puzzle {
  id: string;
  gameIndex: number;
  fen: string;
  bestMove: string;
  bestMoveLabel: string;
  san: string;
  moveNumber: number;
  classification: string;
  evalLoss: number;
  category?: TacticalCategory;
  concept?: string;
  explanation?: string;
}

interface Props {
  puzzles: Puzzle[];
  userColor: "white" | "black";
  onClose: () => void;
  initialIndex?: number;
}

export function extractPuzzles(
  games: { moves: MoveAnalysis[]; game: { userColor: "white" | "black" } }[],
  llmInsights: LLMInsight[] = []
): Puzzle[] {
  const puzzles: Puzzle[] = [];

  for (const [gameIndex, { moves }] of games.entries()) {
    const insight = llmInsights[gameIndex];

    for (const move of moves) {
      if (
        (move.classification === "blunder" || move.classification === "mistake") &&
        move.bestMove &&
        move.bestMove !== move.san
      ) {
        const matchingInsight = insight?.worstMovesAnalysis?.find(
          (entry) => entry.moveNumber === move.moveNumber && entry.move === move.san
        );

        puzzles.push({
          id: `${gameIndex}-${move.moveNumber}-${move.san}`,
          gameIndex,
          fen: move.fen,
          bestMove: move.bestMove,
          bestMoveLabel: formatBestMoveLabel(move.fen, move.bestMove),
          san: move.san,
          moveNumber: move.moveNumber,
          classification: move.classification,
          evalLoss: Math.max(0, -move.evalDiff),
          category: matchingInsight?.category,
          concept: matchingInsight?.concept,
          explanation: matchingInsight?.explanation,
        });
      }
    }
  }

  return puzzles;
}

type FeedbackState = "correct" | "wrong" | "revealed" | null;

export default function PuzzleTrainer({
  puzzles,
  userColor,
  onClose,
  initialIndex = 0,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0);
  const [stats, setStats] = useState(createPuzzleSessionStats);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const puzzle = puzzles[currentIndex];
  const isFinished = currentIndex >= puzzles.length;

  const moveToNextPuzzle = useCallback(() => {
    setFeedback(null);
    setAttemptsForCurrent(0);
    setCurrentIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (feedback !== "correct") return;

    const timer = window.setTimeout(() => {
      moveToNextPuzzle();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [feedback, moveToNextPuzzle]);

  const handleDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: unknown;
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!puzzle || !targetSquare || feedback === "correct" || feedback === "revealed") {
        return false;
      }

      const chess = new Chess(puzzle.fen);
      const possibleMove = chess.moves({ verbose: true }).find(
        (move) => move.from === sourceSquare && move.to === targetSquare
      );

      if (!possibleMove) return false;

      const playedMove =
        possibleMove.from + possibleMove.to + (possibleMove.promotion || "");
      const bestMove = puzzle.bestMove.toLowerCase().trim();
      const isCorrect =
        playedMove === bestMove ||
        playedMove.slice(0, 4) === bestMove.slice(0, 4);

      setStats((current) =>
        applyPuzzleAttempt(current, attemptsForCurrent, isCorrect)
      );

      if (isCorrect) {
        setFeedback("correct");
      } else {
        setFeedback("wrong");
        setAttemptsForCurrent((current) => current + 1);
      }

      return true;
    },
    [attemptsForCurrent, feedback, puzzle]
  );

  if (isFinished) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6 text-center space-y-4">
        <h3 className="text-lg font-bold text-foreground">Practice Complete</h3>
        <p className="text-3xl font-bold text-primary">
          {stats.solved}/{puzzles.length}
        </p>
        <div className="space-y-1 text-sm text-muted">
          <p>{stats.solvedFirstTry} solved on the first try</p>
          <p>{stats.attemptedPuzzles} puzzles attempted</p>
          <p>{stats.attempts} total move attempts</p>
          <p>
            {getFirstTryRatePercent(stats.solvedFirstTry, stats.attemptedPuzzles)}%
            {" "}first-try rate
          </p>
        </div>
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
        <h3 className="text-lg font-bold text-foreground">Practice Your Mistakes</h3>
        <button onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Close
        </button>
      </div>

      <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Puzzle {currentIndex + 1} of {puzzles.length}
          </span>
          <div className="text-right">
            <p className="font-mono text-foreground">{stats.solved} solved</p>
            <p className="text-xs text-muted">
              {stats.attemptedPuzzles} attempted ·
              {" "}
              {getFirstTryRatePercent(stats.solvedFirstTry, stats.attemptedPuzzles)}%
              {" "}first try
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground/80">
          You played <span className="font-mono text-accent-red">{puzzle.san}</span> (
          {puzzle.classification}) on move {puzzle.moveNumber}. Find the best move to avoid
          dropping about {(puzzle.evalLoss / 100).toFixed(1)} pawns of value.
        </p>

        {(puzzle.category || puzzle.concept) && (
          <div className="flex flex-wrap gap-2">
            {puzzle.category && (
              <span className="text-xs bg-accent-blue/15 text-accent-blue px-2 py-1 rounded-full capitalize">
                Theme: {puzzle.category}
              </span>
            )}
            {puzzle.concept && (
              <span className="text-xs bg-surface-2 text-foreground/70 px-2 py-1 rounded-full">
                {puzzle.concept}
              </span>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <div className="rounded-lg overflow-hidden">
            <Chessboard
              options={{
                position: puzzle.fen,
                boardOrientation: userColor,
                darkSquareStyle: { backgroundColor: "#4a3728" },
                lightSquareStyle: { backgroundColor: "#d4a96a" },
                allowDragging: feedback !== "correct" && feedback !== "revealed",
                allowDrawingArrows: false,
                onPieceDrop: handleDrop,
              }}
            />
          </div>
        </div>

        {feedback === "correct" && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl px-4 py-3 text-accent-green text-sm text-center">
            <p className="font-semibold">Correct.</p>
            <p className="mt-1">That move holds the position together better than {puzzle.san}.</p>
          </div>
        )}

        {feedback === "wrong" && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-accent-red text-sm">
            <p className="font-semibold">Incorrect.</p>
            <p className="mt-1">
              {attemptsForCurrent >= 2
                ? "You can reveal the solution or keep trying."
                : "Try again and look for the move that reduces the danger immediately."}
            </p>
          </div>
        )}

        {feedback === "revealed" && (
          <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-xl px-4 py-3 text-sm text-foreground/80">
            <p className="font-semibold text-accent-blue">Solution</p>
            <p className="mt-1">
              Best move: <span className="font-mono text-accent-blue">{puzzle.bestMoveLabel}</span>
            </p>
            <p className="mt-1">
              Your move {puzzle.san} let the evaluation fall quickly. The engine move keeps more
              control and prevents the position from collapsing.
            </p>
            {puzzle.explanation && (
              <p className="mt-2 text-foreground/70">{puzzle.explanation}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Attempts on this puzzle: {attemptsForCurrent + (feedback === "correct" ? 1 : 0)}
          </p>
          <div className="flex gap-2">
            {feedback === "wrong" && canRevealSolution(attemptsForCurrent) && (
              <button
                onClick={() => setFeedback("revealed")}
                className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg border border-border transition-colors"
              >
                Reveal solution
              </button>
            )}
            {(feedback === "revealed" || feedback === "wrong") && (
              <button
                onClick={moveToNextPuzzle}
                className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg border border-border transition-colors"
              >
                Next puzzle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
