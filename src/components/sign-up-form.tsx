"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignUpFormProps {
  locale: string;
}

export default function SignUpForm({ locale }: SignUpFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() || undefined },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback?next=/${locale}/app`
              : undefined,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        router.push(`/${locale}/app`);
        router.refresh();
        return;
      }
      setInfo(
        "Check your email to confirm your account. Once confirmed you'll be redirected to the app."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-frame mx-auto mt-12 w-full max-w-md space-y-5 rounded-2xl p-6 md:p-8"
      aria-label="Sign up form"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Save your analyses, track ELO, and get personalised coaching.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="display_name"
          className="block text-sm font-medium text-foreground"
        >
          Display name (optional)
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="How should we call you?"
        />
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"
        >
          {error}
        </div>
      )}

      {info && (
        <div
          role="status"
          className="rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3 text-sm text-foreground"
        >
          {info}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted"
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-foreground/70">
        Already have an account?{" "}
        <Link
          href={`/${locale}/sign-in`}
          className="font-semibold text-primary hover:text-primary-hover"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
