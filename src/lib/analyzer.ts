import { Chess } from "chess.js";
import { ChessGame, GameAnalysis, MoveAnalysis, PositionEval } from "./types";

const CHESS_API_URL = "https://chess-api.com/v1";

export const ENGINE_DEPTH = 12;

async function evaluatePosition(fen: string): Promise<PositionEval> {
  const res = await fetch(CHESS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen, depth: ENGINE_DEPTH }),
  });

  if (!res.ok) {
    throw new Error(`chess-api.com error: ${res.status}`);
  }

  const data = await res.json();

  let evalCp: number;
  if (data.mate !== undefined && data.mate !== null) {
    evalCp = data.mate > 0 ? 10000 : -10000;
  } else {
    evalCp = Math.round((data.eval ?? 0) * 100);
  }

  return {
    fen,
    eval: evalCp,
    bestMove: data.move || "",
    depth: data.depth || 12,
  };
}

function classifyMove(
  evalDiff: number
): MoveAnalysis["classification"] {
  const loss = Math.abs(evalDiff);
  if (evalDiff > 50) return "brilliant";
  if (evalDiff > 20) return "great";
  if (loss <= 20) return "good";
  if (loss <= 50) return "inaccuracy";
  if (loss <= 150) return "mistake";
  return "blunder";
}

function userPerspective(evalCp: number, userColor: "white" | "black"): number {
  return userColor === "white" ? evalCp : -evalCp;
}

function parseClockTimes(pgn: string): Map<number, number> {
  // Parse {[%clk H:MM:SS]} timestamps from PGN
  // Returns map of half-move index -> remaining seconds
  const clockMap = new Map<number, number>();
  // Remove headers
  const moveSection = pgn.replace(/\[.*?\]\s*/g, "").trim();
  let halfMoveIndex = 0;

  // Count moves between clock annotations to track half-move index
  const tokens = moveSection.split(/(\{\[%clk [^\]]+\]\})/);
  for (const token of tokens) {
    const clockMatch = token.match(/\{\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]\}/);
    if (clockMatch) {
      const hours = parseInt(clockMatch[1]);
      const minutes = parseInt(clockMatch[2]);
      const seconds = parseFloat(clockMatch[3]);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      clockMap.set(halfMoveIndex - 1, totalSeconds);
    } else {
      // Count move numbers and moves in this token
      const moves = token.match(/[a-zA-Z][a-zA-Z0-9+#=\-]+/g);
      if (moves) {
        halfMoveIndex += moves.length;
      }
    }
  }
  return clockMap;
}

function isRecapture(
  history: { captured?: string; to: string }[],
  index: number
): boolean {
  if (index < 1) return false;
  const currentMove = history[index];
  const previousMove = history[index - 1];
  // Both moves capture and land on the same square
  return !!(currentMove.captured && previousMove.captured && currentMove.to === previousMove.to);
}

export async function analyzeGame(
  game: ChessGame,
  onProgress?: (moveIndex: number, totalMoves: number) => void
): Promise<GameAnalysis> {
  const chess = new Chess();
  chess.loadPgn(game.pgn);

  const history = chess.history({ verbose: true });
  const clockTimes = parseClockTimes(game.pgn);
  const userMoves: { move: (typeof history)[0]; index: number }[] = [];

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    const isUserMove =
      (game.userColor === "white" && move.color === "w") ||
      (game.userColor === "black" && move.color === "b");
    if (isUserMove) {
      userMoves.push({ move, index: i });
    }
  }

  const moveAnalyses: MoveAnalysis[] = [];
  let lastKnownEval = 0; // centipawns from white's perspective

  for (let i = 0; i < userMoves.length; i++) {
    const { move, index } = userMoves[i];
    onProgress?.(i + 1, userMoves.length);

    const clockSecs = clockTimes.get(index);

    // Skip book moves: first 5 full moves (index < 10 in history)
    if (index < 10) {
      const userEval = userPerspective(lastKnownEval, game.userColor);
      moveAnalyses.push({
        moveNumber: Math.floor(index / 2) + 1,
        san: move.san,
        userColor: game.userColor,
        evalBefore: userEval,
        evalAfter: userEval,
        evalDiff: 0,
        bestMove: move.san,
        classification: "good",
        fen: move.before,
        from: move.from,
        to: move.to,
        fenAfter: move.after,
        clockSeconds: clockSecs,
      });
      continue;
    }

    // Skip forced recaptures when position is balanced
    if (isRecapture(history, index) && Math.abs(lastKnownEval) < 100) {
      const userEval = userPerspective(lastKnownEval, game.userColor);
      moveAnalyses.push({
        moveNumber: Math.floor(index / 2) + 1,
        san: move.san,
        userColor: game.userColor,
        evalBefore: userEval,
        evalAfter: userEval,
        evalDiff: 0,
        bestMove: move.san,
        classification: "good",
        fen: move.before,
        from: move.from,
        to: move.to,
        fenAfter: move.after,
        clockSeconds: clockSecs,
      });
      continue;
    }

    try {
      const evalBefore = await evaluatePosition(move.before);
      const evalAfter = await evaluatePosition(move.after);

      lastKnownEval = evalAfter.eval;

      const userEvalBefore = userPerspective(evalBefore.eval, game.userColor);
      const userEvalAfter = userPerspective(evalAfter.eval, game.userColor);
      const evalDiff = userEvalAfter - userEvalBefore;

      moveAnalyses.push({
        moveNumber: Math.floor(index / 2) + 1,
        san: move.san,
        userColor: game.userColor,
        evalBefore: userEvalBefore,
        evalAfter: userEvalAfter,
        evalDiff,
        bestMove: evalBefore.bestMove,
        classification: classifyMove(evalDiff),
        fen: move.before,
        from: move.from,
        to: move.to,
        fenAfter: move.after,
        clockSeconds: clockSecs,
      });

      // Only sleep after actual API calls
      await sleep(100);
    } catch {
      continue;
    }
  }

  const sorted = [...moveAnalyses].sort((a, b) => a.evalDiff - b.evalDiff);
  const worstMoves = sorted.slice(0, 10);
  const bestMoves = sorted.slice(-10).reverse();

  return {
    game,
    moves: moveAnalyses,
    bestMoves,
    worstMoves,
    blunders: moveAnalyses.filter((m) => m.classification === "blunder").length,
    mistakes: moveAnalyses.filter((m) => m.classification === "mistake").length,
    inaccuracies: moveAnalyses.filter((m) => m.classification === "inaccuracy").length,
    averageEvalLoss:
      moveAnalyses.length > 0
        ? moveAnalyses.reduce(
            (sum, m) => sum + Math.max(0, -m.evalDiff),
            0
          ) / moveAnalyses.length
        : 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
