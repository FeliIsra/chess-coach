import { describe, expect, it } from "vitest";
import { sanitizeOpeningName } from "@/lib/chess-format";

describe("sanitizeOpeningName", () => {
  it("removes chess.com opening prefixes and strips move notation", () => {
    expect(
      sanitizeOpeningName("/Www.Chess.Com/Openings/Kings-Pawn-Opening-1...E5")
    ).toBe("Kings Pawn Opening");
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
      "Caro-Kann Defense"
    );
  });

  it("keeps common opening compounds readable", () => {
    expect(
      sanitizeOpeningName("https://www.chess.com/openings/nimzo-indian-defense")
    ).toBe("Nimzo-Indian Defense");
    expect(
      sanitizeOpeningName("https://www.chess.com/openings/nimzo-larsen-attack")
    ).toBe("Nimzo-Larsen Attack");
  });

  it("truncates to main opening and first variation", () => {
    expect(
      sanitizeOpeningName(
        "Reti Opening Nimzo Larsen Variation 2...d6 3.Bb2 E5"
      )
    ).toBe("Reti Opening (Nimzo-Larsen)");
  });

  it("keeps variation with no explicit Variation keyword", () => {
    expect(
      sanitizeOpeningName(
        "Indian Game Black Knights Tango 3.Nf3 E6 4.g3 Bb4"
      )
    ).toBe("Indian Game (Black-Knights-Tango)");
  });

  it("stops variation at secondary boundary keyword", () => {
    expect(
      sanitizeOpeningName(
        "English Opening Anglo Indian Queens Knight Variation...4.Bg2 O O 5.d3 C5"
      )
    ).toBe("English Opening (Anglo-Indian)");
  });

  it("leaves short names unchanged", () => {
    expect(sanitizeOpeningName("Sicilian Defense")).toBe("Sicilian Defense");
  });
});
