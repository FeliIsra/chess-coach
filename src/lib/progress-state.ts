import { AnalysisProgress } from "@/lib/types";

export type ProgressPhase = "fetching" | "stockfish" | "llm" | "overall" | "done";

export interface ProgressState {
  currentPhase: ProgressPhase;
  gamesCompleted: number;
  totalGames: number;
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
  activeGameIndex: number | null,
  moveIndex?: number,
  totalMoves?: number
): string {
  if (totalGames <= 0) {
    return "Engine analyzing your games...";
  }

  const completedPart = `Completed ${gamesCompleted} of ${totalGames}.`;
  if (activeGameIndex === null) {
    return `Engine analyzing your games. ${completedPart}`;
  }

  const movePart =
    moveIndex && totalMoves ? ` Move ${moveIndex}/${totalMoves}.` : "";
  return `Engine analyzing your games. ${completedPart} Active game ${activeGameIndex + 1} of ${totalGames}.${movePart}`;
}

function buildLlmMessage(gamesCompleted: number, totalGames: number): string {
  if (totalGames <= 0) {
    return "AI coach reviewing your games...";
  }
  return `AI coach reviewing patterns. Completed ${gamesCompleted} of ${totalGames}.`;
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

  let activeGameIndex = state.activeGameIndex;
  if (currentPhase === "stockfish") {
    if (update.activeGameIndex !== undefined) {
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
      activeGameIndex,
      update.moveIndex,
      update.totalMoves
    );
  } else if (currentPhase === "llm") {
    message = buildLlmMessage(gamesCompleted, totalGames);
  } else if (currentPhase === "overall") {
    message = "Building your study plan...";
    phaseProgressPercent = 100;
  }

  return {
    ...state,
    currentPhase,
    totalGames,
    gamesCompleted,
    activeGameIndex,
    phaseProgressPercent,
    latestSequence: sequence,
    message,
    lastCompletedMessage,
  };
}
