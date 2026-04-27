import { describe, expect, it } from "vitest";
import {
  formatSessionDate,
  getHistorySummary,
  getRecentSessions,
  getTrend,
} from "@/lib/history";
import { AnalysisSession } from "@/lib/types";

function makeSession(overrides: Partial<AnalysisSession> = {}): AnalysisSession {
  return {
    date: "2025-01-01T00:00:00.000Z",
    username: "hikaru",
    gamesCount: 5,
    totalBlunders: 10,
    totalMistakes: 6,
    averageAccuracy: 82,
    avgBlundersPerGame: 2,
    ...overrides,
  };
}

describe("history helpers", () => {
  it("summarizes sessions with totals and recent entries", () => {
    const sessions = [
      makeSession({ date: "2025-01-01T00:00:00.000Z", gamesCount: 3, totalBlunders: 6, averageAccuracy: 76, avgBlundersPerGame: 2 }),
      makeSession({ date: "2025-01-02T00:00:00.000Z", username: "carlsen", gamesCount: 4, totalBlunders: 4, averageAccuracy: 84, avgBlundersPerGame: 1 }),
      makeSession({ date: "2025-01-03T00:00:00.000Z", username: "hikaru", gamesCount: 2, totalBlunders: 1, averageAccuracy: 88, avgBlundersPerGame: 0.5 }),
    ];

    const summary = getHistorySummary(sessions);

    expect(summary.totalSessions).toBe(3);
    expect(summary.totalGames).toBe(9);
    expect(summary.totalBlunders).toBe(11);
    expect(summary.averageBlundersPerGame).toBeCloseTo(11 / 9, 5);
    expect(summary.averageAccuracy).toBeCloseTo((76 + 84 + 88) / 3, 5);
    expect(summary.latestSession?.username).toBe("hikaru");
    expect(summary.recentSessions).toHaveLength(3);
  });

  it("returns the trailing subset for recent sessions", () => {
    const sessions = [
      makeSession({ date: "2025-01-01T00:00:00.000Z" }),
      makeSession({ date: "2025-01-02T00:00:00.000Z" }),
      makeSession({ date: "2025-01-03T00:00:00.000Z" }),
      makeSession({ date: "2025-01-04T00:00:00.000Z" }),
      makeSession({ date: "2025-01-05T00:00:00.000Z" }),
    ];

    expect(getRecentSessions(sessions, 2)).toEqual(sessions.slice(3));
    expect(getRecentSessions(sessions, 0)).toEqual([]);
  });

  it("formats the trend and date helpers defensively", () => {
    expect(
      getTrend([
        makeSession({ avgBlundersPerGame: 4 }),
        makeSession({ avgBlundersPerGame: 3.2 }),
        makeSession({ avgBlundersPerGame: 2.8 }),
        makeSession({ avgBlundersPerGame: 2.1 }),
      ]),
    ).toBe("improving");

    expect(formatSessionDate("2025-01-03T00:00:00.000Z")).toContain("2025");
    expect(formatSessionDate("not-a-date")).toBe("Unknown date");
  });
});
