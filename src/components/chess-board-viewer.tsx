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
      <div className="bg-surface-2 rounded-lg p-4 text-center text-muted text-sm">
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
      {/* Classification badge + eval */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`${classColor[move.classification]} text-white text-xs font-bold px-2 py-0.5 rounded`}
          >
            {classLabel[move.classification]}
          </span>
          <span className="text-sm text-foreground font-mono">
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

      {/* Board */}
      <div className="rounded-lg overflow-hidden">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: userColor,
            darkSquareStyle: { backgroundColor: "#4a3728" },
            lightSquareStyle: { backgroundColor: "#d4a96a" },
            squareStyles,
            arrows,
            allowDragging: false,
            allowDrawingArrows: false,
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setCurrentIdx(Math.max(0, currentIdx - 1));
              setShowAfter(false);
            }}
            disabled={currentIdx === 0}
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-foreground rounded-md transition-colors border border-border"
          >
            Prev
          </button>
          <button
            onClick={() => {
              setCurrentIdx(Math.min(keyMoves.length - 1, currentIdx + 1));
              setShowAfter(false);
            }}
            disabled={currentIdx === keyMoves.length - 1}
            className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-foreground rounded-md transition-colors border border-border"
          >
            Next
          </button>
        </div>

        {/* Before/After toggle */}
        <button
          onClick={() => setShowAfter(!showAfter)}
          className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 text-foreground rounded-md transition-colors border border-border"
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
