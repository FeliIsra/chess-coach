import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockEqLocale = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqHash = vi.fn(() => ({ eq: mockEqLocale }));
const mockSelect = vi.fn(() => ({ eq: mockEqHash }));
const mockInsert = vi.fn(async () => ({ error: null }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { getCachedOrCompute, hashSource } from "./translation-cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hashSource", () => {
  it("produces stable sha256 hashes for identical inputs", () => {
    expect(hashSource(["a", "b"])).toBe(hashSource(["a", "b"]));
  });

  it("produces different hashes when parts differ", () => {
    expect(hashSource(["a", "b"])).not.toBe(hashSource(["b", "a"]));
  });
});

describe("getCachedOrCompute", () => {
  it("returns cached content on hit and does not compute", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { content: "cached" } });
    const compute = vi.fn(async () => "fresh");
    const result = await getCachedOrCompute("h1", "es", compute);
    expect(result).toBe("cached");
    expect(compute).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("computes and inserts on miss", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    const compute = vi.fn(async () => "fresh");
    const result = await getCachedOrCompute("h2", "pt", compute);
    expect(result).toBe("fresh");
    expect(compute).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("still returns computed value if insert fails", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    mockInsert.mockRejectedValueOnce(new Error("rls denied"));
    const compute = vi.fn(async () => "fresh");
    const result = await getCachedOrCompute("h3", "pt", compute);
    expect(result).toBe("fresh");
  });
});
