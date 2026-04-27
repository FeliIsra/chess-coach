"use client";

import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { MoveAnalysis } from "@/lib/types";
import { formatBestMoveLabel } from "@/lib/chess-format";

interface ChessBoardViewerProps {
  moves: MoveAnalysis[];
  userColor: "white" | "black";
}

export default function ChessBoardViewer({ moves, userColor }: ChessBoardViewerProps) {
  const keyMoves = useMemo(() => {
    return moves.filter(
      (m) => m.classification === "blunder" || m.classification === "mistake" || m.classification === "brilliant" || m.classification === "great"
    );
  }, [moves]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAfter, setShowAfter] = useState(false);

  if (keyMoves.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2 px-4 py-5 text-center text-sm text-muted">
        No key moves to display
      </div>
    );
  }

  const move = keyMoves[currentIdx];
  const fen = showAfter ? move.fenAfter : move.fen;

  // Parse best move from UCI string (e.g., "e2e4" → from: "e2", to: "e4")
  const bestMoveFrom = move.bestMove?.slice(0, 2);
  const bestMoveTo = move.bestMove?.slice(2, 4);

  const classColor: Record<string, string> = {
    blunder: "bg-accent-red",
    mistake: "bg-accent-amber",
    brilliant: "bg-accent-green",
    great: "bg-accent-green",
  };

  const classLabel: Record<string, string> = {
    blunder: "Blunder",
    mistake: "Mistake",
    brilliant: "Brilliant",
    great: "Great Move",
  };

  // Custom square styles: highlight from/to of played move
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (!showAfter) {
    squareStyles[move.from] = {
      backgroundColor: "rgba(251, 191, 36, 0.4)",
    };
    squareStyles[move.to] = {
      backgroundColor: "rgba(251, 191, 36, 0.4)",
    };
  }

  // Arrow for best move (green)
  const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
  if (!showAfter && bestMoveFrom && bestMoveTo && bestMoveFrom !== move.from + move.to) {
    arrows.push({ startSquare: bestMoveFrom, endSquare: bestMoveTo, color: "rgba(74, 222, 128, 0.8)" });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`${classColor[move.classification]} inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white`}
          >
            {classLabel[move.classification]}
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            Move {move.moveNumber}. {move.san}
          </span>
        </div>
        <span
          className={`text-xs font-mono ${
            move.evalDiff >= 0 ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {move.evalDiff >= 0 ? "+" : ""}
          {(move.evalDiff / 100).toFixed(1)}
        </span>
      </div>

      <div className="board-frame overflow-hidden rounded-2xl border border-border">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: userColor,
            darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            lightSquareStyle: { backgroundColor: "var(--board-light)" },
            squareStyles,
            arrows,
            allowDragging: false,
            allowDrawingArrows: false,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setCurrentIdx(Math.max(0, currentIdx - 1));
              setShowAfter(false);
            }}
            disabled={currentIdx === 0}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3 disabled:opacity-30"
          >
            Prev
          </button>
          <button
            onClick={() => {
              setCurrentIdx(Math.min(keyMoves.length - 1, currentIdx + 1));
              setShowAfter(false);
            }}
            disabled={currentIdx === keyMoves.length - 1}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3 disabled:opacity-30"
          >
            Next
          </button>
        </div>

        <button
          onClick={() => setShowAfter(!showAfter)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-3"
        >
          {showAfter ? "Before Move" : "After Move"}
        </button>

        <span className="text-xs text-muted">
          {currentIdx + 1}/{keyMoves.length}
        </span>
      </div>

      {/* Best move hint */}
      {!showAfter && move.bestMove && move.bestMove !== move.san && (
        <p className="text-xs text-muted">
          Best move:{" "}
          <span className="text-accent-green font-mono">
            {formatBestMoveLabel(move.fen, move.bestMove)}
          </span>
        </p>
      )}
    </div>
  );
}
