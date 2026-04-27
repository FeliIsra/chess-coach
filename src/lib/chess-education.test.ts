import { describe, expect, it } from "vitest";
import { CONCEPT_LINKS, getConceptLink } from "@/lib/chess-education";

describe("getConceptLink", () => {
  it("returns the correct URL for a direct match", () => {
    expect(getConceptLink("pawn breaks")).toBe(
      CONCEPT_LINKS["pawn breaks"],
    );
  });

  it("matches case-insensitively", () => {
    expect(getConceptLink("Pawn Breaks")).toBe(
      CONCEPT_LINKS["pawn breaks"],
    );
  });

  it("matches case-insensitively with all-caps input", () => {
    expect(getConceptLink("KING SAFETY")).toBe(
      CONCEPT_LINKS["king safety"],
    );
  });

  it("returns null for an unknown concept", () => {
    expect(getConceptLink("quantum chess")).toBeNull();
  });

  it("supports partial matching when the input is a substring of a key", () => {
    const result = getConceptLink("pawn");
    expect(result).not.toBeNull();
    expect(result).toBe(CONCEPT_LINKS["pawn breaks"]);
  });

  it("supports partial matching when a key is a substring of the input", () => {
    const result = getConceptLink("improve king safety now");
    expect(result).not.toBeNull();
    expect(result).toBe(CONCEPT_LINKS["king safety"]);
  });

  it("returns null for an empty string", () => {
    expect(getConceptLink("")).toBeNull();
  });

  it("returns the correct URL for plural form 'pins'", () => {
    expect(getConceptLink("pins")).toBe(CONCEPT_LINKS["pins"]);
  });

  it("returns the correct URL for plural form 'forks'", () => {
    expect(getConceptLink("forks")).toBe(CONCEPT_LINKS["forks"]);
  });

  it("trims whitespace from the input", () => {
    expect(getConceptLink("  king safety  ")).toBe(
      CONCEPT_LINKS["king safety"],
    );
  });

  it("matches hyphenated and phrase-based concepts", () => {
    expect(getConceptLink("king-safety")).toBe(CONCEPT_LINKS["king safety"]);
    expect(getConceptLink("time trouble")).toBe(CONCEPT_LINKS["time trouble"]);
    expect(getConceptLink("attack the king")).toBe(CONCEPT_LINKS["attack the king"]);
  });
});
