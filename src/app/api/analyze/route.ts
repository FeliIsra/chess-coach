import { NextRequest } from "next/server";
import { analyzeGame } from "@/lib/analyzer";
import {
  createOpenAIClient,
  analyzeGameWithLLM,
  generateOverallInsight,
  aggregateWeakSpots,
} from "@/lib/llm-coach";
import { AnalysisProgress, ChessGame, GameAnalysis, LLMInsight } from "@/lib/types";

const STOCKFISH_CONCURRENCY = 3;

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
        const openai = createOpenAIClient();
        const allAnalyses: GameAnalysis[] = new Array(games.length);
        let gamesCompleted = 0;

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
          const analysis = await analyzeGame(games[i], (moveIdx, totalMoves) => {
            send({
              type: "progress",
              phase: "stockfish",
              gameIndex: i,
              activeGameIndex: i,
              totalGames: games.length,
              moveIndex: moveIdx,
              totalMoves,
              gamesCompleted,
              phaseProgressPercent: Math.round((moveIdx / Math.max(totalMoves, 1)) * 100),
              message: `Game ${i + 1}/${games.length}: evaluating move ${moveIdx}/${totalMoves}`,
            });
          });

          allAnalyses[i] = analysis;
          gamesCompleted++;

          send({
            type: "game_complete",
            phase: "stockfish",
            gameIndex: i,
            totalGames: games.length,
            gamesCompleted,
            phaseProgressPercent: Math.round((gamesCompleted / games.length) * 100),
            message: `Game ${i + 1} analyzed: ${analysis.blunders} blunders, ${analysis.mistakes} mistakes`,
            data: analysis,
          });
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

        // Phase 2: LLM analysis — all in parallel
        send({
          type: "llm_analysis",
          phase: "llm",
          totalGames: allAnalyses.length,
          gamesCompleted: 0,
          phaseProgressPercent: 0,
          message: `AI coach reviewing ${allAnalyses.length} games...`,
        });

        let llmCompleted = 0;
        const allInsights: LLMInsight[] = await Promise.all(
          allAnalyses.map(async (analysis, i) => {
            const insight = await analyzeGameWithLLM(openai, analysis);
            llmCompleted++;
            send({
              type: "llm_analysis",
              phase: "llm",
              gameIndex: i,
              totalGames: allAnalyses.length,
              gamesCompleted: llmCompleted,
              phaseProgressPercent: Math.round(
                (llmCompleted / allAnalyses.length) * 100
              ),
              message: `AI review complete for ${llmCompleted} of ${allAnalyses.length} games`,
            });
            return insight;
          })
        );

        // Phase 3: Overall insight
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

        const wins = allAnalyses.filter((a) => a.game.result === "win").length;
        const losses = allAnalyses.filter((a) => a.game.result === "loss").length;
        const draws = allAnalyses.filter((a) => a.game.result === "draw").length;

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
          },
          overallInsight,
          weakSpots,
        };

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
