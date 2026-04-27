"use client";

import { useReducer, useState } from "react";
import { ChessGame, AnalysisProgress, FullAnalysisResult } from "@/lib/types";
import ResultsView from "@/components/results-view";
import ProgressBar from "@/components/progress-bar";
import ProgressSummary from "@/components/progress-summary";
import { saveSession } from "@/lib/history";
import { initialProgressState, progressReducer } from "@/lib/progress-state";

type Stage = "input" | "fetching" | "analyzing" | "done" | "error";

function getEstimatedDurationLabel(gameCount: number): string {
  const minSeconds = Math.max(15, gameCount * 8);
  const maxSeconds = Math.max(25, gameCount * 14);
  return `Usually about ${minSeconds}-${maxSeconds}s depending on Chess.com, engine, and AI response time.`;
}

interface AnalyzeClientProps {
  defaultUsername?: string;
}

export default function AnalyzeClient({ defaultUsername }: AnalyzeClientProps) {
  const [username, setUsername] = useState(defaultUsername ?? "");
  const [gameCount, setGameCount] = useState(5);
  const [stage, setStage] = useState<Stage>("input");
  const [error, setError] = useState("");
  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [progressState, dispatchProgress] = useReducer(
    progressReducer,
    initialProgressState
  );

  const handleAnalyze = async () => {
    if (!username.trim()) return;

    const requestStartedAt = Date.now();
    setStage("fetching");
    setError("");
    dispatchProgress({
      type: "set_fetching",
      message: "Fetching your games from Chess.com...",
    });

    try {
      const gamesFetchStartedAt = Date.now();
      const gamesRes = await fetch(
        `/api/games?username=${encodeURIComponent(username)}&count=${gameCount}`
      );
      const gamesData = await gamesRes.json();
      const fetchMs = Date.now() - gamesFetchStartedAt;

      if (!gamesRes.ok) {
        throw new Error(gamesData.error || "Failed to fetch games");
      }

      const games: ChessGame[] = gamesData.games;
      if (!games.length) {
        throw new Error("No games found for this user");
      }

      setStage("analyzing");
      dispatchProgress({
        type: "start_stockfish",
        totalGames: games.length,
      });

      const analyzeStartedAt = Date.now();
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });

      if (!analyzeRes.ok) {
        throw new Error("Analysis request failed");
      }

      const reader = analyzeRes.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const update: AnalysisProgress = JSON.parse(line);

            if (update.type === "error") {
              throw new Error(update.message);
            }

            if (update.type === "done") {
              const serverResult = update.data as FullAnalysisResult;
              const fullResult: FullAnalysisResult = {
                ...serverResult,
                performance: {
                  ...serverResult.performance,
                  fetchMs,
                  endToEndMs: Date.now() - requestStartedAt,
                  analyzeTotalMs:
                    serverResult.performance?.analyzeTotalMs ??
                    Date.now() - analyzeStartedAt,
                  stockfishMs: serverResult.performance?.stockfishMs ?? 0,
                  llmMs: serverResult.performance?.llmMs ?? 0,
                  overallMs: serverResult.performance?.overallMs ?? 0,
                  averageStockfishPerGameMs:
                    serverResult.performance?.averageStockfishPerGameMs ?? 0,
                  averageLlmPerGameMs:
                    serverResult.performance?.averageLlmPerGameMs ?? 0,
                },
              };
              setResult(fullResult);
              setStage("done");
              dispatchProgress({ type: "done" });
              void saveSession(username, fullResult).catch((saveError) => {
                console.error("Failed to save analysis session", saveError);
              });
            } else {
              dispatchProgress({ type: "apply_update", update });
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  };

  const handleReset = () => {
    setStage("input");
    setResult(null);
    setError("");
    dispatchProgress({ type: "reset" });
  };

  if (stage === "done" && result) {
    return (
      <ResultsView
        result={result}
        onReset={handleReset}
        analyzedUsername={username.trim()}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-accent-blue/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      </div>

      <div className="mx-auto w-full max-w-xl space-y-4 lg:max-w-2xl">
        <div className="space-y-4">
          <section className="surface-frame rounded-[24px] p-4 md:p-7">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                  Analyze
                </p>
                <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
                  Enter a Chess.com username
                </h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-foreground/70">
                  Start small, spot the biggest misses, then practice the exact positions that mattered.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-primary">
                {gameCount} games
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Chess.com Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. hikaru"
                  disabled={stage !== "input" && stage !== "error"}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-foreground">
                    Games to analyze
                  </label>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {gameCount}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={gameCount}
                  onChange={(e) => setGameCount(parseInt(e.target.value))}
                  disabled={stage !== "input" && stage !== "error"}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>1</span>
                  <span>10</span>
                  <span>20</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {getEstimatedDurationLabel(gameCount)}
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                  {error}
                </div>
              )}

              {(stage === "fetching" || stage === "analyzing") && (
                <ProgressBar
                  currentPhase={progressState.currentPhase}
                  gamesCompleted={progressState.gamesCompleted}
                  totalGames={progressState.totalGames}
                  activeGamesCount={progressState.activeGamesCount}
                  phaseProgressPercent={progressState.phaseProgressPercent}
                  activeGameIndex={progressState.activeGameIndex}
                  message={progressState.message}
                  lastCompletedMessage={progressState.lastCompletedMessage}
                />
              )}

              {(stage === "input" || stage === "error") && (
                <button
                  onClick={handleAnalyze}
                  disabled={!username.trim()}
                  className="min-h-12 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted"
                >
                  Analyze My Games
                </button>
              )}
            </div>
          </section>

          <ProgressSummary />
        </div>
      </div>

      <p className="mx-auto mt-6 w-full max-w-6xl text-center text-xs text-muted">
        Powered by Stockfish engine analysis and AI coaching
      </p>
    </main>
  );
}
