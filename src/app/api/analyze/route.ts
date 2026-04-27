import { NextRequest } from "next/server";
import { analyzeGame } from "@/lib/analyzer";
import {
  createOpenAIClient,
  analyzeGameWithLLM,
  generateOverallInsight,
  aggregateWeakSpots,
} from "@/lib/llm-coach";
import {
  AnalysisProgress,
  ChessGame,
  GameAnalysis,
  LLMInsight,
  PhaseBreakdown,
  PhaseMetrics,
} from "@/lib/types";

export const runtime = "nodejs";

function readPositiveIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const STOCKFISH_CONCURRENCY = readPositiveIntEnv("STOCKFISH_CONCURRENCY", 5);
const LLM_CONCURRENCY = readPositiveIntEnv("LLM_CONCURRENCY", 5);

function estimateCompletedPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function estimateStockfishPercent(progressByGame: number[]): number {
  if (progressByGame.length === 0) return 0;
  const totalProgress = progressByGame.reduce((sum, value) => sum + value, 0);
  return Math.round((totalProgress / progressByGame.length) * 100);
}

function createPhaseMetrics(): PhaseMetrics {
  return {
    moves: 0,
    errors: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
  };
}

function createPhaseBreakdown(): PhaseBreakdown {
  return {
    opening: createPhaseMetrics(),
    middlegame: createPhaseMetrics(),
    endgame: createPhaseMetrics(),
  };
}

function addPhaseMetrics(target: PhaseMetrics, source?: PhaseMetrics): void {
  if (!source) return;
  target.moves += source.moves;
  target.errors += source.errors;
  target.blunders += source.blunders;
  target.mistakes += source.mistakes;
  target.inaccuracies += source.inaccuracies;
}

export async function POST(request: NextRequest) {
  const { games } = (await request.json()) as {
    games: ChessGame[];
  };

  if (!games?.length) {
    return new Response(JSON.stringify({ error: "No games provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let sequence = 0;
      const send = (progress: AnalysisProgress) => {
        const payload: AnalysisProgress = {
          ...progress,
          sequence: ++sequence,
        };
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        const analyzeStartedAt = Date.now();
        const openai = createOpenAIClient();
        const allAnalyses: GameAnalysis[] = new Array(games.length);
        let gamesCompleted = 0;
        const stockfishProgressByGame = new Array(games.length).fill(0);
        const stockfishActiveGames = new Set<number>();
        const stockfishStartedAt = Date.now();

        // Phase 1: Stockfish analysis — concurrent pool of STOCKFISH_CONCURRENCY
        send({
          type: "progress",
          phase: "stockfish",
          totalGames: games.length,
          gamesCompleted: 0,
          phaseProgressPercent: 0,
          message: `Starting engine analysis of ${games.length} games...`,
        });

        const analyzeOne = async (i: number) => {
          stockfishActiveGames.add(i);
          try {
            const analysis = await analyzeGame(games[i], (moveIdx, totalMoves) => {
              stockfishProgressByGame[i] = moveIdx / Math.max(totalMoves, 1);
              send({
                type: "progress",
                phase: "stockfish",
                activeGamesCount: stockfishActiveGames.size,
                totalGames: games.length,
                gamesCompleted,
                phaseProgressPercent: estimateStockfishPercent(stockfishProgressByGame),
                message: `Game ${i + 1}/${games.length}: evaluating move ${moveIdx}/${totalMoves}`,
              });
            });

            stockfishProgressByGame[i] = 1;
            stockfishActiveGames.delete(i);
            allAnalyses[i] = analysis;
            gamesCompleted++;

            send({
              type: "game_complete",
              phase: "stockfish",
              gameIndex: i,
              activeGamesCount: stockfishActiveGames.size,
              totalGames: games.length,
              gamesCompleted,
              phaseProgressPercent: estimateStockfishPercent(stockfishProgressByGame),
              message: `Game ${i + 1} analyzed: ${analysis.blunders} blunders, ${analysis.mistakes} mistakes`,
              data: analysis,
            });
          } finally {
            stockfishActiveGames.delete(i);
          }
        };

        // Concurrency pool
        const queue = games.map((_, i) => i);
        const workers: Promise<void>[] = [];

        for (let w = 0; w < Math.min(STOCKFISH_CONCURRENCY, games.length); w++) {
          workers.push(
            (async () => {
              while (queue.length > 0) {
                const idx = queue.shift()!;
                await analyzeOne(idx);
              }
            })()
          );
        }

        await Promise.all(workers);
        const stockfishMs = Date.now() - stockfishStartedAt;

        // Phase 2: LLM analysis — streaming with limited concurrency
        const llmStartedAt = Date.now();
        send({
          type: "llm_analysis",
          phase: "llm",
          totalGames: allAnalyses.length,
          gamesCompleted: 0,
          phaseProgressPercent: 0,
          message: `AI coach reviewing ${allAnalyses.length} games...`,
        });

        let llmCompleted = 0;
        const allInsights: LLMInsight[] = new Array(allAnalyses.length);
        const llmQueue = allAnalyses.map((_, i) => i);
        const llmActiveGames = new Set<number>();

        const llmWorkers: Promise<void>[] = [];
        const totalLlmGames = allAnalyses.length;

        const emitLlmProgress = (progress: Omit<AnalysisProgress, "type" | "phase">) => {
          send({
            type: "llm_analysis",
            phase: "llm",
            totalGames: totalLlmGames,
            ...progress,
            phaseProgressPercent:
              progress.phaseProgressPercent ??
              estimateCompletedPercent(llmCompleted, totalLlmGames),
          });
        };

        const runLlmForGame = async (i: number) => {
          llmActiveGames.add(i);

          emitLlmProgress({
            gameIndex: i,
            activeGamesCount: llmActiveGames.size,
            gamesCompleted: llmCompleted,
            message: `AI reviewing game ${i + 1} of ${totalLlmGames}...`,
          });

          try {
            const insight = await analyzeGameWithLLM(openai, allAnalyses[i]);

            llmActiveGames.delete(i);
            allInsights[i] = insight;
            llmCompleted++;

            emitLlmProgress({
              gameIndex: i,
              activeGamesCount: llmActiveGames.size,
              gamesCompleted: llmCompleted,
              phaseProgressPercent: estimateCompletedPercent(llmCompleted, totalLlmGames),
              message: `AI review complete for ${llmCompleted} of ${totalLlmGames} games`,
            });
          } finally {
            llmActiveGames.delete(i);
          }
        };

        for (let w = 0; w < Math.min(LLM_CONCURRENCY, totalLlmGames); w++) {
          llmWorkers.push(
            (async () => {
              while (llmQueue.length > 0) {
                const idx = llmQueue.shift();
                if (idx === undefined) break;
                await runLlmForGame(idx);
              }
            })()
          );
        }

        await Promise.all(llmWorkers);
        const llmMs = Date.now() - llmStartedAt;

        // Phase 3: Overall insight
        const overallStartedAt = Date.now();
        send({
          type: "llm_analysis",
          phase: "overall",
          phaseProgressPercent: 100,
          message: "Generating your personalized improvement plan...",
        });

        const overallInsight = await generateOverallInsight(
          openai,
          allAnalyses,
          allInsights
        );
        const overallMs = Date.now() - overallStartedAt;

        const wins = allAnalyses.filter((a) => a.game.result === "win").length;
        const losses = allAnalyses.filter((a) => a.game.result === "loss").length;
        const draws = allAnalyses.filter((a) => a.game.result === "draw").length;
        const phaseBreakdown = createPhaseBreakdown();
        let totalEngineDepth = 0;
        let engineDepthSamples = 0;
        for (const analysis of allAnalyses) {
          addPhaseMetrics(phaseBreakdown.opening, analysis.phaseBreakdown?.opening);
          addPhaseMetrics(
            phaseBreakdown.middlegame,
            analysis.phaseBreakdown?.middlegame
          );
          addPhaseMetrics(phaseBreakdown.endgame, analysis.phaseBreakdown?.endgame);
          if (analysis.engineDepth !== undefined) {
            totalEngineDepth += analysis.engineDepth;
            engineDepthSamples += 1;
          }
        }

        // Calculate time pressure blunder percentage
        let timePressureBlunderPercent: number | undefined;
        const allMoves = allAnalyses.flatMap((a) => a.moves);
        const blunderMoves = allMoves.filter(
          (m) => m.classification === "blunder" || m.classification === "mistake"
        );
        if (blunderMoves.length > 0) {
          // Detect initial time from first game's PGN
          const tcMatch = allAnalyses[0]?.game.pgn.match(/\[TimeControl "(\d+)(?:\+\d+)?"\]/);
          const initialTime = tcMatch ? parseInt(tcMatch[1]) : null;
          if (initialTime) {
            const threshold = initialTime * 0.1; // 10% of initial time
            const timePressureBlunders = blunderMoves.filter(
              (m) => m.clockSeconds !== undefined && m.clockSeconds < threshold
            );
            timePressureBlunderPercent = Math.round(
              (timePressureBlunders.length / blunderMoves.length) * 100
            );
          }
        }

        // Aggregate weak spots with tips from LLM
        const weakSpots = aggregateWeakSpots(allInsights);
        if (overallInsight.weakSpotTips) {
          for (const spot of weakSpots) {
            const tip = overallInsight.weakSpotTips.find(
              (t: { category: string; tip: string }) => t.category === spot.category
            );
            if (tip) spot.tip = tip.tip;
          }
        }

        const result = {
          games: allAnalyses,
          llmInsights: allInsights,
          overallSummary: {
            wins,
            losses,
            draws,
            totalBlunders: allAnalyses.reduce((s, a) => s + a.blunders, 0),
            totalMistakes: allAnalyses.reduce((s, a) => s + a.mistakes, 0),
            averageAccuracy:
              allAnalyses.reduce((s, a) => s + (a.game.accuracy ?? 0), 0) /
              allAnalyses.length,
            timePressureBlunderPercent,
            phaseBreakdown,
            averageEngineDepth:
              engineDepthSamples > 0 ? totalEngineDepth / engineDepthSamples : undefined,
          },
          overallInsight,
          weakSpots,
          performance: {
            stockfishMs,
            llmMs,
            overallMs,
            analyzeTotalMs: Date.now() - analyzeStartedAt,
            averageStockfishPerGameMs:
              allAnalyses.length > 0 ? stockfishMs / allAnalyses.length : 0,
            averageLlmPerGameMs:
              allAnalyses.length > 0 ? llmMs / allAnalyses.length : 0,
          },
        };

        console.info("Analyze performance", {
          games: allAnalyses.length,
          stockfishMs,
          llmMs,
          overallMs,
          analyzeTotalMs: result.performance.analyzeTotalMs,
          averageStockfishPerGameMs: Math.round(result.performance.averageStockfishPerGameMs),
          averageLlmPerGameMs: Math.round(result.performance.averageLlmPerGameMs),
          stockfishConcurrency: STOCKFISH_CONCURRENCY,
          llmConcurrency: LLM_CONCURRENCY,
        });

        send({
          type: "done",
          message: "Analysis complete!",
          data: result,
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Analysis failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
