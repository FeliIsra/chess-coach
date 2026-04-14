"use client";

import { useReducer, useState } from "react";
import { ChessGame, AnalysisProgress, FullAnalysisResult } from "@/lib/types";
import ResultsView from "@/components/results-view";
import ProgressBar from "@/components/progress-bar";
import ProgressSummary from "@/components/progress-summary";
import { saveSession } from "@/lib/history";
import { initialProgressState, progressReducer } from "@/lib/progress-state";

type Stage = "input" | "fetching" | "analyzing" | "done" | "error";

export default function Home() {
  const [username, setUsername] = useState("");
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

    setStage("fetching");
    setError("");
    dispatchProgress({
      type: "set_fetching",
      message: "Fetching your games from Chess.com...",
    });

    try {
      const gamesRes = await fetch(
        `/api/games?username=${encodeURIComponent(username)}&count=${gameCount}`
      );
      const gamesData = await gamesRes.json();

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
              const fullResult = update.data as FullAnalysisResult;
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
    return <ResultsView result={result} onReset={handleReset} />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">&#9822;</div>
        <h1 className="text-2xl font-bold text-foreground">Chess Coach</h1>
        <p className="text-muted mt-1 text-sm">
          AI-powered analysis of your Chess.com games
        </p>
      </div>

      {/* Progress Summary */}
      <ProgressSummary />

      {/* Form */}
      <div className="w-full max-w-md bg-surface-1 rounded-2xl border border-border p-6 space-y-5">
        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-foreground mb-1"
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
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 text-base"
          />
        </div>

        {/* Game count slider */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Games to analyze:{" "}
            <span className="text-primary font-bold">{gameCount}</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={gameCount}
            onChange={(e) => setGameCount(parseInt(e.target.value))}
            disabled={stage !== "input" && stage !== "error"}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>1</span>
            <span>10</span>
            <span>20</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-accent-red text-sm">
            {error}
          </div>
        )}

        {/* Progress */}
        {(stage === "fetching" || stage === "analyzing") && (
          <ProgressBar
            currentPhase={progressState.currentPhase}
            gamesCompleted={progressState.gamesCompleted}
            totalGames={progressState.totalGames}
            phaseProgressPercent={progressState.phaseProgressPercent}
            activeGameIndex={progressState.activeGameIndex}
            message={progressState.message}
            lastCompletedMessage={progressState.lastCompletedMessage}
          />
        )}

        {/* Buttons */}
        {(stage === "input" || stage === "error") && (
          <button
            onClick={handleAnalyze}
            disabled={!username.trim()}
            className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted text-white font-semibold rounded-xl transition-colors text-base"
          >
            Analyze My Games
          </button>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted mt-8 text-center">
        Powered by Stockfish engine analysis and AI coaching
      </p>
    </main>
  );
}
