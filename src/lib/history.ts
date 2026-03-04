import { AnalysisSession, FullAnalysisResult } from "./types";

const STORAGE_KEY = "chess-coach-history";

export function saveSession(
  username: string,
  result: FullAnalysisResult
): void {
  const session: AnalysisSession = {
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

  const history = loadHistory();
  history.push(session);
  // Keep last 50 sessions
  if (history.length > 50) history.splice(0, history.length - 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function loadHistory(): AnalysisSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalysisSession[];
  } catch {
    return [];
  }
}

export function getTrend(
  sessions: AnalysisSession[]
): "improving" | "declining" | "stable" {
  if (sessions.length < 2) return "stable";

  const recent = sessions.slice(-5);
  const blunderRates = recent.map((s) => s.avgBlundersPerGame);

  if (blunderRates.length < 2) return "stable";

  const firstHalf = blunderRates.slice(0, Math.ceil(blunderRates.length / 2));
  const secondHalf = blunderRates.slice(Math.ceil(blunderRates.length / 2));

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  if (diff < -0.3) return "improving";
  if (diff > 0.3) return "declining";
  return "stable";
}
