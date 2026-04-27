// NOTE: WT-J (i18n) will replace this with NextIntlClientProvider — keep this minimal.
import { notFound } from "next/navigation";
import Header from "@/components/header";
import { getUser } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    notFound();
  }

  const user = await getUser();
  let displayName: string | null = null;

  if (user) {
    try {
      const supabase = await getSupabaseServerClient();
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      displayName = data?.display_name ?? null;
    } catch {
      // Profile fetch is best-effort for the header label.
      displayName = null;
    }
  }

  return (
    <>
      <Header locale={locale} user={user} displayName={displayName} />
      {children}
    </>
  );
}
