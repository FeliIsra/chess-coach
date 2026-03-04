import { describe, expect, it } from "vitest";
import { isContainerRenderable } from "@/components/use-container-ready";

describe("isContainerRenderable", () => {
  it("rejects invalid chart container sizes", () => {
    expect(isContainerRenderable(-1, 120)).toBe(false);
    expect(isContainerRenderable(120, -1)).toBe(false);
    expect(isContainerRenderable(0, 120)).toBe(false);
    expect(isContainerRenderable(120, 0)).toBe(false);
  });

  it("accepts positive dimensions", () => {
    expect(isContainerRenderable(1, 1)).toBe(true);
    expect(isContainerRenderable(240, 120)).toBe(true);
  });
});
