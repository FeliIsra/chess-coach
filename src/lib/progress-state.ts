import { AnalysisProgress } from "@/lib/types";

export type ProgressPhase = "fetching" | "stockfish" | "llm" | "overall" | "done";

export interface ProgressState {
  currentPhase: ProgressPhase;
  gamesCompleted: number;
  totalGames: number;
  activeGamesCount: number;
  message: string;
  lastCompletedMessage: string;
  latestSequence: number;
  activeGameIndex: number | null;
  phaseProgressPercent: number;
}

export type ProgressAction =
  | { type: "reset" }
  | { type: "set_fetching"; message: string }
  | { type: "start_stockfish"; totalGames: number }
  | { type: "apply_update"; update: AnalysisProgress }
  | { type: "done" };

export const initialProgressState: ProgressState = {
  currentPhase: "fetching",
  gamesCompleted: 0,
  totalGames: 0,
  activeGamesCount: 0,
  message: "",
  lastCompletedMessage: "",
  latestSequence: 0,
  activeGameIndex: null,
  phaseProgressPercent: 0,
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildStockfishMessage(
  gamesCompleted: number,
  totalGames: number,
  activeGamesCount: number
): string {
  if (totalGames <= 0) {
    return "Engine analyzing your games...";
  }

  const activePart =
    activeGamesCount > 0
      ? ` ${activeGamesCount} game${activeGamesCount === 1 ? "" : "s"} in flight.`
      : "";
  return `Engine analyzing your games. Completed ${gamesCompleted} of ${totalGames}.${activePart}`;
}

function buildLlmMessage(
  gamesCompleted: number,
  totalGames: number,
  activeGamesCount: number
): string {
  if (totalGames <= 0) {
    return "AI coach reviewing your games...";
  }

  const activePart =
    activeGamesCount > 0
      ? ` ${activeGamesCount} review${activeGamesCount === 1 ? "" : "s"} in flight.`
      : "";
  return `AI coach reviewing patterns. Completed ${gamesCompleted} of ${totalGames}.${activePart}`;
}

function resolveSequence(state: ProgressState, update: AnalysisProgress): number {
  if (update.sequence !== undefined) return update.sequence;
  return state.latestSequence + 1;
}

function resolvePhase(
  currentPhase: ProgressPhase,
  updatePhase?: AnalysisProgress["phase"]
): ProgressPhase {
  if (!updatePhase) return currentPhase;
  return updatePhase;
}

export function progressReducer(
  state: ProgressState,
  action: ProgressAction
): ProgressState {
  if (action.type === "reset") {
    return { ...initialProgressState };
  }

  if (action.type === "set_fetching") {
    return {
      ...initialProgressState,
      message: action.message,
    };
  }

  if (action.type === "start_stockfish") {
    return {
      ...state,
      currentPhase: "stockfish",
      totalGames: action.totalGames,
      gamesCompleted: 0,
      activeGamesCount: 0,
      activeGameIndex: null,
      phaseProgressPercent: 0,
      message: `Starting engine analysis of ${action.totalGames} games...`,
      lastCompletedMessage: "",
    };
  }

  if (action.type === "done") {
    return {
      ...state,
      currentPhase: "done",
      gamesCompleted: state.totalGames,
      activeGamesCount: 0,
      phaseProgressPercent: 100,
      activeGameIndex: null,
      message: "Analysis complete.",
    };
  }

  const update = action.update;
  const sequence = resolveSequence(state, update);
  if (sequence < state.latestSequence) {
    return state;
  }

  const currentPhase = resolvePhase(state.currentPhase, update.phase);
  const totalGames = update.totalGames ?? state.totalGames;
  const gamesCompleted = update.gamesCompleted ?? state.gamesCompleted;
  const activeGamesCount =
    currentPhase === "stockfish" || currentPhase === "llm"
      ? update.activeGamesCount ?? state.activeGamesCount
      : 0;

  let activeGameIndex = state.activeGameIndex;
  if (currentPhase === "stockfish") {
    if (activeGamesCount > 1) {
      activeGameIndex = null;
    } else if (update.activeGameIndex !== undefined) {
      activeGameIndex = update.activeGameIndex;
    } else if (update.gameIndex !== undefined) {
      activeGameIndex = update.gameIndex;
    }
  } else {
    activeGameIndex = null;
  }

  let phaseProgressPercent = state.phaseProgressPercent;
  if (update.phaseProgressPercent !== undefined) {
    phaseProgressPercent = clampPercent(update.phaseProgressPercent);
  } else if (totalGames > 0) {
    phaseProgressPercent = clampPercent((gamesCompleted / totalGames) * 100);
  }

  let lastCompletedMessage = state.lastCompletedMessage;
  if (update.type === "game_complete") {
    lastCompletedMessage = update.message;
    activeGameIndex = null;
  }

  let message = state.message;
  if (currentPhase === "stockfish") {
    message = buildStockfishMessage(
      gamesCompleted,
      totalGames,
      activeGamesCount
    );
  } else if (currentPhase === "llm") {
    message = buildLlmMessage(gamesCompleted, totalGames, activeGamesCount);
  } else if (currentPhase === "overall") {
    message = "Building your study plan...";
    phaseProgressPercent = 100;
  }

  return {
    ...state,
    currentPhase,
    totalGames,
    gamesCompleted,
    activeGamesCount,
    activeGameIndex,
    phaseProgressPercent,
    latestSequence: sequence,
    message,
    lastCompletedMessage,
  };
}
