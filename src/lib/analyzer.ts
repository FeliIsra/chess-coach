import { Chess } from "chess.js";
import { ChessGame, GameAnalysis, MoveAnalysis, PositionEval } from "./types";
import { evaluatePositionWithLocalStockfish } from "./local-stockfish";

const CHESS_API_URL = "https://chess-api.com/v1";

function readPositiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ENGINE_DEPTH = readPositiveIntEnv("CHESS_API_DEPTH", 10);
const CHESS_API_DEPTH_DEFAULT = ENGINE_DEPTH;
const CHESS_API_DEPTH_BULLET = readPositiveIntEnv(
  "CHESS_API_DEPTH_BULLET",
  Math.max(8, CHESS_API_DEPTH_DEFAULT - 1)
);
const CHESS_API_DEPTH_BLITZ = readPositiveIntEnv(
  "CHESS_API_DEPTH_BLITZ",
  CHESS_API_DEPTH_DEFAULT
);
const CHESS_API_DEPTH_RAPID = readPositiveIntEnv(
  "CHESS_API_DEPTH_RAPID",
  CHESS_API_DEPTH_DEFAULT + 1
);
const CHESS_API_DEPTH_DAILY = readPositiveIntEnv(
  "CHESS_API_DEPTH_DAILY",
  CHESS_API_DEPTH_DEFAULT + 2
);
const CHESS_API_TIMEOUT_MS = readPositiveIntEnv("CHESS_API_TIMEOUT_MS", 15000);
const EVAL_CACHE_TTL_MS = readPositiveIntEnv(
  "CHESS_EVAL_CACHE_TTL_MS",
  1000 * 60 * 30
);
const EVAL_CACHE_MAX_ENTRIES = readPositiveIntEnv(
  "CHESS_EVAL_CACHE_MAX_ENTRIES",
  8000
);
const CHESS_API_MAX_IN_FLIGHT = readPositiveIntEnv("CHESS_API_MAX_IN_FLIGHT", 4);

type EvalCacheEntry = {
  value: Promise<PositionEval>;
  createdAt: number;
};

const evalCache = new Map<string, EvalCacheEntry>();
const chessApiWaiters: Array<() => void> = [];
let chessApiInFlight = 0;
let lastPruneAt = 0;

async function withChessApiSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (chessApiInFlight >= CHESS_API_MAX_IN_FLIGHT) {
    await new Promise<void>((resolve) => chessApiWaiters.push(resolve));
  }

  chessApiInFlight += 1;
  try {
    return await fn();
  } finally {
    chessApiInFlight -= 1;
    const next = chessApiWaiters.shift();
    next?.();
  }
}

function pruneEvalCache(now: number): void {
  for (const [fen, entry] of evalCache.entries()) {
    if (now - entry.createdAt > EVAL_CACHE_TTL_MS) {
      evalCache.delete(fen);
    }
  }

  while (evalCache.size > EVAL_CACHE_MAX_ENTRIES) {
    const oldest = evalCache.keys().next().value;
    if (!oldest) break;
    evalCache.delete(oldest);
  }
}

function maybePruneEvalCache(now: number): void {
  if (
    evalCache.size <= EVAL_CACHE_MAX_ENTRIES &&
    now - lastPruneAt < 5000
  ) {
    return;
  }

  pruneEvalCache(now);
  lastPruneAt = now;
}

function getDepthForTimeClass(timeClass: string): number {
  if (timeClass === "bullet") return CHESS_API_DEPTH_BULLET;
  if (timeClass === "blitz") return CHESS_API_DEPTH_BLITZ;
  if (timeClass === "rapid") return CHESS_API_DEPTH_RAPID;
  if (timeClass === "daily") return CHESS_API_DEPTH_DAILY;
  return CHESS_API_DEPTH_DEFAULT;
}

function normalizeUci(move: string | undefined): string {
  return (move ?? "").trim().toLowerCase();
}

function toPlayedUci(move: {
  from: string;
  to: string;
  promotion?: string;
}): string {
  return normalizeUci(move.from + move.to + (move.promotion ?? ""));
}

async function evaluatePosition(fen: string, depth: number): Promise<PositionEval> {
  const cacheKey = `${depth}|${fen}`;
  const now = Date.now();
  const cached = evalCache.get(cacheKey);
  if (cached && now - cached.createdAt <= EVAL_CACHE_TTL_MS) {
    return cached.value;
  }

  const requestPromise = (async () => {
    const localResult = await evaluatePositionWithLocalStockfish(fen, depth);
    if (localResult) {
      return localResult;
    }

    return withChessApiSlot(async () => {
      const res = await fetch(CHESS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen, depth }),
        signal: AbortSignal.timeout(CHESS_API_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`chess-api.com error: ${res.status}`);
      }

      const data = await res.json();
      if (data?.type === "error") {
        throw new Error(data?.error || data?.text || "chess-api.com returned an error");
      }

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
        depth: data.depth || depth,
      };
    });
  })().catch((error: unknown) => {
    if (evalCache.get(cacheKey)?.value === requestPromise) {
      evalCache.delete(cacheKey);
    }
    throw error;
  });

  evalCache.set(cacheKey, { value: requestPromise, createdAt: now });
  maybePruneEvalCache(now);

  return requestPromise;
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
  const analysisDepth = getDepthForTimeClass(game.timeClass);

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
      const evalBefore = await evaluatePosition(move.before, analysisDepth);
      const playedUci = toPlayedUci(move);
      const bestUci = normalizeUci(evalBefore.bestMove);
      const shouldEvaluateAfter =
        bestUci.length < 4 || playedUci.slice(0, 4) !== bestUci.slice(0, 4);
      const evalAfter = shouldEvaluateAfter
        ? await evaluatePosition(move.after, analysisDepth)
        : evalBefore;

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
