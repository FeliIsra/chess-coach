"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { LLMInsight, MoveAnalysis, TacticalCategory } from "@/lib/types";
import { formatBestMoveLabel } from "@/lib/chess-format";
import {
  applyPuzzleAttempt,
  createPuzzleSessionStats,
  getFirstTryRatePercent,
} from "@/lib/puzzle-metrics";

export interface Puzzle {
  id: string;
  gameIndex: number;
  fen: string;
  fenAfter: string;
  bestMove: string;
  bestMoveLabel: string;
  san: string;
  from: string;
  to: string;
  userColor: "white" | "black";
  moveNumber: number;
  classification: string;
  evalLoss: number;
  category?: TacticalCategory;
  concept?: string;
  explanation?: string;
}

interface Props {
  puzzles: Puzzle[];
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
          fenAfter: move.fenAfter,
          bestMove: move.bestMove,
          bestMoveLabel: formatBestMoveLabel(move.fen, move.bestMove),
          san: move.san,
          from: move.from,
          to: move.to,
          userColor: games[gameIndex].game.userColor,
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

export function getRevealExplanation(puzzle: Puzzle): string {
  if (puzzle.explanation) {
    return puzzle.explanation;
  }
  if (puzzle.category === "tactics") {
    return "The engine line works because it deals with the forcing tactical idea before your opponent can exploit it.";
  }
  if (puzzle.category === "king safety") {
    return "The engine move reduces pressure on your king and removes the most dangerous attacking continuation.";
  }
  if (puzzle.category === "piece safety") {
    return "The engine move keeps your loose pieces defended and avoids letting the position collapse tactically.";
  }
  return "The engine move keeps more control of the position and avoids the tactical or structural damage caused by your move.";
}

/** Map a centipawn eval-loss to a human-friendly description. */
export function humanizeEval(centipawns: number): string {
  const pawns = centipawns / 100;
  if (pawns < 0.3) return "a slight edge";
  if (pawns < 0.7) return "a small advantage";
  if (pawns < 1.5) return "a significant advantage";
  if (pawns < 3.0) return "roughly a piece worth of advantage";
  return "a decisive advantage";
}

export default function PuzzleTrainer({
  puzzles,
  onClose,
  initialIndex = 0,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [attemptsForCurrent, setAttemptsForCurrent] = useState(0);
  const [stats, setStats] = useState(createPuzzleSessionStats);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showAfterPosition, setShowAfterPosition] = useState(false);

  const puzzle = puzzles[currentIndex];
  const isFinished = currentIndex >= puzzles.length;

  const moveToNextPuzzle = useCallback(() => {
    setFeedback(null);
    setAttemptsForCurrent(0);
    setHintLevel(0);
    setShowAfterPosition(false);
    setCurrentIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (feedback !== "correct") return;

    const timer = window.setTimeout(() => {
      moveToNextPuzzle();
    }, 1500);

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
      if (
        !puzzle ||
        !targetSquare ||
        feedback === "correct" ||
        feedback === "revealed" ||
        showAfterPosition
      ) {
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
    [attemptsForCurrent, feedback, puzzle, showAfterPosition]
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
          {puzzle.classification}) on move {puzzle.moveNumber}. Find a better move to avoid
          losing {humanizeEval(puzzle.evalLoss)} (~{(puzzle.evalLoss / 100).toFixed(1)}).
        </p>

        {(puzzle.category || puzzle.concept) && hintLevel === 0 && (
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

        {hintLevel >= 1 && hintLevel <= 3 && feedback !== "revealed" && (
          <div className="bg-accent-blue/10 border border-accent-blue/25 rounded-xl px-4 py-3 text-sm space-y-1">
            <p className="font-semibold text-accent-blue">
              Hint {hintLevel} of 3
            </p>
            {hintLevel >= 1 && (
              <p className="text-foreground/80">
                {puzzle.concept
                  ? `Think about ${puzzle.concept}...`
                  : puzzle.category
                    ? `This is a ${puzzle.category} problem.`
                    : "Look for the move that improves your position the most."}
              </p>
            )}
            {hintLevel >= 2 && (
              <p className="text-foreground/80">
                The best move involves the piece on{" "}
                <span className="font-mono text-accent-blue">
                  {puzzle.bestMove.slice(0, 2)}
                </span>
                .
              </p>
            )}
            {hintLevel >= 3 && (
              <p className="text-foreground/80">
                Try moving from{" "}
                <span className="font-mono text-accent-blue">
                  {puzzle.bestMove.slice(0, 2)}
                </span>{" "}
                to{" "}
                <span className="font-mono text-accent-blue">
                  {puzzle.bestMove.slice(2, 4)}
                </span>
                .
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <div
            className={`rounded-lg overflow-hidden border-2 transition-colors duration-300 ${
              feedback === "correct"
                ? "border-accent-green"
                : feedback === "wrong"
                  ? "border-accent-red"
                  : "border-transparent"
            }`}
          >
            <Chessboard
              options={{
                position: showAfterPosition ? puzzle.fenAfter : puzzle.fen,
                boardOrientation: puzzle.userColor,
                darkSquareStyle: { backgroundColor: "#4a3728" },
                lightSquareStyle: { backgroundColor: "#d4a96a" },
                allowDragging:
                  feedback !== "correct" &&
                  feedback !== "revealed" &&
                  !showAfterPosition,
                allowDrawingArrows: false,
                arrows: [
                  {
                    startSquare: puzzle.from,
                    endSquare: puzzle.to,
                    color: "rgba(239, 68, 68, 0.8)",
                  },
                ],
                onPieceDrop: handleDrop,
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setShowAfterPosition((current) => !current)}
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 text-foreground rounded-md transition-colors border border-border"
          >
            {showAfterPosition ? "Show Before Move" : "Show After Move"}
          </button>
        </div>
        {showAfterPosition && (
          <p className="text-xs text-muted">
            Solving is disabled in this view. Switch back to before move to play the puzzle.
          </p>
        )}

        {feedback === "correct" && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl px-4 py-3 text-accent-green text-sm text-center">
            <p className="font-semibold text-lg">Correct!</p>
            <p className="mt-1">That move holds the position together better than {puzzle.san}.</p>
          </div>
        )}

        {feedback === "wrong" && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm">
            <p className="font-semibold text-accent-red">Not quite — try again</p>
            <p className="mt-1 text-foreground/70">
              {attemptsForCurrent >= 2
                ? "You can reveal the solution, get a hint, or keep trying."
                : "Look for the move that reduces the danger immediately."}
            </p>
            {puzzle.concept && (
              <p className="mt-2 text-foreground/70">
                Target concept: {puzzle.concept}
              </p>
            )}
          </div>
        )}

        {feedback === "revealed" && (
          <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-xl px-4 py-3 text-sm text-foreground/80">
            <p className="font-semibold text-accent-blue">Solution</p>
            <p className="mt-1">
              Best move: <span className="font-mono text-accent-blue">{puzzle.bestMoveLabel}</span>
            </p>
            <p className="mt-1">
              Your move {puzzle.san} let the evaluation fall quickly. {puzzle.bestMoveLabel} is the
              practical repair.
            </p>
            <p className="mt-2 text-foreground/70">{getRevealExplanation(puzzle)}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            Attempts on this puzzle: {attemptsForCurrent + (feedback === "correct" ? 1 : 0)}
          </p>
          <div className="flex gap-2">
            {feedback !== "correct" && feedback !== "revealed" && hintLevel < 3 && (
              <button
                onClick={() => {
                  setHintLevel((h) => Math.min(h + 1, 3));
                }}
                className="px-3 py-2 text-xs bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue rounded-lg border border-accent-blue/25 transition-colors"
              >
                Get Hint
              </button>
            )}
            {feedback !== "correct" && feedback !== "revealed" && (
              <button
                onClick={() => setFeedback("revealed")}
                className="px-3 py-2 text-xs bg-surface-2 hover:bg-surface-3 text-foreground rounded-lg border border-border transition-colors"
              >
                Show Answer
              </button>
            )}
            {(feedback === "revealed" || feedback === "wrong" || feedback === "correct") && (
              <button
                onClick={moveToNextPuzzle}
                className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                  feedback === "correct"
                    ? "bg-primary hover:bg-primary-hover border-primary text-white"
                    : "bg-surface-2 hover:bg-surface-3 border-border text-foreground"
                }`}
              >
                {feedback === "correct" ? "Continue" : "Next puzzle"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
