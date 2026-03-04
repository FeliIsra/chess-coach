import { AnalysisSession, FullAnalysisResult } from "@/lib/types";

export function buildAnalysisSession(
  username: string,
  result: FullAnalysisResult
): AnalysisSession {
  return {
    date: new Date().toISOString(),
    username,
    gamesCount: result.games.length,
    totalBlunders: result.overallSummary.totalBlunders,
    totalMistakes: result.overallSummary.totalMistakes,
    averageAccuracy: result.overallSummary.averageAccuracy,
    avgBlundersPerGame:
      result.games.length > 0
        ? result.overallSummary.totalBlunders / result.games.length
        : 0,
  };
}
