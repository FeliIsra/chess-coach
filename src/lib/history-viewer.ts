import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

const SCOPE_SEPARATOR = "__vk__";

function getFirstHeaderValue(request: NextRequest, headerName: string): string | null {
  const value = request.headers.get(headerName);
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function sanitizeIp(value: string): string {
  const trimmed = value.trim();
  // Handle values like "1.2.3.4:12345"
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(trimmed)) {
    return trimmed.replace(/:\d+$/, "");
  }
  return trimmed;
}

function extractClientIp(request: NextRequest): string | null {
  const candidates = [
    getFirstHeaderValue(request, "x-forwarded-for"),
    getFirstHeaderValue(request, "x-real-ip"),
    getFirstHeaderValue(request, "cf-connecting-ip"),
    getFirstHeaderValue(request, "true-client-ip"),
    getFirstHeaderValue(request, "x-client-ip"),
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) return null;
  return sanitizeIp(candidates[0]);
}

function extractFallbackFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown-ua";
  const language = request.headers.get("accept-language")?.trim() || "unknown-lang";
  return `ua:${userAgent}|lang:${language}`;
}

export function getHistoryViewerKey(request: NextRequest): string {
  const ip = extractClientIp(request);
  const identitySource = ip ? `ip:${ip}` : extractFallbackFingerprint(request);
  const salt = process.env.HISTORY_VIEWER_SALT || "chess-coach-history-v1";

  return createHash("sha256")
    .update(`${salt}:${identitySource}`)
    .digest("hex");
}

export function toScopedUsername(username: string, viewerKey: string): string {
  return `${username.trim()}${SCOPE_SEPARATOR}${viewerKey}`;
}

export function fromScopedUsername(value: string): string {
  const separatorIndex = value.lastIndexOf(SCOPE_SEPARATOR);
  if (separatorIndex === -1) return value;
  return value.slice(0, separatorIndex);
}

export function scopedUsernameLikePattern(viewerKey: string): string {
  return `%${SCOPE_SEPARATOR}${viewerKey}`;
}
