import { describe, expect, it } from "vitest";
import {
  initialProgressState,
  progressReducer,
  ProgressState,
} from "@/lib/progress-state";
import { AnalysisProgress } from "@/lib/types";

function applyUpdate(state: ProgressState, update: AnalysisProgress): ProgressState {
  return progressReducer(state, { type: "apply_update", update });
}

describe("progressReducer", () => {
  it("keeps the newest stream event and ignores stale sequence numbers", () => {
    let state = progressReducer(initialProgressState, {
      type: "start_stockfish",
      totalGames: 5,
    });

    state = applyUpdate(state, {
      type: "progress",
      sequence: 2,
      phase: "stockfish",
      gameIndex: 2,
      activeGameIndex: 2,
      gamesCompleted: 1,
      totalGames: 5,
      moveIndex: 10,
      totalMoves: 30,
      message: "newest",
    });

    const newestState = state;

    state = applyUpdate(state, {
      type: "progress",
      sequence: 1,
      phase: "stockfish",
      gameIndex: 0,
      activeGameIndex: 0,
      gamesCompleted: 0,
      totalGames: 5,
      moveIndex: 1,
      totalMoves: 30,
      message: "stale",
    });

    expect(state).toEqual(newestState);
    expect(state.message).toContain("Active game 3 of 5");
  });

  it("derives consistent percent from completed games when percent is not provided", () => {
    let state = progressReducer(initialProgressState, {
      type: "start_stockfish",
      totalGames: 4,
    });

    state = applyUpdate(state, {
      type: "progress",
      sequence: 1,
      phase: "stockfish",
      gamesCompleted: 2,
      totalGames: 4,
      message: "progress",
    });

    expect(state.phaseProgressPercent).toBe(50);
    expect(state.gamesCompleted).toBe(2);
    expect(state.totalGames).toBe(4);
  });

  it("shows llm progress using the same completed/total source of truth", () => {
    let state = progressReducer(initialProgressState, {
      type: "start_stockfish",
      totalGames: 3,
    });

    state = applyUpdate(state, {
      type: "llm_analysis",
      sequence: 3,
      phase: "llm",
      gamesCompleted: 2,
      totalGames: 3,
      message: "llm",
    });

    expect(state.currentPhase).toBe("llm");
    expect(state.message).toContain("Completed 2 of 3");
    expect(state.phaseProgressPercent).toBe(67);
  });
});
