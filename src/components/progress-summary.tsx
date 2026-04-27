"use client";

import { useEffect, useState } from "react";
import { AnalysisSession } from "@/lib/types";
import {
  formatSessionDate,
  getHistorySummary,
  loadHistory,
} from "@/lib/history";

export default function ProgressSummary() {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadHistory()
      .then((history) => {
        if (!cancelled) {
          setSessions(history);
          setHasLoaded(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load progress summary", error);
          setHasLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasLoaded) return null;

  const summary = getHistorySummary(sessions);

  if (summary.totalSessions === 0) {
    return (
      <div className="surface-frame w-full rounded-[24px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Your Progress</h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              Finish a few analyses and this area will show your recent sessions and trends.
            </p>
          </div>
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted">
            empty
          </span>
        </div>
      </div>
    );
  }

  const trendLabel =
    summary.trend === "improving"
      ? "Improving"
      : summary.trend === "declining"
      ? "Declining"
      : "Stable";
  const trendColor =
    summary.trend === "improving"
      ? "text-accent-green"
      : summary.trend === "declining"
      ? "text-accent-red"
      : "text-accent-amber";
  const trendArrow =
    summary.trend === "improving" ? "\u2193" : summary.trend === "declining" ? "\u2191" : "\u2194";
  const recent = summary.recentSessions;
  const maxBlunders = Math.max(...recent.map((s) => s.avgBlundersPerGame), 1);
  const latestSession = summary.latestSession;

  return (
    <div className="surface-frame w-full rounded-[24px] p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Your Progress</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {latestSession
              ? `Latest: ${latestSession.username} · ${formatSessionDate(latestSession.date)}`
              : "Track your recent sessions and keep the training loop visible."}
          </p>
        </div>
        <span className={`rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold ${trendColor}`}>
          {trendArrow} {trendLabel}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Stat label="Sessions" value={summary.totalSessions.toString()} />
        <Stat label="Games" value={summary.totalGames.toString()} />
        <Stat label="Blunders/Game" value={summary.averageBlundersPerGame.toFixed(1)} accent="text-accent-red" />
        <Stat label="Accuracy" value={`${summary.averageAccuracy.toFixed(0)}%`} accent="text-accent-blue" />
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
      <p className="mt-1 text-xs leading-5 text-muted">
        Average blunders per game over the last {recent.length} session{recent.length === 1 ? "" : "s"}
      </p>

      {recent.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Recent sessions</p>
          <div className="space-y-2">
            {recent
              .slice()
              .reverse()
              .map((session) => (
                <div
                  key={`${session.date}-${session.username}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{session.username}</p>
                    <p className="text-xs text-muted">
                      {formatSessionDate(session.date)} · {session.gamesCount} game
                      {session.gamesCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {session.avgBlundersPerGame.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted">blunders/game</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <p className={`text-base font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
    </div>
  );
}
