import { FullAnalysisResult } from "./types";

function formatLine(label: string, value: string | number): string {
  return `${label}: ${value}`;
}

function cleanList(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function buildAnalysisShareText(
  result: FullAnalysisResult,
  analyzedUsername?: string,
): string {
  const { wins, losses, draws, totalBlunders, totalMistakes, averageAccuracy } =
    result.overallSummary;
  const strengths = cleanList(result.overallInsight.topStrengths.slice(0, 3));
  const weaknesses = cleanList(result.overallInsight.topWeaknesses.slice(0, 3));
  const studyPlan = cleanList(result.overallInsight.studyPlan.slice(0, 3));

  return [
    "Chess Coach analysis",
    analyzedUsername ? formatLine("Player", analyzedUsername) : null,
    formatLine("Record", `${wins}W-${losses}L-${draws}D`),
    formatLine("Blunders", totalBlunders),
    formatLine("Mistakes", totalMistakes),
    formatLine("Average accuracy", `${averageAccuracy.toFixed(0)}%`),
    strengths.length > 0 ? formatLine("Strengths", strengths.join("; ")) : null,
    weaknesses.length > 0 ? formatLine("Weaknesses", weaknesses.join("; ")) : null,
    studyPlan.length > 0 ? formatLine("Next training", studyPlan.join(" | ")) : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
