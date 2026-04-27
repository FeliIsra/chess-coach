import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Capture the most recent insert call so individual tests can assert on it.
const insertMock = vi.fn();

// Mock the supabase admin module BEFORE importing the route. The route
// imports `getSupabaseAdmin` lazily on each request, so swapping it
// here is sufficient.
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        insertMock(...args);
        return Promise.resolve({ error: null });
      },
    }),
  }),
  __resetSupabaseAdminForTests: () => {},
}));

import { POST } from "@/app/api/reports/route";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

const VALID_BODY =
  "Something is broken on the analysis screen and it never finishes loading.";

function makeRequest(
  payload: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "vitest",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/reports", () => {
  beforeEach(() => {
    insertMock.mockReset();
    __resetRateLimitForTests();
  });
  afterEach(() => {
    __resetRateLimitForTests();
  });

  it("accepts a valid bug report and inserts it", async () => {
    const res = await POST(makeRequest({ type: "bug", body: VALID_BODY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      type: "bug",
      body: VALID_BODY,
      email: null,
      page_url: null,
      user_agent: "vitest",
    });
  });

  it("captures optional email and page_url when provided", async () => {
    await POST(
      makeRequest({
        type: "feature",
        body: VALID_BODY,
        email: "user@example.com",
        page_url: "https://app.example.com/page",
      }),
    );
    const inserted = insertMock.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      type: "feature",
      email: "user@example.com",
      page_url: "https://app.example.com/page",
    });
  });

  it("rejects an invalid type", async () => {
    const res = await POST(
      makeRequest({ type: "spam", body: VALID_BODY }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects body shorter than 10 chars", async () => {
    const res = await POST(makeRequest({ type: "bug", body: "short" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/at least/i);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects body longer than 5000 chars", async () => {
    const longBody = "x".repeat(5001);
    const res = await POST(makeRequest({ type: "bug", body: longBody }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/at most/i);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects invalid email format", async () => {
    const res = await POST(
      makeRequest({
        type: "bug",
        body: VALID_BODY,
        email: "not-an-email",
      }),
    );
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns ok-but-discards when honeypot is filled (silent reject)", async () => {
    const res = await POST(
      makeRequest({
        type: "bug",
        body: VALID_BODY,
        honeypot: "i am a bot",
      }),
    );
    // 200 + ok:true so the bot believes it succeeded.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    // …but no insert actually happened.
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rate limits the 6th submission from the same IP", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ type: "bug", body: VALID_BODY }));
      expect(res.status).toBe(200);
    }
    expect(insertMock).toHaveBeenCalledTimes(5);

    const blocked = await POST(
      makeRequest({ type: "bug", body: VALID_BODY }),
    );
    expect(blocked.status).toBe(429);
    const json = await blocked.json();
    expect(json.ok).toBe(false);
    expect(insertMock).toHaveBeenCalledTimes(5); // unchanged
  });

  it("isolates rate limit by IP", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(
        makeRequest(
          { type: "bug", body: VALID_BODY },
          { "x-forwarded-for": "9.9.9.9" },
        ),
      );
    }
    // Different IP still gets through.
    const fresh = await POST(
      makeRequest(
        { type: "bug", body: VALID_BODY },
        { "x-forwarded-for": "8.8.8.8" },
      ),
    );
    expect(fresh.status).toBe(200);
  });

  it("rejects malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
