import OpenAI from "openai";
import { GameAnalysis, LLMInsight, TacticalCategory, WeakSpot } from "./types";
import { sanitizeOpeningName } from "./chess-format";

const VALID_CATEGORIES: TacticalCategory[] = [
  "tactics",
  "piece safety",
  "king safety",
  "pawn structure",
  "endgame",
  "opening",
  "positional",
  "time management",
];

const INFERENCE_PATTERNS = [
  /you probably thought/i,
  /you likely thought/i,
  /you may have thought/i,
  /you were trying to/i,
  /you probably felt/i,
  /you likely felt/i,
];

type OverallInsightResponse = {
  summary: string;
  topStrengths: string[];
  topWeaknesses: string[];
  studyPlan: string[];
  weakSpotTips?: { category: string; tip: string }[];
};

interface LLMStreamOptions {
  onDelta?: (delta: string) => void;
}

function readStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

const LLM_MODEL = readStringEnv("LLM_MODEL", "gpt-4o-mini");
const ENABLE_LLM_OVERALL_INSIGHT = readBooleanEnv(
  "ENABLE_LLM_OVERALL_INSIGHT",
  false
);

export function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty LLM response");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function readDeltaText(delta: unknown): string {
  if (typeof delta === "string") return delta;
  if (!Array.isArray(delta)) return "";

  return delta
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("");
}

async function requestJsonCompletionWithStreaming(
  client: OpenAI,
  prompt: string,
  options?: LLMStreamOptions
): Promise<unknown> {
  const stream = await client.chat.completions.create({
    model: LLM_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.4,
    stream: true,
  });

  let buffer = "";
  for await (const chunk of stream) {
    const delta = readDeltaText(chunk.choices[0]?.delta?.content);
    if (!delta) continue;
    buffer += delta;
    options?.onDelta?.(delta);
  }

  const jsonPayload = extractJsonPayload(buffer);
  return JSON.parse(jsonPayload) as unknown;
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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripInferredIntent(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const filtered = sentences.filter(
    (sentence) => !INFERENCE_PATTERNS.some((pattern) => pattern.test(sentence))
  );

  return (filtered.length > 0 ? filtered : sentences).join(" ").trim();
}

function sanitizeSentence(text: string, fallback: string): string {
  const stripped = stripInferredIntent(text);
  const normalized = stripped
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
  return normalized || fallback;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return undefined;
}

function asStringList(
  value: unknown,
  fallback: string[],
  maxItems: number
): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
    .map((item) =>
      sanitizeSentence(
        item,
        "Review the critical moment and compare your move with the engine line."
      )
    )
    .slice(0, maxItems);

  return cleaned.length > 0 ? cleaned : fallback;
}

function asCategory(value: unknown): TacticalCategory | undefined {
  const category = asString(value)?.toLowerCase();
  if (!category) return undefined;
  return VALID_CATEGORIES.find((entry) => entry === category);
}

function sanitizeWorstMoves(
  raw: unknown,
  fallbackMoves: GameAnalysis["worstMoves"]
): LLMInsight["worstMovesAnalysis"] {
  const input = Array.isArray(raw) ? raw : [];
  const entries = input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const fallback = fallbackMoves[index];

      const move = asString(record.move) ?? fallback?.san;
      const moveNumber = asInteger(record.moveNumber) ?? fallback?.moveNumber;
      const explanation = sanitizeSentence(
        asString(record.explanation) ??
          "This move drops too much value and gives your opponent clear counterplay.",
        "This move drops too much value and gives your opponent clear counterplay."
      );
      const concept =
        asString(record.concept) ??
        "Scan forcing moves and direct threats before committing.";
      const category = asCategory(record.category) ?? "tactics";

      if (!move || moveNumber === undefined) return null;

      return {
        move,
        moveNumber,
        explanation,
        concept,
        category,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const deduped: LLMInsight["worstMovesAnalysis"] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.moveNumber}:${normalizeText(entry.explanation)}:${normalizeText(entry.concept)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  if (deduped.length > 0) {
    return deduped.slice(0, 6);
  }

  return fallbackMoves.slice(0, 3).map((move) => ({
    move: move.san,
    moveNumber: move.moveNumber,
    explanation:
      "This move loses important control and worsens your position quickly.",
    concept: "Check forcing responses before making a move.",
    category: "tactics",
  }));
}

function sanitizeBestMoves(
  raw: unknown,
  fallbackMoves: GameAnalysis["bestMoves"]
): LLMInsight["bestMovesAnalysis"] {
  const input = Array.isArray(raw) ? raw : [];
  const entries = input
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const fallback = fallbackMoves[index];

      const move = asString(record.move) ?? fallback?.san;
      const moveNumber = asInteger(record.moveNumber) ?? fallback?.moveNumber;
      const explanation = sanitizeSentence(
        asString(record.explanation) ??
          "This move improves activity and keeps your position stable.",
        "This move improves activity and keeps your position stable."
      );
      const concept =
        asString(record.concept) ??
        "Coordinate your pieces and improve their activity.";

      if (!move || moveNumber === undefined) return null;

      return {
        move,
        moveNumber,
        explanation,
        concept,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const deduped: LLMInsight["bestMovesAnalysis"] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.moveNumber}:${normalizeText(entry.explanation)}:${normalizeText(entry.concept)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  if (deduped.length > 0) {
    return deduped.slice(0, 4);
  }

  return fallbackMoves.slice(0, 2).map((move) => ({
    move: move.san,
    moveNumber: move.moveNumber,
    explanation:
      "This move keeps your position healthy and avoids unnecessary weaknesses.",
    concept: "Improve piece coordination with low risk.",
  }));
}

function sanitizeLLMInsight(
  raw: unknown,
  reviewMoves: GameAnalysis["worstMoves"],
  highlightMoves: GameAnalysis["bestMoves"]
): LLMInsight {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    worstMovesAnalysis: sanitizeWorstMoves(record.worstMovesAnalysis, reviewMoves),
    bestMovesAnalysis: sanitizeBestMoves(record.bestMovesAnalysis, highlightMoves),
    summary: sanitizeSentence(
      asString(record.summary) ??
        "The game had useful ideas, but key tactical moments decided the result.",
      "The game had useful ideas, but key tactical moments decided the result."
    ),
    improvementPlan: asStringList(
      record.improvementPlan,
      [
        "Review your biggest error and replay the best line until it feels natural.",
        "Before each move, check opponent threats and forcing moves.",
        "Practice 5 tactical puzzles focused on your main weak theme.",
      ],
      5
    ),
    strengths: asStringList(
      record.strengths,
      ["You found practical moves in several positions."],
      4
    ),
    weaknesses: asStringList(
      record.weaknesses,
      ["Critical tactical moments are still costing too many points."],
      4
    ),
  };
}

export async function analyzeGameWithLLM(
  client: OpenAI,
  analysis: GameAnalysis,
  options?: LLMStreamOptions
): Promise<LLMInsight> {
  const { game, bestMoves, worstMoves } = analysis;
  const reviewMoves = worstMoves.filter((move) => move.classification !== "good").slice(0, 4);
  const highlightMoves = bestMoves
    .filter(
      (move) =>
        move.classification === "brilliant" ||
        move.classification === "great" ||
        move.evalDiff >= 15
    )
    .slice(0, 2);

  const prompt = `You are a precise chess coach for beginner/intermediate players (rating ~${game.userRating}).
Analyze this ${game.timeClass} game where the player played as ${game.userColor} against ${game.opponentName} (${game.opponentRating}).
Result: ${game.result}. Opening: ${sanitizeOpeningName(game.openingName)}.

## WORST MOVES (biggest mistakes):
${reviewMoves.map((m, i) => `\n### Mistake ${i + 1}\n${formatMoveContext(m)}`).join("\n")}

## BEST MOVES (strongest plays):
${highlightMoves.map((m, i) => `\n### Highlight ${i + 1}\n${formatMoveContext(m)}`).join("\n")}

Respond in JSON format with this exact structure:
{
  "worstMovesAnalysis": [
    {
      "move": "the move in SAN",
      "moveNumber": 5,
      "explanation": "1-2 short sentences. Explain the concrete consequence and what line was better.",
      "concept": "The chess concept to study (e.g., 'knight forks', 'back rank safety', 'piece activity')",
      "category": "One of: tactics | piece safety | king safety | pawn structure | endgame | opening | positional | time management"
    }
  ],
  "bestMovesAnalysis": [
    {
      "move": "the move in SAN",
      "moveNumber": 12,
      "explanation": "1-2 short sentences. Explain exactly what this move improved.",
      "concept": "The chess concept demonstrated"
    }
  ],
  "summary": "A short practical summary of this game.",
  "improvementPlan": ["Specific actionable tip 1", "Specific actionable tip 2", "Specific actionable tip 3"],
  "strengths": ["Strength 1 observed in this game", "Strength 2"],
  "weaknesses": ["Weakness 1 observed", "Weakness 2"]
}

Rules:
- Be calm, direct, and practical. No motivational filler.
- Always reference concrete board consequences, not generic advice.
- For each bad move, state what was lost (material, king safety, initiative, structure, endgame quality).
- Never write psychological assumptions like "you probably thought" or "you likely thought".
- Do not overpraise neutral moves. If the gain is small, describe it as "solid" instead of "excellent".
- Keep every field concise. Prefer one precise sentence over multiple generic ones.
- Improvement plan items must be specific drills tied to this game.`;

  const parsed = await requestJsonCompletionWithStreaming(client, prompt, options);
  return sanitizeLLMInsight(parsed, reviewMoves, highlightMoves);
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

function sanitizeWeakSpotTips(
  rawTips: unknown,
  requiredCategories: string[]
): { category: string; tip: string }[] {
  const input = Array.isArray(rawTips) ? rawTips : [];
  const byCategory = new Map<string, string>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const category = asString(record.category);
    const tip = asString(record.tip);
    if (!category || !tip) continue;
    byCategory.set(category, sanitizeSentence(tip, "Review similar positions and focus on this theme."));
  }

  return requiredCategories.map((category) => ({
    category,
    tip:
      byCategory.get(category) ??
      DEFAULT_WEAK_SPOT_TIPS[category] ??
      "Review two recent examples of this theme and solve 5 focused puzzles.",
  }));
}

function sanitizeOverallInsight(
  raw: unknown,
  weakSpots: WeakSpot[]
): OverallInsightResponse {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const requiredCategories = weakSpots.map((ws) => ws.category);

  return {
    summary: sanitizeSentence(
      asString(record.summary) ??
        "Your results show recurring tactical errors that are currently the biggest rating blocker.",
      "Your results show recurring tactical errors that are currently the biggest rating blocker."
    ),
    topStrengths: asStringList(
      record.topStrengths,
      ["You can keep playable positions when the position stays simple."],
      3
    ),
    topWeaknesses: asStringList(
      record.topWeaknesses,
      ["Critical moments still include avoidable tactical oversights."],
      3
    ),
    studyPlan: asStringList(
      record.studyPlan,
      [
        "Review your top 3 blunders and write the best move for each position.",
        "Do 10 puzzles focused on your most frequent weak category.",
        "Play one slower game and spend extra time before tactical decisions.",
      ],
      5
    ),
    weakSpotTips:
      requiredCategories.length > 0
        ? sanitizeWeakSpotTips(record.weakSpotTips, requiredCategories)
        : [],
  };
}

const DEFAULT_WEAK_SPOT_TIPS: Record<string, string> = {
  tactics:
    "Solve 5 short tactical puzzles and name every check, capture, and threat before moving.",
  "piece safety":
    "Before each move, check which pieces are loose or attacked with no backup.",
  "king safety":
    "Finish king safety first, then ask what forcing checks your opponent has.",
  "pawn structure":
    "Review the pawn moves that created weaknesses and note which squares became targets.",
  endgame:
    "Replay the late phase slowly and practice the one key plan you missed.",
  opening:
    "Keep one simple setup and learn the first few safe developing moves.",
  positional:
    "On quiet moves, ask which piece can improve without creating a new weakness.",
  "time management":
    "Save time in simple positions so you can slow down in sharp ones.",
};

function dedupeNormalized(items: string[], maxItems: number): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(item);
    if (output.length >= maxItems) break;
  }

  return output;
}

function buildFastOverallInsight(
  analyses: GameAnalysis[],
  insights: LLMInsight[],
  weakSpots: WeakSpot[]
): OverallInsightResponse {
  const totalBlunders = analyses.reduce((sum, analysis) => sum + analysis.blunders, 0);
  const totalMistakes = analyses.reduce((sum, analysis) => sum + analysis.mistakes, 0);
  const topStrengths = dedupeNormalized(
    insights.flatMap((insight) => insight.strengths),
    3
  );
  const topWeaknesses = dedupeNormalized(
    [
      ...weakSpots.map((spot) => `${spot.category} keeps showing up across your recent errors.`),
      ...insights.flatMap((insight) => insight.weaknesses),
    ],
    3
  );

  const primaryWeakSpot = weakSpots[0]?.category ?? "tactics";
  const summary =
    analyses.length > 0
      ? `Across ${analyses.length} recent games, the biggest drag on results is ${primaryWeakSpot}. You gave away ${totalBlunders} blunders and ${totalMistakes} mistakes, so the fastest improvement comes from reducing avoidable tactical damage before expanding your opening work.`
      : "Recent games show recurring tactical damage that should be your first training priority.";

  const studyPlan = dedupeNormalized(
    [
      ...weakSpots.slice(0, 3).map(
        (spot) =>
          `Focus one short practice block on ${spot.category}: ${
            DEFAULT_WEAK_SPOT_TIPS[spot.category] ??
            "Review recent examples of this theme and solve 5 focused puzzles."
          }`
      ),
      "Review your top three blunders and write the engine move before replaying the line.",
      "Play the next training game slightly slower and force a threat scan before every critical move.",
    ],
    5
  );

  return {
    summary,
    topStrengths:
      topStrengths.length > 0
        ? topStrengths
        : ["You still reach playable positions when the game stays calm and structured."],
    topWeaknesses:
      topWeaknesses.length > 0
        ? topWeaknesses
        : ["Critical tactical moments are still costing too much material and initiative."],
    studyPlan,
    weakSpotTips: weakSpots.map((spot) => ({
      category: spot.category,
      tip:
        DEFAULT_WEAK_SPOT_TIPS[spot.category] ??
        "Review two recent examples of this theme and solve 5 focused puzzles.",
    })),
  };
}

export async function generateOverallInsight(
  client: OpenAI,
  analyses: GameAnalysis[],
  insights: LLMInsight[],
  options?: LLMStreamOptions
): Promise<OverallInsightResponse> {
  const gamesSummary = analyses.map((a, i) => {
    const g = a.game;
    return `Game ${i + 1}: ${g.result} as ${g.userColor} vs ${g.opponentName} (${g.opponentRating}) - ${sanitizeOpeningName(g.openingName)} - ${a.blunders} blunders, ${a.mistakes} mistakes`;
  });

  const allStrengths = insights.flatMap((i) => i.strengths);
  const allWeaknesses = insights.flatMap((i) => i.weaknesses);
  const weakSpots = aggregateWeakSpots(insights);
  if (!ENABLE_LLM_OVERALL_INSIGHT) {
    return buildFastOverallInsight(analyses, insights, weakSpots);
  }
  const weakSpotsText =
    weakSpots.length > 0
      ? `\n## Tactical Weak Spots (by error frequency):\n${weakSpots.map((ws) => `- ${ws.category}: ${ws.count} errors`).join("\n")}`
      : "";

  const prompt = `You are a precise chess coach. Based on the analysis of ${analyses.length} recent games, provide an overall assessment.

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
  "summary": "3-4 sentence overall assessment. Be honest and practical.",
  "topStrengths": ["Top 3 recurring strengths"],
  "topWeaknesses": ["Top 3 recurring weaknesses to work on"],
  "studyPlan": ["5 specific, ordered study recommendations. Start with the most impactful."],
  "weakSpotTips": [{"category": "the category name", "tip": "One actionable sentence of advice for this weak area"}]
}

Rules:
- No motivational filler.
- No psychological guesses about player intent.
- Every study step must be concrete and measurable.
- Include one weakSpotTips entry for each category: ${weakSpots.map((ws) => ws.category).join(", ") || "none"}.`;

  const parsed = await requestJsonCompletionWithStreaming(client, prompt, options);
  return sanitizeOverallInsight(parsed, weakSpots);
}
