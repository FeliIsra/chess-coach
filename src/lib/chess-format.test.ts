import { describe, expect, it } from "vitest";
import { sanitizeOpeningName } from "@/lib/chess-format";

describe("sanitizeOpeningName", () => {
  it("removes chess.com opening prefixes and keeps a readable title", () => {
    expect(
      sanitizeOpeningName("/Www.Chess.Com/Openings/Kings-Pawn-Opening-1...E5")
    ).toBe("Kings Pawn Opening 1...E5");
  });

  it("handles full urls and query params", () => {
    expect(
      sanitizeOpeningName("https://www.chess.com/openings/owens-defense?ref=abc")
    ).toBe("Owens Defense");
  });

  it("falls back to unknown opening when empty", () => {
    expect(sanitizeOpeningName("")).toBe("Unknown opening");
    expect(sanitizeOpeningName()).toBe("Unknown opening");
  });

  it("normalizes separators", () => {
    expect(sanitizeOpeningName("openings/caro-kann-defense")).toBe(
      "Caro Kann Defense"
    );
  });
});
