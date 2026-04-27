import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;
const DEFAULT_LOCALE = "en";
const PROTECTED_SEGMENTS = new Set(["app", "profile", "history", "admin"]);

function getLocaleAndSegment(pathname: string): {
  locale: string;
  firstSegment: string | null;
} {
  // pathname starts with "/" — split into [empty, locale, segment, ...]
  const parts = pathname.split("/").filter(Boolean);
  const locale = parts[0] ?? DEFAULT_LOCALE;
  const firstSegment = parts[1] ?? null;
  return { locale, firstSegment };
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase env vars are missing, skip auth entirely so dev still loads
  // the public landing. Protected pages will fall through to the page-level
  // `requireUser()` check, which surfaces a clear redirect to sign-in.
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh session cookies on every protected request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { locale, firstSegment } = getLocaleAndSegment(
    request.nextUrl.pathname
  );

  if (firstSegment && PROTECTED_SEGMENTS.has(firstSegment) && !user) {
    const safeLocale = (SUPPORTED_LOCALES as readonly string[]).includes(locale)
      ? locale
      : DEFAULT_LOCALE;
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = `/${safeLocale}/sign-in`;
    signInUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // Only run on locale-prefixed protected segments. Keeps middleware cheap.
  matcher: ["/(en|es|pt)/(app|profile|history|admin)/:path*"],
};
