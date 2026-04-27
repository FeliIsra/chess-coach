"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignInFormProps {
  locale: string;
}

export default function SignInForm({ locale }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? `/${locale}/app`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-frame mx-auto mt-12 w-full max-w-md space-y-5 rounded-2xl p-6 md:p-8"
      aria-label="Sign in form"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Sign in to keep analyzing your games and tracking your progress.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-foreground/70">
        New here?{" "}
        <Link
          href={`/${locale}/sign-up`}
          className="font-semibold text-primary hover:text-primary-hover"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
