"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  en: "EN",
  es: "ES",
  pt: "PT",
};

interface LocaleSwitcherProps {
  /** True if the user is signed in; we'll persist the choice on profiles. */
  isAuthed?: boolean;
}

export default function LocaleSwitcher({ isAuthed }: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  const onChange = (next: string) => {
    if (next === currentLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
      router.refresh();
    });
    if (isAuthed) {
      // Best-effort persistence; ignore failures.
      void fetch("/api/profile/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      }).catch(() => {});
    }
  };

  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">Language</span>
      <select
        value={currentLocale}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className="rounded-full border border-border bg-surface-2 px-2 py-1 font-medium text-foreground"
        aria-label="Change language"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {LABELS[loc] ?? loc.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
