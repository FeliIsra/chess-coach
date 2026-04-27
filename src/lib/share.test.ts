import { describe, expect, it } from "vitest";
import { buildAnalysisShareText } from "@/lib/share";
import { FullAnalysisResult } from "@/lib/types";

function makeResult(overrides: Partial<FullAnalysisResult> = {}): FullAnalysisResult {
  return {
    games: [],
    llmInsights: [],
    overallSummary: {
      wins: 3,
      losses: 1,
      draws: 1,
      totalBlunders: 8,
      totalMistakes: 5,
      averageAccuracy: 81,
    },
    overallInsight: {
      summary: "Keep improving",
      topStrengths: ["Good openings", "Solid defense"],
      topWeaknesses: ["Time pressure", "King safety"],
      studyPlan: ["Play slower", "Review tactics"],
    },
    ...overrides,
  };
}

describe("buildAnalysisShareText", () => {
  it("builds a concise clipboard-friendly recap", () => {
    const text = buildAnalysisShareText(makeResult());

    expect(text).toContain("Chess Coach analysis");
    expect(text).toContain("Record: 3W-1L-1D");
    expect(text).toContain("Blunders: 8");
    expect(text).toContain("Average accuracy: 81%");
    expect(text).toContain("Strengths: Good openings; Solid defense");
    expect(text).toContain("Next training: Play slower | Review tactics");
  });
});
