"use client";

import { useEffect, useState } from "react";
import { AnalysisSession } from "@/lib/types";
import { loadHistory, getTrend } from "@/lib/history";

export default function ProgressSummary() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadHistory()
      .then((history) => {
        if (!cancelled) {
          setSessions(history);
        }
      })
      .catch((error) => {
        console.error("Failed to load progress summary", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (sessions.length === 0) return null;

  const trend = getTrend(sessions);
  const recent = sessions.slice(-10);
  const maxBlunders = Math.max(...recent.map((s) => s.avgBlundersPerGame), 1);

  const trendLabel =
    trend === "improving"
      ? "Improving"
      : trend === "declining"
      ? "Declining"
      : "Stable";
  const trendColor =
    trend === "improving"
      ? "text-accent-green"
      : trend === "declining"
      ? "text-accent-red"
      : "text-accent-amber";
  const trendArrow =
    trend === "improving" ? "\u2193" : trend === "declining" ? "\u2191" : "\u2194";

  return (
    <div className="w-full max-w-md bg-surface-1 rounded-2xl border border-border p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Your Progress</h3>
        <span className={`text-xs font-medium ${trendColor}`}>
          {trendArrow} {trendLabel}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{sessions.length}</p>
          <p className="text-xs text-muted">Sessions</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {sessions.reduce((s, a) => s + a.gamesCount, 0)}
          </p>
          <p className="text-xs text-muted">Games</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-accent-red">
            {(
              sessions.reduce((s, a) => s + a.avgBlundersPerGame, 0) /
              sessions.length
            ).toFixed(1)}
          </p>
          <p className="text-xs text-muted">Avg Blunders/Game</p>
        </div>
      </div>

      {/* Mini sparkline */}
      {recent.length > 1 && (
        <div className="flex items-end gap-1 h-8">
          {recent.map((s, i) => {
            const height = Math.max(
              4,
              (s.avgBlundersPerGame / maxBlunders) * 100
            );
            return (
              <div
                key={i}
                className="flex-1 bg-accent-red/40 rounded-t"
                style={{ height: `${height}%` }}
                title={`${s.avgBlundersPerGame.toFixed(1)} blunders/game`}
              />
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted mt-1">Blunders per game (last {recent.length} sessions)</p>
    </div>
  );
}
