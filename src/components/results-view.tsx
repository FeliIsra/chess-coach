"use client";

import { useState, useMemo } from "react";
import { FullAnalysisResult, GameAnalysis, LLMInsight } from "@/lib/types";
import WinRateChart from "./win-rate-chart";
import EvalChart from "./eval-chart";
import ChessBoardViewer from "./chess-board-viewer";
import PuzzleTrainer, { extractPuzzles } from "./puzzle-trainer";

interface Props {
  result: FullAnalysisResult;
  onReset: () => void;
}

export default function ResultsView({ result, onReset }: Props) {
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [showPuzzles, setShowPuzzles] = useState(false);
  const { overallSummary, overallInsight, games, llmInsights, weakSpots } = result;

  const puzzles = useMemo(() => extractPuzzles(games), [games]);
  const primaryUserColor = games[0]?.game.userColor ?? "white";

  // Opening repertoire stats
  const openingStats = useMemo(() => {
    const map = new Map<
      string,
      { wins: number; losses: number; draws: number; blunders: number; count: number }
    >();
    for (const { game, blunders } of games) {
      const name = game.openingName;
      const entry = map.get(name) ?? { wins: 0, losses: 0, draws: 0, blunders: 0, count: 0 };
      entry.count++;
      if (game.result === "win") entry.wins++;
      else if (game.result === "loss") entry.losses++;
      else entry.draws++;
      entry.blunders += blunders;
      map.set(name, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
  }, [games]);

  if (showPuzzles && puzzles.length > 0) {
    return (
      <main className="min-h-screen px-4 py-6 max-w-lg mx-auto">
        <PuzzleTrainer
          puzzles={puzzles}
          userColor={primaryUserColor}
          onClose={() => setShowPuzzles(false)}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Your Analysis</h1>
          <p className="text-sm text-muted">
            {games.length} game{games.length > 1 ? "s" : ""} analyzed
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-sm text-primary hover:text-primary-hover font-medium"
        >
          New Analysis
        </button>
      </div>

      {/* Win Rate + Stats Summary */}
      <div className="bg-surface-1 rounded-2xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <WinRateChart
            wins={overallSummary.wins}
            losses={overallSummary.losses}
            draws={overallSummary.draws}
          />
          <div className="flex flex-col gap-2">
            <StatCard label="Blunders" value={overallSummary.totalBlunders} color="text-accent-red" />
            <StatCard label="Mistakes" value={overallSummary.totalMistakes} color="text-accent-amber" />
            {overallSummary.averageAccuracy > 0 && (
              <StatCard label="Avg Accuracy" value={`${overallSummary.averageAccuracy.toFixed(0)}%`} color="text-accent-blue" />
            )}
          </div>
        </div>

        {/* Time pressure stat */}
        {overallSummary.timePressureBlunderPercent !== undefined && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm text-foreground/70">
              <span className="font-semibold text-accent-amber">
                {overallSummary.timePressureBlunderPercent}%
              </span>{" "}
              of your blunders were under time pressure
            </p>
            {overallSummary.timePressureBlunderPercent > 50 && (
              <p className="text-xs text-muted mt-1">
                Try to manage your clock better in the middlegame
              </p>
            )}
          </div>
        )}
      </div>

      {/* Practice button */}
      {puzzles.length > 0 && (
        <button
          onClick={() => setShowPuzzles(true)}
          className="w-full mb-6 py-3 bg-accent-amber/10 hover:bg-accent-amber/20 border border-accent-amber/30 text-accent-amber font-semibold rounded-xl transition-colors text-sm"
        >
          Practice Your Mistakes ({puzzles.length} puzzles)
        </button>
      )}

      {/* AI Overall Summary */}
      {overallInsight && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">
            AI Coach Summary
          </h2>
          <div className="bg-surface-1 rounded-2xl border border-border p-4 space-y-4">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {overallInsight.summary}
            </p>

            {overallInsight.topStrengths?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent-green mb-1">
                  Your Strengths
                </h3>
                <ul className="space-y-1">
                  {overallInsight.topStrengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/70 flex gap-2">
                      <span className="text-accent-green shrink-0">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {overallInsight.topWeaknesses?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent-red mb-1">
                  Areas to Improve
                </h3>
                <ul className="space-y-1">
                  {overallInsight.topWeaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-foreground/70 flex gap-2">
                      <span className="text-accent-red shrink-0">!</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {overallInsight.studyPlan?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent-blue mb-1">
                  Study Plan
                </h3>
                <ol className="space-y-1">
                  {overallInsight.studyPlan.map((step, i) => (
                    <li
                      key={i}
                      className="text-sm text-foreground/70 flex gap-2"
                    >
                      <span className="text-accent-blue font-mono shrink-0">
                        {i + 1}.
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Weak Spots */}
      {weakSpots && weakSpots.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">
            Your Weak Spots
          </h2>
          <div className="flex flex-wrap gap-2">
            {weakSpots.map((spot, i) => (
              <div
                key={i}
                className="bg-surface-1 rounded-xl border border-border px-3 py-2 group relative"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-accent-red capitalize">
                    {spot.category}
                  </span>
                  <span className="text-xs bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded">
                    {spot.count}
                  </span>
                </div>
                {spot.tip && (
                  <p className="text-xs text-muted mt-1">{spot.tip}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Opening Repertoire */}
      {openingStats.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">
            Your Openings
          </h2>
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            {openingStats.map(([name, stats], i) => {
              const winRate = stats.count > 0 ? (stats.wins / stats.count) * 100 : 0;
              const rateColor =
                winRate > 60 ? "text-accent-green" : winRate < 40 ? "text-accent-red" : "text-foreground/70";
              return (
                <div
                  key={i}
                  className={`px-4 py-3 flex items-center justify-between ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {name}
                    </p>
                    <p className="text-xs text-muted">
                      {stats.count} game{stats.count > 1 ? "s" : ""}
                      {" \u00B7 "}
                      {(stats.blunders / stats.count).toFixed(1)} avg blunders
                    </p>
                  </div>
                  <p className={`text-sm font-mono font-semibold ${rateColor} shrink-0 ml-3`}>
                    {stats.wins}W-{stats.losses}L-{stats.draws}D
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Game-by-game */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">
          Game Details
        </h2>
        <div className="space-y-3">
          {games.map((analysis, i) => (
            <GameCard
              key={i}
              index={i}
              analysis={analysis}
              insight={llmInsights[i]}
              expanded={expandedGame === i}
              onToggle={() =>
                setExpandedGame(expandedGame === i ? null : i)
              }
            />
          ))}
        </div>
      </section>

      {/* Back button */}
      <div className="mt-8 pb-8">
        <button
          onClick={onReset}
          className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors"
        >
          Analyze More Games
        </button>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2 text-center min-w-[90px]">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function GameCard({
  analysis,
  insight,
  expanded,
  onToggle,
}: {
  index: number;
  analysis: GameAnalysis;
  insight?: LLMInsight;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { game } = analysis;
  const resultColor =
    game.result === "win"
      ? "bg-accent-green"
      : game.result === "loss"
      ? "bg-accent-red"
      : "bg-muted";

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className={`w-2 h-10 rounded-full ${resultColor} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">
              vs {game.opponentName}
            </p>
            <span className="text-xs text-muted">({game.opponentRating})</span>
          </div>
          <p className="text-xs text-muted truncate">
            {game.openingName} &middot; {game.timeClass} &middot;{" "}
            {game.result.toUpperCase()}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex gap-1.5 text-xs">
            {analysis.blunders > 0 && (
              <span className="bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded">
                {analysis.blunders}B
              </span>
            )}
            {analysis.mistakes > 0 && (
              <span className="bg-accent-amber/20 text-accent-amber px-1.5 py-0.5 rounded">
                {analysis.mistakes}M
              </span>
            )}
          </div>
          <span className="text-muted text-lg">{expanded ? "\u2212" : "+"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {/* Eval Chart */}
          <EvalChart moves={analysis.moves} />

          {/* Chess Board Viewer */}
          <ChessBoardViewer moves={analysis.moves} userColor={game.userColor} />

          {insight && (
            <>
              {/* Game summary */}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {insight.summary}
              </p>

              {/* Worst moves */}
              {insight.worstMovesAnalysis?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-accent-red uppercase tracking-wide mb-2">
                    Key Mistakes
                  </h4>
                  <div className="space-y-2">
                    {insight.worstMovesAnalysis.slice(0, 5).map((m, i) => (
                      <div
                        key={i}
                        className="bg-accent-red/10 rounded-lg p-3 border border-accent-red/20"
                      >
                        <p className="text-xs font-mono text-accent-red mb-1">
                          Move {m.moveNumber}: {m.move}
                        </p>
                        <p className="text-sm text-foreground/80">{m.explanation}</p>
                        <p className="text-xs text-accent-red/70 mt-1 font-medium">
                          Concept: {m.concept}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best moves */}
              {insight.bestMovesAnalysis?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-accent-green uppercase tracking-wide mb-2">
                    Great Moves
                  </h4>
                  <div className="space-y-2">
                    {insight.bestMovesAnalysis.slice(0, 5).map((m, i) => (
                      <div
                        key={i}
                        className="bg-accent-green/10 rounded-lg p-3 border border-accent-green/20"
                      >
                        <p className="text-xs font-mono text-accent-green mb-1">
                          Move {m.moveNumber}: {m.move}
                        </p>
                        <p className="text-sm text-foreground/80">{m.explanation}</p>
                        <p className="text-xs text-accent-green/70 mt-1 font-medium">
                          Concept: {m.concept}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement tips */}
              {insight.improvementPlan?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-accent-blue uppercase tracking-wide mb-2">
                    How to Improve
                  </h4>
                  <ul className="space-y-1">
                    {insight.improvementPlan.map((tip, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground/70 flex gap-2"
                      >
                        <span className="text-accent-blue shrink-0">&#8594;</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
