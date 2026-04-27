import { AnalysisSession, FullAnalysisResult } from "./types";

export function saveSession(
  username: string,
  result: FullAnalysisResult
): Promise<void> {
  return fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, result }),
  }).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error || "Failed to save session");
    }
  });
}

export async function loadHistory(username?: string): Promise<AnalysisSession[]> {
  const search = username ? `?username=${encodeURIComponent(username)}` : "";
  const response = await fetch(`/api/history${search}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error || "Failed to load history");
  }

  const data = (await response.json()) as { sessions?: AnalysisSession[] };
  return data.sessions ?? [];
}

export function getRecentSessions(
  sessions: AnalysisSession[],
  limit = 4,
): AnalysisSession[] {
  if (limit <= 0) return [];
  return sessions.slice(Math.max(0, sessions.length - limit));
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

export function formatSessionDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function getHistorySummary(sessions: AnalysisSession[]) {
  const totalSessions = sessions.length;
  const totalGames = sessions.reduce((sum, session) => sum + session.gamesCount, 0);
  const totalBlunders = sessions.reduce((sum, session) => sum + session.totalBlunders, 0);
  const averageBlundersPerGame = totalGames > 0 ? totalBlunders / totalGames : 0;
  const averageAccuracy =
    totalSessions > 0
      ? sessions.reduce((sum, session) => sum + session.averageAccuracy, 0) / totalSessions
      : 0;

  return {
    totalSessions,
    totalGames,
    totalBlunders,
    averageBlundersPerGame,
    averageAccuracy,
    latestSession: sessions[totalSessions - 1] ?? null,
    recentSessions: getRecentSessions(sessions, 4),
    trend: getTrend(sessions),
  };
}
