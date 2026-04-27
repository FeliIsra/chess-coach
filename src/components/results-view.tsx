"use client";

import { useState, useMemo } from "react";
import {
  FullAnalysisResult,
  GameAnalysis,
  GameTimeControl,
  LLMInsight,
  PhaseBreakdown,
} from "@/lib/types";
import WinRateChart from "./win-rate-chart";
import EvalChart from "./eval-chart";
import ChessBoardViewer from "./chess-board-viewer";
import PuzzleTrainer, { extractPuzzles, Puzzle } from "./puzzle-trainer";
import { sanitizeOpeningName } from "@/lib/chess-format";
import { generateAnnotatedPGN } from "@/lib/pgn-export";
import { getConceptLink } from "@/lib/chess-education";
import { buildAnalysisShareText } from "@/lib/share";
import Tooltip from "./tooltip";
import { CHESS_GLOSSARY } from "@/lib/chess-glossary";
import ResultsAccordionSection from "./results-accordion-section";

interface Props {
  result: FullAnalysisResult;
  onReset: () => void;
  analyzedUsername?: string;
}

type GameFilter = "all" | "win" | "loss" | "draw";
type GameSort = "newest" | "oldest" | "most-errors" | "most-blunders" | "highest-rated";
type SectionKey = "fix-first" | "themes" | "openings" | "games" | "details";

const DEFAULT_SECTION_STATE: Record<SectionKey, boolean> = {
  "fix-first": true,
  themes: false,
  openings: false,
  games: true,
  details: false,
};

export default function ResultsView({ result, onReset, analyzedUsername }: Props) {
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [showPuzzles, setShowPuzzles] = useState(false);
  const [activePuzzleIds, setActivePuzzleIds] = useState<string[] | null>(null);
  const [initialPuzzleIndex, setInitialPuzzleIndex] = useState(0);
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [gameSort, setGameSort] = useState<GameSort>("newest");
  const [openSections, setOpenSections] = useState(DEFAULT_SECTION_STATE);
  const [copiedRecap, setCopiedRecap] = useState(false);
  const { overallSummary, overallInsight, games, llmInsights, weakSpots, performance } = result;

  const puzzles = useMemo(() => extractPuzzles(games, llmInsights), [games, llmInsights]);
  const userRating = games[0]?.game.userRating;
  const timeClass = games[0]?.game.timeClass;

  // Filtered games for the Game Details section
  const filteredGames = useMemo(() => {
    const base =
      gameFilter === "all"
        ? games.map((g, i) => ({ analysis: g, originalIndex: i }))
        : games
      .map((g, i) => ({ analysis: g, originalIndex: i }))
      .filter(({ analysis }) => analysis.game.result === gameFilter);
    return [...base].sort((a, b) => compareGames(a.analysis, b.analysis, gameSort));
  }, [games, gameFilter, gameSort]);
  const focusAreas = overallInsight?.topWeaknesses?.slice(0, 3) ?? [];
  const nextSteps = overallInsight?.studyPlan?.slice(0, 3) ?? [];
  const visiblePuzzles = useMemo(() => {
    if (!activePuzzleIds) return puzzles;
    const allowed = new Set(activePuzzleIds);
    return puzzles.filter((puzzle) => allowed.has(puzzle.id));
  }, [activePuzzleIds, puzzles]);

  // Opening repertoire stats
  const openingStats = useMemo(() => {
    const map = new Map<
      string,
      { wins: number; losses: number; draws: number; blunders: number; count: number }
    >();
    for (const { game, blunders } of games) {
      const name = sanitizeOpeningName(game.openingName);
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

  const openAllPuzzles = () => {
    setActivePuzzleIds(null);
    setInitialPuzzleIndex(0);
    setShowPuzzles(true);
  };

  const openCategoryPuzzles = (category: string) => {
    const matching = puzzles.filter((puzzle) => puzzle.category === category);
    if (matching.length === 0) return;
    setActivePuzzleIds(matching.map((puzzle) => puzzle.id));
    setInitialPuzzleIndex(0);
    setShowPuzzles(true);
  };

  const openSpecificPuzzle = (puzzle: Puzzle) => {
    setActivePuzzleIds([puzzle.id]);
    setInitialPuzzleIndex(0);
    setShowPuzzles(true);
  };

  const handleCopyRecap = async () => {
    try {
      await navigator.clipboard.writeText(buildAnalysisShareText(result, analyzedUsername));
      setCopiedRecap(true);
      window.setTimeout(() => setCopiedRecap(false), 1500);
    } catch (error) {
      console.error("Failed to copy analysis recap", error);
    }
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  if (showPuzzles && visiblePuzzles.length > 0) {
    return (
      <main className="relative mx-auto min-h-screen w-full max-w-4xl overflow-hidden px-4 py-6 md:px-6 md:py-8">
        <PuzzleTrainer
          key={`${activePuzzleIds?.join(",") ?? "all"}:${initialPuzzleIndex}`}
          puzzles={visiblePuzzles}
          initialIndex={Math.min(initialPuzzleIndex, Math.max(visiblePuzzles.length - 1, 0))}
          onClose={() => setShowPuzzles(false)}
        />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-32 h-64 w-64 rounded-full bg-accent-blue/8 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="surface-frame rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted">
                <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] font-semibold tracking-[0.22em] text-primary">
                  Analysis results
                </span>
                <span>{games.length} game{games.length > 1 ? "s" : ""}</span>
                {userRating && timeClass && <span>~{userRating} {timeClass}</span>}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Your Analysis
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-foreground/72">
                Focus on the theme cards, open the game details only when you need them, and
                use the puzzle flow to practice the misses immediately.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {analyzedUsername && (
                  <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-foreground">
                    {analyzedUsername}
                  </span>
                )}
                {userRating && timeClass && (
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    ~{userRating} {timeClass}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={handleCopyRecap}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                {copiedRecap ? "Copied recap" : "Copy recap"}
              </button>
              <button
                onClick={() => {
                  const pgn = generateAnnotatedPGN(games, llmInsights);
                  const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "chess-coach-analysis.pgn";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                Export PGN
              </button>
              <button
                onClick={onReset}
                className="text-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                New Analysis
              </button>
            </div>
          </div>
        </div>

        <div className="surface-frame rounded-[28px] p-4 md:p-5">
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
                <StatCard label="Average Accuracy" value={`${overallSummary.averageAccuracy.toFixed(0)}%`} color="text-accent-blue" />
              )}
            </div>
          </div>

          {overallSummary.timePressureBlunderPercent !== undefined && (
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <p className="text-sm leading-6 text-foreground/76">
                <span className="font-semibold text-accent-amber">
                  {overallSummary.timePressureBlunderPercent}%
                </span>{" "}
                of your errors happened under time pressure
              </p>
              {overallSummary.timePressureBlunderPercent > 50 && (
                <p className="mt-1 text-xs text-muted">
                  Clock management is a real leak in these games.
                </p>
              )}
            </div>
          )}

          {overallSummary.phaseBreakdown && (
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <p className="text-sm leading-6 text-foreground/76">
                Biggest error cluster: {describePhaseLeader(overallSummary.phaseBreakdown)}.
              </p>
              <p className="mt-1 text-xs text-muted">
                {describePhaseCounts(overallSummary.phaseBreakdown)}
              </p>
            </div>
          )}

          {overallSummary.averageEngineDepth !== undefined && (
            <p className="mt-4 text-xs text-muted">
              Average engine depth: ~{Math.round(overallSummary.averageEngineDepth)} ply
            </p>
          )}

          {performance?.endToEndMs !== undefined && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
              Analysis completed in {formatTimingLabel(performance.endToEndMs)}
            </p>
          )}
        </div>

      {overallInsight && (
        <ResultsAccordionSection
          id="what-to-fix-first"
          title="What To Fix First"
          summary={overallInsight.summary}
          isOpen={openSections["fix-first"]}
          onToggle={() => toggleSection("fix-first")}
          className="mb-0"
        >
          <div className="space-y-4 pt-4">
            <p className="text-sm leading-6 text-foreground/80">
              {overallInsight.summary}
            </p>

            {focusAreas.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <h3 className="mb-2 text-sm font-semibold text-accent-red">
                  Top recurring problems
                </h3>
                <ul className="space-y-2">
                  {focusAreas.map((weakness, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/75">
                      <span className="shrink-0 text-accent-red">{i + 1}.</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {overallInsight.topStrengths?.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <h3 className="mb-2 text-sm font-semibold text-accent-green">
                  Keep doing this
                </h3>
                <ul className="space-y-2">
                  {overallInsight.topStrengths.slice(0, 3).map((strength, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/75">
                      <span className="shrink-0 text-accent-green">+</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {nextSteps.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface-2 p-4">
                <h3 className="mb-2 text-sm font-semibold text-accent-blue">
                  Next training block
                </h3>
                <ol className="space-y-2">
                  {nextSteps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/75">
                      <span className="shrink-0 text-accent-blue">{i + 1}.</span>
                      {step.replace(/^\d+\.\s*/, "")}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {puzzles.length > 0 && (
              <button
                onClick={openAllPuzzles}
                className="w-full rounded-xl border border-accent-amber/30 bg-accent-amber/10 py-3 text-sm font-semibold text-accent-amber transition-colors hover:bg-accent-amber/20"
              >
                Start With {Math.min(5, puzzles.length)} mistake puzzle{puzzles.length === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </ResultsAccordionSection>
      )}

      {/* Weak Spots */}
      {weakSpots && weakSpots.length > 0 && (
        <ResultsAccordionSection
          id="train-by-theme"
          title="Train By Theme"
          summary="Open only the themes you want to practice right now."
          isOpen={openSections.themes}
          onToggle={() => toggleSection("themes")}
          className="mb-0"
        >
          <div className="flex flex-wrap gap-2 pt-4">
            {weakSpots.map((spot, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-border bg-surface-2 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-accent-red capitalize">
                    {spot.category}
                  </span>
                  <span className="rounded-full bg-accent-red/20 px-1.5 py-0.5 text-xs text-accent-red">
                    {spot.count}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {spot.tip ||
                    `Practice identifying ${spot.category} patterns — you had ${spot.count} error${spot.count !== 1 ? "s" : ""} in this area across your recent games.`}
                </p>
                {puzzles.some((puzzle) => puzzle.category === spot.category) && (
                  <button
                    onClick={() => openCategoryPuzzles(spot.category)}
                    className="mt-2 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    Practice this theme
                  </button>
                )}
              </div>
            ))}
          </div>
        </ResultsAccordionSection>
      )}

      {/* Opening Repertoire */}
      {openingStats.length > 0 && (
        <ResultsAccordionSection
          id="your-openings"
          title="Your Openings"
          summary="Quick read on the openings showing up most often in this sample."
          isOpen={openSections.openings}
          onToggle={() => toggleSection("openings")}
          className="mb-0"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 pt-4">
            {openingStats.map(([name, stats], i) => {
              const winRate = stats.count > 0 ? (stats.wins / stats.count) * 100 : 0;
              const rateColor =
                winRate > 60 ? "text-accent-green" : winRate < 40 ? "text-accent-red" : "text-foreground/70";
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 ${
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
                      {(stats.blunders / stats.count).toFixed(1)} blunders/game
                    </p>
                  </div>
                  <p className={`text-sm font-mono font-semibold ${rateColor} ml-3 shrink-0`}>
                    {stats.wins}W-{stats.losses}L-{stats.draws}D
                  </p>
                </div>
              );
            })}
          </div>
        </ResultsAccordionSection>
      )}

      {/* Game-by-game */}
      <ResultsAccordionSection
        id="game-details"
        title="Game Details"
        summary="Filter and sort your sample to focus on the games that matter most."
        isOpen={openSections.games}
        onToggle={() => toggleSection("games")}
        className="mb-0"
      >
        <div className="pt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "win", "loss", "draw"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGameFilter(filter)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    gameFilter === filter
                      ? "bg-primary text-white"
                      : "bg-surface-2 text-muted border border-border hover:text-foreground"
                  }`}
                >
                  {FILTER_LABELS[filter]}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 text-sm text-muted">
              <span className="shrink-0">Sort by</span>
              <select
                value={gameSort}
                onChange={(e) => setGameSort(e.target.value as GameSort)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most-errors">Most errors first</option>
                <option value="most-blunders">Most blunders first</option>
                <option value="highest-rated">Highest-rated opponent</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {filteredGames.map(({ analysis, originalIndex }) => (
              <GameCard
                key={originalIndex}
                index={originalIndex}
                analysis={analysis}
                insight={llmInsights[originalIndex]}
                practicePuzzles={puzzles.filter((puzzle) => puzzle.gameIndex === originalIndex)}
                onPracticePuzzle={openSpecificPuzzle}
                expanded={expandedGame === originalIndex}
                onToggle={() =>
                  setExpandedGame(expandedGame === originalIndex ? null : originalIndex)
                }
              />
            ))}
            {filteredGames.length === 0 && (
              <p className="text-sm text-muted text-center py-4">
                No {gameFilter === "all" ? "" : gameFilter} games found.
              </p>
            )}
          </div>
        </div>
      </ResultsAccordionSection>

      {performance && (
        <ResultsAccordionSection
          id="analysis-details"
          title="Analysis Details"
          summary="Timing and engine/AI breakdown for this run."
          isOpen={openSections.details}
          onToggle={() => toggleSection("details")}
          className="mb-0"
        >
          <div className="grid grid-cols-2 gap-3 pt-4">
            <TimingCard label="Fetch" value={performance.fetchMs} />
            <TimingCard label="Engine" value={performance.stockfishMs} />
            <TimingCard label="AI Review" value={performance.llmMs} />
            <TimingCard label="Plan" value={performance.overallMs} />
            <TimingCard label="Analyze" value={performance.analyzeTotalMs} />
            <TimingCard label="End-to-End" value={performance.endToEndMs} />
          </div>
        </ResultsAccordionSection>
      )}

      {/* Back button */}
      <div className="pb-8">
        <button
          onClick={onReset}
          className="w-full rounded-xl bg-primary py-3 text-white font-semibold transition-colors hover:bg-primary-hover"
        >
          Analyze More Games
        </button>
      </div>
      </div>
    </main>
  );
}

function formatTimingLabel(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

function formatTimeControl(timeControl?: GameTimeControl): string {
  if (!timeControl) return "";
  return `${formatClockDuration(timeControl.initialSeconds)}+${timeControl.incrementSeconds}`;
}

function formatClockDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function describePhaseCounts(phaseBreakdown: PhaseBreakdown): string {
  return [
    `Opening ${phaseBreakdown.opening.errors}`,
    `Middlegame ${phaseBreakdown.middlegame.errors}`,
    `Endgame ${phaseBreakdown.endgame.errors}`,
  ].join(" · ");
}

function describePhaseLeader(phaseBreakdown: PhaseBreakdown): string {
  const entries = [
    ["opening", phaseBreakdown.opening.errors],
    ["middlegame", phaseBreakdown.middlegame.errors],
    ["endgame", phaseBreakdown.endgame.errors],
  ] as const;
  const [phase, count] = entries.reduce((best, current) =>
    current[1] > best[1] ? current : best
  );
  if (count <= 0) return "no phase stood out";
  const label = phase.charAt(0).toUpperCase() + phase.slice(1);
  return `${label} (${count} error${count === 1 ? "" : "s"})`;
}

const FILTER_LABELS: Record<GameFilter, string> = {
  all: "All",
  win: "Wins",
  loss: "Losses",
  draw: "Draws",
};

function compareGames(a: GameAnalysis, b: GameAnalysis, sortBy: GameSort): number {
  if (sortBy === "oldest") {
    return getGameDateValue(a.game.date) - getGameDateValue(b.game.date);
  }
  if (sortBy === "most-errors") {
    return b.blunders + b.mistakes - (a.blunders + a.mistakes);
  }
  if (sortBy === "most-blunders") {
    return b.blunders - a.blunders;
  }
  if (sortBy === "highest-rated") {
    return b.game.opponentRating - a.game.opponentRating;
  }
  return getGameDateValue(b.game.date) - getGameDateValue(a.game.date);
}

function getGameDateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const glossary = CHESS_GLOSSARY[label];
  return (
    <div className="min-w-[96px] rounded-2xl border border-border bg-surface-2 px-3 py-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted">
        {glossary ? <Tooltip content={glossary}>{label}</Tooltip> : label}
      </p>
    </div>
  );
}

function TimingCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {value === undefined ? "n/a" : formatTimingLabel(value)}
      </p>
    </div>
  );
}

function GameCard({
  index,
  analysis,
  insight,
  practicePuzzles,
  onPracticePuzzle,
  expanded,
  onToggle,
}: {
  index: number;
  analysis: GameAnalysis;
  insight?: LLMInsight;
  practicePuzzles: Puzzle[];
  onPracticePuzzle: (puzzle: Puzzle) => void;
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
    <div className="surface-frame overflow-hidden rounded-[24px]">
      {/* Header - always visible */}
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <div className={`w-2 h-10 rounded-full ${resultColor} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                vs {game.opponentName}
              </p>
              <span className="text-xs text-muted">({game.opponentRating})</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {sanitizeOpeningName(game.openingName)} &middot; {game.timeClass} &middot; {game.userColor} &middot;{" "}
              {game.result.toUpperCase()}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              <span>{formatGameDate(game.date)}</span>
              {game.url && <span>&middot;</span>}
              {game.url && <span>Chess.com available</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex gap-1.5 text-xs">
              {analysis.blunders > 0 && (
                <span className="bg-accent-red/20 text-accent-red px-1.5 py-0.5 rounded">
                  {analysis.blunders} blunder{analysis.blunders === 1 ? "" : "s"}
                </span>
              )}
              {analysis.mistakes > 0 && (
                <span className="bg-accent-amber/20 text-accent-amber px-1.5 py-0.5 rounded">
                  {analysis.mistakes} mistake{analysis.mistakes === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <span className="text-muted text-lg">{expanded ? "\u2212" : "+"}</span>
          </div>
        </button>
        {game.url && (
          <a
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-primary transition-colors hover:text-primary-hover"
          >
            Chess.com &#8599;
          </a>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Analysis depth: ~{analysis.engineDepth ?? "?"} ply</span>
            {analysis.timeControl && (
              <span>Time control: {formatTimeControl(analysis.timeControl)}</span>
            )}
            {analysis.phaseBreakdown && (
              <span>{describePhaseCounts(analysis.phaseBreakdown)}</span>
            )}
          </div>

          {/* Eval Chart */}
          <EvalChart
            moves={analysis.moves}
            timeControlSeconds={analysis.timeControl?.initialSeconds}
          />

          {/* Chess Board Viewer */}
          <ChessBoardViewer moves={analysis.moves} userColor={game.userColor} />

          {insight && (
            <>
              {/* Game summary */}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {insight.summary}
              </p>

              {practicePuzzles.length > 0 && (
                <button
                  onClick={() => onPracticePuzzle(practicePuzzles[0])}
                  className="w-full rounded-xl border border-accent-amber/30 bg-accent-amber/10 py-2.5 text-sm font-semibold text-accent-amber transition-colors hover:bg-accent-amber/20"
                >
                  Practice the first critical mistake from this game
                </button>
              )}

              {/* Worst moves */}
              {insight.worstMovesAnalysis?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-red">
                    Key Mistakes
                  </h4>
                  <div className="space-y-2">
                    {insight.worstMovesAnalysis.slice(0, 5).map((m, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-accent-red/20 bg-accent-red/10 p-3"
                      >
                        <p className="mb-1 text-xs font-mono text-accent-red">
                          Move {m.moveNumber}: {m.move}
                        </p>
                        <p className="text-sm leading-6 text-foreground/80">{m.explanation}</p>
                        <p className="mt-1 text-xs font-medium text-accent-red/70">
                          Concept:{" "}
                          {(() => {
                            const link = getConceptLink(m.concept);
                            return link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline transition-colors hover:text-accent-red"
                              >
                                {m.concept} &#8599;
                              </a>
                            ) : (
                              m.concept
                            );
                          })()}
                        </p>
                        {(() => {
                          const matchingPuzzle = practicePuzzles.find(
                            (puzzle) => puzzle.gameIndex === index && puzzle.moveNumber === m.moveNumber
                          );
                          return matchingPuzzle ? (
                            <button
                              onClick={() => onPracticePuzzle(matchingPuzzle)}
                              className="mt-2 text-xs text-primary hover:text-primary-hover font-medium"
                            >
                              Practice this position
                            </button>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best moves */}
              {insight.bestMovesAnalysis?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-green">
                    Great Moves
                  </h4>
                  <div className="space-y-2">
                    {insight.bestMovesAnalysis.slice(0, 5).map((m, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-accent-green/20 bg-accent-green/10 p-3"
                      >
                        <p className="mb-1 text-xs font-mono text-accent-green">
                          Move {m.moveNumber}: {m.move}
                        </p>
                        <p className="text-sm leading-6 text-foreground/80">{m.explanation}</p>
                        <p className="mt-1 text-xs font-medium text-accent-green/70">
                          Concept:{" "}
                          {(() => {
                            const link = getConceptLink(m.concept);
                            return link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline transition-colors hover:text-accent-green"
                              >
                                {m.concept} &#8599;
                              </a>
                            ) : (
                              m.concept
                            );
                          })()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement tips */}
              {insight.improvementPlan?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-blue">
                    How to Improve
                  </h4>
                  <ul className="space-y-1">
                    {insight.improvementPlan.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/70">
                        <span className="shrink-0 text-accent-blue">&#8594;</span>
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

function formatGameDate(date: string): string {
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(parsed));
}
