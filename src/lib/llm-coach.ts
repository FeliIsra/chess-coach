import OpenAI from "openai";
import { GameAnalysis, LLMInsight, WeakSpot } from "./types";

export function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function formatMoveContext(move: GameAnalysis["worstMoves"][0]): string {
  const evalStr = (cp: number) => {
    if (Math.abs(cp) >= 10000) return cp > 0 ? "mate" : "-mate";
    return (cp / 100).toFixed(1);
  };

  return [
    `Move ${move.moveNumber}: ${move.san}`,
    `Position (FEN): ${move.fen}`,
    `Eval before: ${evalStr(move.evalBefore)} | Eval after: ${evalStr(move.evalAfter)} | Change: ${(move.evalDiff / 100).toFixed(1)} pawns`,
    `Best move was: ${move.bestMove}`,
    `Classification: ${move.classification}`,
  ].join("\n");
}

export async function analyzeGameWithLLM(
  client: OpenAI,
  analysis: GameAnalysis
): Promise<LLMInsight> {
  const { game, bestMoves, worstMoves } = analysis;

  const prompt = `You are a friendly chess coach for beginner/intermediate players (rating ~${game.userRating}).
Analyze this ${game.timeClass} game where the player played as ${game.userColor} against ${game.opponentName} (${game.opponentRating}).
Result: ${game.result}. Opening: ${game.openingName}.

## WORST MOVES (biggest mistakes):
${worstMoves.map((m, i) => `\n### Mistake ${i + 1}\n${formatMoveContext(m)}`).join("\n")}

## BEST MOVES (strongest plays):
${bestMoves.map((m, i) => `\n### Highlight ${i + 1}\n${formatMoveContext(m)}`).join("\n")}

Respond in JSON format with this exact structure:
{
  "worstMovesAnalysis": [
    {
      "move": "the move in SAN",
      "moveNumber": 5,
      "explanation": "2-3 sentences explaining WHY this was bad in simple terms. What did the player miss? What happens after the better move?",
      "concept": "The chess concept to study (e.g., 'knight forks', 'back rank safety', 'piece activity')",
      "category": "One of: tactics | piece safety | king safety | pawn structure | endgame | opening | positional | time management"
    }
  ],
  "bestMovesAnalysis": [
    {
      "move": "the move in SAN",
      "moveNumber": 12,
      "explanation": "2-3 sentences praising what was good. What principle did the player apply well?",
      "concept": "The chess concept demonstrated"
    }
  ],
  "summary": "A 2-3 sentence friendly summary of this game. What went well, what went wrong.",
  "improvementPlan": ["Specific actionable tip 1", "Specific actionable tip 2", "Specific actionable tip 3"],
  "strengths": ["Strength 1 observed in this game", "Strength 2"],
  "weaknesses": ["Weakness 1 observed", "Weakness 2"]
}

Rules:
- Be encouraging and friendly, like a supportive coach
- Use simple language, avoid complex chess jargon unless you explain it
- Reference SPECIFIC moves and positions, not generic advice
- For each bad move, explain what the player likely THOUGHT vs what actually happens
- For each good move, reinforce the pattern so the player repeats it
- The improvement plan should be SPECIFIC to this game, not generic`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return JSON.parse(content) as LLMInsight;
}

export function aggregateWeakSpots(insights: LLMInsight[]): WeakSpot[] {
  const counts = new Map<string, number>();
  for (const insight of insights) {
    for (const m of insight.worstMovesAnalysis ?? []) {
      if (m.category) {
        counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count, tip: "" }));
}

export async function generateOverallInsight(
  client: OpenAI,
  analyses: GameAnalysis[],
  insights: LLMInsight[]
): Promise<{
  summary: string;
  topStrengths: string[];
  topWeaknesses: string[];
  studyPlan: string[];
  weakSpotTips?: { category: string; tip: string }[];
}> {
  const gamesSummary = analyses.map((a, i) => {
    const g = a.game;
    return `Game ${i + 1}: ${g.result} as ${g.userColor} vs ${g.opponentName} (${g.opponentRating}) - ${g.openingName} - ${a.blunders} blunders, ${a.mistakes} mistakes`;
  });

  const allStrengths = insights.flatMap((i) => i.strengths);
  const allWeaknesses = insights.flatMap((i) => i.weaknesses);
  const weakSpots = aggregateWeakSpots(insights);
  const weakSpotsText = weakSpots.length > 0
    ? `\n## Tactical Weak Spots (by error frequency):\n${weakSpots.map((ws) => `- ${ws.category}: ${ws.count} errors`).join("\n")}`
    : "";

  const prompt = `You are a friendly chess coach. Based on the analysis of ${analyses.length} recent games, provide an overall assessment.

## Games Summary:
${gamesSummary.join("\n")}

## Strengths found across games:
${allStrengths.map((s) => `- ${s}`).join("\n")}

## Weaknesses found across games:
${allWeaknesses.map((w) => `- ${w}`).join("\n")}
${weakSpotsText}

## Stats:
- Total blunders: ${analyses.reduce((s, a) => s + a.blunders, 0)}
- Total mistakes: ${analyses.reduce((s, a) => s + a.mistakes, 0)}
- Average eval loss per move: ${(analyses.reduce((s, a) => s + a.averageEvalLoss, 0) / analyses.length / 100).toFixed(1)} pawns

Respond in JSON:
{
  "summary": "3-4 sentence overall assessment. Be encouraging but honest.",
  "topStrengths": ["Top 3 recurring strengths"],
  "topWeaknesses": ["Top 3 recurring weaknesses to work on"],
  "studyPlan": ["5 specific, ordered study recommendations. Start with the most impactful."],
  "weakSpotTips": [{"category": "the category name", "tip": "One actionable sentence of advice for this weak area"}]
}

For weakSpotTips, include one entry for each of these categories: ${weakSpots.map((ws) => ws.category).join(", ")}. Each tip should be a specific, actionable one-liner.

Be specific, reference patterns you see across games. Make the study plan actionable with concrete exercises.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  return JSON.parse(content);
}
