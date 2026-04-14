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
    // "pawn" is a substring of "pawn breaks" (key.includes(normalized))
    const result = getConceptLink("pawn");
    expect(result).not.toBeNull();
    // Should match one of the pawn-related entries
    expect(result).toBe(CONCEPT_LINKS["pawn breaks"]);
  });

  it("supports partial matching when a key is a substring of the input", () => {
    // "improve king safety now" contains "king safety" (normalized.includes(key))
    const result = getConceptLink("improve king safety now");
    expect(result).not.toBeNull();
    expect(result).toBe(CONCEPT_LINKS["king safety"]);
  });

  it("returns a match for an empty string (empty is substring of every key)", () => {
    // "" is a substring of every key via key.includes(""), so the partial
    // match loop returns the first entry in CONCEPT_LINKS.
    const result = getConceptLink("");
    expect(result).not.toBeNull();
    expect(result).toBe(CONCEPT_LINKS["pawn breaks"]);
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
});
