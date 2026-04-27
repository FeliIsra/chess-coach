import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Tunables. 5 submissions per IP per 10 minutes is generous for humans
// and tight for bots. Window keyed off `Date.now()` in rate-limit.ts.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const ALLOWED_TYPES = ["bug", "feature", "other"] as const;
type ReportType = (typeof ALLOWED_TYPES)[number];

const BODY_MIN = 10;
const BODY_MAX = 5000;
const EMAIL_MAX = 320; // RFC-ish ceiling; Postgres has no length cap on text.
const PAGE_URL_MAX = 2048;
const USER_AGENT_MAX = 1024;

// Loose but practical email shape. Real validation happens at the
// human-eyeballs stage; we only want to catch obvious typos / garbage.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ReportPayload {
  type?: unknown;
  body?: unknown;
  email?: unknown;
  page_url?: unknown;
  honeypot?: unknown;
}

interface ParsedReport {
  type: ReportType;
  body: string;
  email: string | null;
  page_url: string | null;
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getClientIp(request: NextRequest): string {
  // x-forwarded-for is set by Vercel; first entry is the original client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseAndValidate(payload: ReportPayload):
  | { ok: true; data: ParsedReport }
  | { ok: false; error: string } {
  // Type
  if (!isString(payload.type) ||
      !ALLOWED_TYPES.includes(payload.type as ReportType)) {
    return {
      ok: false,
      error: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
    };
  }
  const type = payload.type as ReportType;

  // Body
  if (!isString(payload.body)) {
    return { ok: false, error: "body is required" };
  }
  const body = payload.body.trim();
  if (body.length < BODY_MIN) {
    return {
      ok: false,
      error: `body must be at least ${BODY_MIN} characters`,
    };
  }
  if (body.length > BODY_MAX) {
    return {
      ok: false,
      error: `body must be at most ${BODY_MAX} characters`,
    };
  }

  // Email (optional)
  let email: string | null = null;
  if (payload.email !== undefined && payload.email !== null && payload.email !== "") {
    if (!isString(payload.email)) {
      return { ok: false, error: "email must be a string" };
    }
    const trimmed = payload.email.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > EMAIL_MAX || !EMAIL_REGEX.test(trimmed)) {
        return { ok: false, error: "email is not a valid address" };
      }
      email = trimmed;
    }
  }

  // page_url (optional)
  let pageUrl: string | null = null;
  if (payload.page_url !== undefined && payload.page_url !== null && payload.page_url !== "") {
    if (!isString(payload.page_url)) {
      return { ok: false, error: "page_url must be a string" };
    }
    const trimmed = payload.page_url.trim();
    if (trimmed.length > 0) {
      pageUrl = trimmed.slice(0, PAGE_URL_MAX);
    }
  }

  return {
    ok: true,
    data: { type, body, email, page_url: pageUrl },
  };
}

export async function POST(request: NextRequest) {
  let payload: ReportPayload;
  try {
    payload = (await request.json()) as ReportPayload;
  } catch {
    return jsonError("Invalid JSON body");
  }

  // Honeypot: real humans never fill the hidden field. Bots that
  // auto-fill every input will. Return a fake-success response so we
  // don't tip them off that we caught them.
  if (isString(payload.honeypot) && payload.honeypot.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const validation = parseAndValidate(payload);
  if (!validation.ok) {
    return jsonError(validation.error);
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(
    `reports:${ip}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
        },
      },
    );
  }

  const userAgentRaw = request.headers.get("user-agent") ?? "";
  const userAgent = userAgentRaw ? userAgentRaw.slice(0, USER_AGENT_MAX) : null;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("reports").insert({
      type: validation.data.type,
      body: validation.data.body,
      email: validation.data.email,
      page_url: validation.data.page_url,
      user_agent: userAgent,
    });

    if (error) {
      console.error("Failed to insert report", error);
      return jsonError("Could not save report. Please try again.", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reports endpoint failure", err);
    return jsonError("Could not save report. Please try again.", 500);
  }
}
