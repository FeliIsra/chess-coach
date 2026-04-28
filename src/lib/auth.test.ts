import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE importing auth.ts.
const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import { getUser, requireUser, getUserRole, requireAdmin } from "./auth";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getUser", () => {
  it("returns the user when supabase has a session", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "a@b.c" } },
      error: null,
    });
    const u = await getUser();
    expect(u?.id).toBe("u1");
  });

  it("returns null when supabase returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "x" } });
    const u = await getUser();
    expect(u).toBeNull();
  });

  it("returns null when supabase throws", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("boom"));
    const u = await getUser();
    expect(u).toBeNull();
  });
});

describe("requireUser", () => {
  it("returns user when there is a session", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    const u = await requireUser("en");
    expect(u.id).toBe("u1");
  });

  it("redirects to sign-in when there is no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(requireUser("en", "/en/protected")).rejects.toThrow(
      "REDIRECT:/en/sign-in?redirectTo=%2Fen%2Fprotected"
    );
  });
});

describe("getUserRole", () => {
  it("returns null when there is no session", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const role = await getUserRole();
    expect(role).toBeNull();
  });

  it("returns 'admin' when profile.role is admin", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "admin" } });
    const role = await getUserRole();
    expect(role).toBe("admin");
  });

  it("returns 'user' when profile.role is user", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "user" } });
    const role = await getUserRole();
    expect(role).toBe("user");
  });

  it("returns 'user' when there is no profile row", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    const role = await getUserRole();
    expect(role).toBe("user");
  });
});

describe("requireAdmin", () => {
  it("returns the user when role is admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "admin@chess-coach.local" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "admin" } });
    const u = await requireAdmin("en");
    expect(u.id).toBe("u1");
  });

  it("triggers notFound when role is not admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: "user" } });
    await expect(requireAdmin("en")).rejects.toThrow("NOT_FOUND");
  });

  it("redirects to sign-in when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin("en")).rejects.toThrow("REDIRECT:/en/sign-in");
  });
});
