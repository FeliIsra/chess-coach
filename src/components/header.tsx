"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface HeaderProps {
  locale: string;
  user: User | null;
  displayName?: string | null;
}

export default function Header({ locale, user, displayName }: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push(`/${locale}`);
      router.refresh();
    } catch (err) {
      console.error("Sign out failed", err);
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  };

  const label =
    displayName ?? user?.email?.split("@")[0] ?? "Profile";

  return (
    <header className="border-b border-border bg-surface-1/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"
          >
            ♞
          </span>
          <span>Chess Coach</span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-3"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {label.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{label}</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-lg"
                >
                  <Link
                    href={`/${locale}/app`}
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-surface-2"
                    onClick={() => setMenuOpen(false)}
                  >
                    Analyze games
                  </Link>
                  <Link
                    href={`/${locale}/profile`}
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-surface-2"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-2 disabled:opacity-60"
                  >
                    {signingOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href={`/${locale}/sign-in`}
                className="rounded-full px-3 py-1.5 text-sm text-foreground/80 hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href={`/${locale}/sign-up`}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
