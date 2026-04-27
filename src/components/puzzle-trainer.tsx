"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { LLMInsight, MoveAnalysis, TacticalCategory } from "@/lib/types";
import { formatBestMoveLabel } from "@/lib/chess-format";
import {
  applyPuzzleAttempt,
  createPuzzleSessionStats,
  getFirstTryRatePercent,
} from "@/lib/puzzle-metrics";
import {
  describeEvalLoss,
  formatEvalLossPawns,
  playPuzzleCue,
} from "@/lib/puzzle-feedback";

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

type AttemptTrace = {
  from: Square;
  to: Square;
  correct: boolean;
};

function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

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

export function humanizeEval(centipawns: number): string {
  return describeEvalLoss(centipawns);
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
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [lastAttempt, setLastAttempt] = useState<AttemptTrace | null>(null);

  const puzzle = puzzles[currentIndex];
  const isFinished = currentIndex >= puzzles.length;
  const bestMoveFrom = puzzle?.bestMove.slice(0, 2) ?? "";
  const bestMoveTo = puzzle?.bestMove.slice(2, 4) ?? "";
  const puzzleSide = puzzle?.userColor === "white" ? "w" : "b";

  const boardSquareStyles = useMemo(() => {
    if (!puzzle) return {};

    const styles: Record<string, CSSProperties> = {};

    if (!feedback && !showAfterPosition) {
      styles[puzzle.from] = {
        backgroundColor: "rgba(251, 191, 36, 0.16)",
        boxShadow: "inset 0 0 0 3px rgba(251, 191, 36, 0.65)",
        animation: "puzzle-square-pulse 1.8s ease-in-out infinite",
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(96, 165, 250, 0.18)",
        boxShadow: "inset 0 0 0 3px rgba(96, 165, 250, 0.85)",
      };
    }

    if (feedback === "wrong" && lastAttempt) {
      styles[lastAttempt.from] = {
        backgroundColor: "rgba(248, 113, 113, 0.16)",
        boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.82)",
      };
      styles[lastAttempt.to] = {
        backgroundColor: "rgba(248, 113, 113, 0.16)",
        boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.82)",
      };
    }

    if (feedback === "revealed" || showAfterPosition) {
      styles[bestMoveFrom] = {
        backgroundColor: "rgba(74, 222, 128, 0.16)",
        boxShadow: "inset 0 0 0 3px rgba(74, 222, 128, 0.82)",
      };
      styles[bestMoveTo] = {
        backgroundColor: "rgba(74, 222, 128, 0.16)",
        boxShadow: "inset 0 0 0 3px rgba(74, 222, 128, 0.82)",
      };
    }

    return styles;
  }, [
    bestMoveFrom,
    bestMoveTo,
    feedback,
    lastAttempt,
    puzzle,
    selectedSquare,
    showAfterPosition,
  ]);

  const boardArrows = useMemo(() => {
    if (!puzzle) return [];

    if (feedback === "revealed" || showAfterPosition) {
      return [
        {
          startSquare: bestMoveFrom,
          endSquare: bestMoveTo,
          color: "rgba(74, 222, 128, 0.82)",
        },
      ];
    }

    if (lastAttempt) {
      return [
        {
          startSquare: lastAttempt.from,
          endSquare: lastAttempt.to,
          color: lastAttempt.correct
            ? "rgba(74, 222, 128, 0.82)"
            : "rgba(248, 113, 113, 0.82)",
        },
      ];
    }

    return [];
  }, [bestMoveFrom, bestMoveTo, feedback, lastAttempt, puzzle, showAfterPosition]);

  const resetPuzzleState = useCallback(() => {
    setFeedback(null);
    setAttemptsForCurrent(0);
    setHintLevel(0);
    setShowAfterPosition(false);
    setSelectedSquare(null);
    setLastAttempt(null);
  }, []);

  const moveToNextPuzzle = useCallback(() => {
    resetPuzzleState();
    setCurrentIndex((i) => i + 1);
  }, [resetPuzzleState]);

  useEffect(() => {
    if (feedback !== "correct") return;

    const timer = window.setTimeout(() => {
      moveToNextPuzzle();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [feedback, moveToNextPuzzle]);

  const attemptMove = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      if (
        !puzzle ||
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
      setLastAttempt({ from: sourceSquare, to: targetSquare, correct: isCorrect });
      setSelectedSquare(null);

      if (isCorrect) {
        setFeedback("correct");
        playPuzzleCue("correct");
      } else {
        setFeedback("wrong");
        setAttemptsForCurrent((current) => current + 1);
        playPuzzleCue("wrong");
      }

      return true;
    },
    [attemptsForCurrent, feedback, puzzle, showAfterPosition]
  );

  const handleDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: unknown;
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare || !isSquare(sourceSquare) || !isSquare(targetSquare)) {
        return false;
      }
      return attemptMove(sourceSquare, targetSquare);
    },
    [attemptMove]
  );

  const handlePieceDrag = useCallback(
    ({ square }: { square?: string | null }) => {
      if (
        !puzzle ||
        feedback === "correct" ||
        feedback === "revealed" ||
        showAfterPosition ||
        !square ||
        !isSquare(square)
      ) {
        return;
      }

      setSelectedSquare(square);
      playPuzzleCue("pickup");
    },
    [feedback, puzzle, showAfterPosition]
  );

  const handleSquareClick = useCallback(
    ({ square }: { square?: string | null }) => {
      if (
        !puzzle ||
        feedback === "correct" ||
        feedback === "revealed" ||
        showAfterPosition ||
        !square ||
        !isSquare(square)
      ) {
        return;
      }

      if (!selectedSquare) {
        const chess = new Chess(puzzle.fen);
        const clickedPiece = chess.get(square);
        if (clickedPiece?.color === puzzleSide) {
          setSelectedSquare(square);
          playPuzzleCue("pickup");
        }
        return;
      }

      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      const attempted = attemptMove(selectedSquare, square);
      if (!attempted) {
        const chess = new Chess(puzzle.fen);
        const clickedPiece = chess.get(square);
        if (clickedPiece?.color === puzzleSide) {
          setSelectedSquare(square);
          playPuzzleCue("pickup");
        }
      }
    },
    [attemptMove, feedback, puzzle, puzzleSide, selectedSquare, showAfterPosition]
  );

  if (isFinished) {
    return (
      <div className="surface-frame rounded-[28px] p-6 text-center space-y-5">
        <div className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          Practice complete
        </div>
        <h3 className="text-xl font-semibold text-foreground">You finished the puzzle set</h3>
        <p className="text-4xl font-semibold text-primary">
          {stats.solved}/{puzzles.length}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface-2 px-3 py-2">
            <p className="text-base font-semibold text-foreground">{stats.solvedFirstTry}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">First try</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 px-3 py-2">
            <p className="text-base font-semibold text-foreground">{stats.attemptedPuzzles}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Attempted</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 px-3 py-2">
            <p className="text-base font-semibold text-foreground">{stats.attempts}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Move tries</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 px-3 py-2">
            <p className="text-base font-semibold text-foreground">
              {getFirstTryRatePercent(stats.solvedFirstTry, stats.attemptedPuzzles)}%
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">First-try rate</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl bg-primary px-6 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Back to Results
        </button>
      </div>
    );
  }

  if (!puzzle) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Practice mode</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Practice Your Mistakes</h3>
        </div>
        <button onClick={onClose} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground">
          Close
        </button>
      </div>

      <div className="surface-frame rounded-[28px] p-4 space-y-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-muted">
            Puzzle {currentIndex + 1} of {puzzles.length}
          </span>
          <div className="text-right">
            <p className="font-semibold text-foreground">{stats.solved} solved</p>
            <p className="text-xs text-muted">
              {stats.attemptedPuzzles} attempted ·
              {" "}
              {getFirstTryRatePercent(stats.solvedFirstTry, stats.attemptedPuzzles)}%
              {" "}first try
            </p>
          </div>
        </div>

        <p className="rounded-2xl border border-border/80 bg-surface-2 px-4 py-3 text-sm leading-6 text-foreground/80">
          You played <span className="font-mono text-accent-red">{puzzle.san}</span> (
          {puzzle.classification}) on move {puzzle.moveNumber}. Drag or tap the glowing piece
          to avoid giving away {describeEvalLoss(puzzle.evalLoss)} (
          {formatEvalLossPawns(puzzle.evalLoss)}).
        </p>

        <div className="rounded-2xl border border-border/80 bg-surface-2 px-3 py-2.5 text-xs leading-5 text-foreground/75">
          {selectedSquare
            ? `Selected ${selectedSquare.toUpperCase()}. Tap the landing square or drag a different piece.`
            : "Start by dragging or tapping the highlighted piece, then choose its destination square."}
        </div>

        {(puzzle.category || puzzle.concept) && hintLevel === 0 && (
          <div className="flex flex-wrap gap-2">
            {puzzle.category && (
              <span className="rounded-full border border-accent-blue/20 bg-accent-blue/15 px-2 py-1 text-xs capitalize text-accent-blue">
                Theme: {puzzle.category}
              </span>
            )}
            {puzzle.concept && (
              <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-foreground/70">
                {puzzle.concept}
              </span>
            )}
          </div>
        )}

        {hintLevel >= 1 && hintLevel <= 3 && feedback !== "revealed" && (
          <div className="rounded-2xl border border-accent-blue/25 bg-accent-blue/10 px-4 py-3 text-sm space-y-1">
            <p className="font-semibold text-accent-blue">
              Hint {hintLevel} of 3
            </p>
            {hintLevel >= 1 && (
              <p className="text-foreground/80">
                {puzzle.concept
                  ? `Think about ${puzzle.concept}.`
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
            className={`puzzle-board-shell board-frame overflow-hidden rounded-2xl border-2 bg-surface-2 p-2 transition-colors duration-300 ${
              feedback === "correct"
                ? "puzzle-board-shell--correct border-accent-green"
                : feedback === "wrong"
                  ? "puzzle-board-shell--wrong border-accent-red"
                  : feedback === "revealed"
                    ? "puzzle-board-shell--revealed border-accent-blue"
                    : "border-transparent"
            }`}
          >
            <Chessboard
              options={{
                position: showAfterPosition ? puzzle.fenAfter : puzzle.fen,
                boardOrientation: puzzle.userColor,
                darkSquareStyle: { backgroundColor: "var(--board-dark)" },
                lightSquareStyle: { backgroundColor: "var(--board-light)" },
                allowDragging:
                  feedback !== "correct" &&
                  feedback !== "revealed" &&
                  !showAfterPosition,
                allowDrawingArrows: false,
                squareStyles: boardSquareStyles,
                arrows: boardArrows,
                onPieceDrop: handleDrop,
                onPieceDrag: handlePieceDrag,
                onSquareClick: handleSquareClick,
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => {
              const next = !showAfterPosition;
              if (next) {
                setSelectedSquare(null);
                setLastAttempt(null);
                playPuzzleCue("reveal");
              }
              setShowAfterPosition(next);
            }}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3"
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
          <div className="rounded-2xl border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-center text-sm text-accent-green puzzle-board-shell--correct">
            <p className="text-lg font-semibold">Correct!</p>
            <p className="mt-1">
              That move keeps the position under control better than {puzzle.san}.
            </p>
          </div>
        )}

        {feedback === "wrong" && (
          <div className="rounded-2xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm puzzle-board-shell--wrong">
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
          <div className="rounded-2xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3 text-sm text-foreground/80 puzzle-board-shell--revealed">
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
                className="rounded-lg border border-accent-blue/25 bg-accent-blue/10 px-3 py-2 text-xs text-accent-blue transition-colors hover:bg-accent-blue/20"
              >
                Get Hint
              </button>
            )}
            {feedback !== "correct" && feedback !== "revealed" && (
              <button
                onClick={() => {
                  setFeedback("revealed");
                  setLastAttempt(null);
                  playPuzzleCue("reveal");
                }}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-3"
              >
                Show Answer
              </button>
            )}
            {(feedback === "revealed" || feedback === "wrong" || feedback === "correct") && (
              <button
                onClick={moveToNextPuzzle}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
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
